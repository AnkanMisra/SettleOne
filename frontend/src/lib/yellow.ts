/**
 * Yellow Network SDK Integration
 *
 * Uses @erc7824/nitrolite for off-chain state channel sessions.
 * Each payment session is managed via Yellow's ClearNode for instant payments,
 * with final settlement occurring on-chain via our SessionSettlement contract.
 *
 * Flow:
 * 1. Connect to ClearNode WebSocket
 * 2. Send auth_request -> receive auth_challenge -> send auth_verify
 * 3. Create app session for payments
 * 4. Submit app state updates for each payment
 * 5. Close session and settle on-chain
 */

import type { Hex, Address } from 'viem';
import {
  parseAnyRPCResponse,
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
  createAppSessionMessage,
  createSubmitAppStateMessage,
  createCloseAppSessionMessage,
  createPingMessageV2,
  type MessageSigner as NitroliteMessageSigner,
  type RPCResponse,
  type RPCData,
  type RPCAppDefinition,
  type RPCAppSessionAllocation,
  type CloseAppSessionRequestParams,
  RPCProtocolVersion,
  RPCAppStateIntent,
} from '@erc7824/nitrolite';

// ClearNode endpoints
const CLEARNODE_SANDBOX = 'wss://clearnet-sandbox.yellow.com/ws';
const CLEARNODE_PRODUCTION = 'wss://clearnet.yellow.com/ws';

// Use sandbox for development, production for mainnet
const CLEARNODE_URL =
  process.env.NEXT_PUBLIC_YELLOW_ENV === 'production'
    ? CLEARNODE_PRODUCTION
    : CLEARNODE_SANDBOX;

// Message signer type compatible with viem wallet clients
export type MessageSigner = (message: string) => Promise<Hex>;

export interface YellowSessionConfig {
  userAddress: string;
  messageSigner: MessageSigner;
  onMessage?: (message: YellowMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onAuthenticated?: () => void;
}

export interface YellowMessage {
  type:
    | 'session_created'
    | 'payment'
    | 'session_message'
    | 'error'
    | 'state_update'
    | 'auth_challenge'
    | 'auth_verified'
    | 'session_closed'
    | 'pong';
  sessionId?: string;
  amount?: string;
  sender?: string;
  recipient?: string;
  data?: unknown;
  error?: string;
  timestamp?: number;
  method?: string;
  challenge?: string;
}

export interface YellowPayment {
  recipient: string;
  amount: string; // In base units (6 decimals for USDC)
  asset: 'usdc';
  timestamp: number;
}

export interface YellowSessionState {
  sessionId: string | null;
  appSessionId: Hex | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  payments: YellowPayment[];
  totalSent: bigint;
  stateVersion: number;
}

/**
 * YellowSession manages a WebSocket connection to Yellow Network's ClearNode
 * for off-chain payment session management.
 */
export class YellowSession {
  private ws: WebSocket | null = null;
  private config: YellowSessionConfig;
  private sessionId: string | null = null;
  private appSessionId: Hex | null = null;
  private isConnected = false;
  private isConnecting = false;
  private isAuthenticated = false;
  private isManualDisconnect = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private payments: YellowPayment[] = [];
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private stateVersion = 0;
  private pendingAuthResolve: (() => void) | null = null;
  private pendingSessionResolve: ((sessionId: string) => void) | null = null;

  constructor(config: YellowSessionConfig) {
    this.config = config;
  }

  /**
   * Create SDK-compatible message signer
   * SDK's MessageSigner expects (payload: RPCData) => Promise<Hex>
   */
  private createSdkSigner(): NitroliteMessageSigner {
    return async (payload: RPCData): Promise<Hex> => {
      const messageString = JSON.stringify(payload);
      return this.config.messageSigner(messageString);
    };
  }

  /**
   * Connect to Yellow Network ClearNode
   */
  async connect(): Promise<void> {
    // Guard: Return early if already connected or connection in progress
    if (this.isConnected) {
      console.log('[Yellow] Already connected');
      return;
    }
    if (this.isConnecting) {
      console.log('[Yellow] Connection already in progress');
      return;
    }

    // Close any existing stale WebSocket
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    // Reset flags for new connection
    this.isManualDisconnect = false;
    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(CLEARNODE_URL);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          console.log('[Yellow] Connected to ClearNode');

          // Start heartbeat
          this.startHeartbeat();

          this.config.onConnect?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = this.parseMessage(event.data);
            this.handleMessage(message);
          } catch (err) {
            console.error('[Yellow] Failed to parse message:', err);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[Yellow] WebSocket error:', error);
          const err = new Error('Yellow Network connection error');
          this.config.onError?.(err);
          if (!this.isConnected) {
            this.isConnecting = false;
            if (this.ws) {
              this.ws.onclose = null;
              this.ws.close();
              this.ws = null;
            }
            reject(err);
          }
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.isConnecting = false;
          this.isAuthenticated = false;
          console.log('[Yellow] Disconnected from ClearNode');
          this.config.onDisconnect?.();
          this.attemptReconnect();
        };
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  /**
   * Authenticate with ClearNode
   * Sends auth_request, waits for auth_challenge, then sends auth_verify
   */
  async authenticate(): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to Yellow Network');
    }

    if (this.isAuthenticated) {
      console.log('[Yellow] Already authenticated');
      return;
    }

    const timestamp = Date.now();

    // Create auth request message using SDK
    const authRequest = await createAuthRequestMessage(
      {
        address: this.config.userAddress as Address,
        session_key: this.config.userAddress as Address, // Using main address as session key for demo
        application: 'settleone',
        allowances: [],
        expires_at: BigInt(timestamp + 86400000), // 24 hours from now
        scope: 'payment',
      },
      timestamp,
      timestamp
    );

    // Send auth request
    this.ws.send(authRequest);
    console.log('[Yellow] Auth request sent');

    // Wait for auth to complete (handled in handleMessage)
    return new Promise((resolve) => {
      this.pendingAuthResolve = resolve;
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingAuthResolve) {
          this.pendingAuthResolve = null;
          console.warn('[Yellow] Auth timeout');
        }
      }, 30000);
    });
  }

  /**
   * Handle auth challenge response
   */
  private async handleAuthChallenge(challenge: string): Promise<void> {
    if (!this.ws || !this.isConnected) {
      console.error('[Yellow] Cannot respond to auth challenge - not connected');
      return;
    }

    try {
      const timestamp = Date.now();
      const sdkSigner = this.createSdkSigner();

      // Create auth verify message using SDK
      const authVerify = await createAuthVerifyMessageFromChallenge(
        sdkSigner,
        challenge,
        timestamp,
        timestamp
      );

      this.ws.send(authVerify);
      console.log('[Yellow] Auth verify sent');
    } catch (err) {
      console.error('[Yellow] Failed to respond to auth challenge:', err);
      this.config.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Parse Yellow Network RPC message into our format
   */
  private parseMessage(raw: string): YellowMessage {
    try {
      // Use SDK's parser for proper RPC response handling
      const parsed: RPCResponse = parseAnyRPCResponse(raw);

      // Extract method from the response
      const method = (parsed as { method?: string }).method || 'unknown';

      // Extract challenge if present
      const params = (parsed as { params?: { challengeMessage?: string; challenge_message?: string } }).params;
      const challenge = params?.challengeMessage || params?.challenge_message;

      // Extract app session ID if present
      const result = (parsed as { result?: { app_session_id?: Hex; appSessionId?: Hex; sessionId?: string } }).result;
      const appSessionId = result?.app_session_id || result?.appSessionId;

      return {
        type: this.methodToType(method),
        method: method,
        data: parsed,
        sessionId: result?.sessionId || (appSessionId as string),
        challenge,
        timestamp: Date.now(),
      };
    } catch {
      // Fallback to manual parsing if SDK parser fails
      return this.parseMessageFallback(raw);
    }
  }

  /**
   * Fallback parser for non-standard messages
   */
  private parseMessageFallback(raw: string): YellowMessage {
    try {
      const parsed = JSON.parse(raw);

      // Handle array format [requestId, method, params, timestamp?]
      if (Array.isArray(parsed)) {
        const [, method, params] = parsed;
        return {
          type: this.methodToType(method as string),
          method: method as string,
          data: params,
          challenge: (params as { challengeMessage?: string })?.challengeMessage,
          timestamp: Date.now(),
        };
      }

      // Handle object format
      if (typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as Record<string, unknown>;
        const params = obj.params as Record<string, unknown> | undefined;
        return {
          type: (obj.type as YellowMessage['type']) || 'session_message',
          sessionId: obj.sessionId as string | undefined,
          amount: obj.amount as string | undefined,
          sender: obj.sender as string | undefined,
          recipient: obj.recipient as string | undefined,
          data: obj,
          error: obj.error as string | undefined,
          challenge: params?.challengeMessage as string | undefined,
          timestamp: Date.now(),
        };
      }
    } catch {
      // Return raw as data if parsing fails
    }

    return {
      type: 'session_message',
      data: raw,
      timestamp: Date.now(),
    };
  }

  private methodToType(method: string): YellowMessage['type'] {
    switch (method) {
      case 'create_app_session':
      case 'app_session_created':
      case 'create_app_session_response':
        return 'session_created';
      case 'submit_app_state':
      case 'state_update':
      case 'app_state_update':
      case 'submit_app_state_response':
        return 'state_update';
      case 'submit_payment':
      case 'payment':
      case 'payment_received':
        return 'payment';
      case 'error':
        return 'error';
      case 'auth_challenge':
        return 'auth_challenge';
      case 'auth_verify':
      case 'auth_verified':
      case 'auth_verify_response':
        return 'auth_verified';
      case 'close_app_session':
      case 'close_app_session_response':
        return 'session_closed';
      case 'pong':
        return 'pong';
      default:
        return 'session_message';
    }
  }

  /**
   * Disconnect from ClearNode
   */
  disconnect(): void {
    this.isManualDisconnect = true;
    this.isConnecting = false;

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isAuthenticated = false;
    this.sessionId = null;
    this.appSessionId = null;
    this.payments = [];
    this.stateVersion = 0;
    this.reconnectAttempts = 0;
  }

  /**
   * Start heartbeat/ping interval using SDK
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.pingInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        try {
          const pingMessage = createPingMessageV2();
          this.ws.send(pingMessage);
          console.log('[Yellow] Ping sent');
        } catch (err) {
          console.error('[Yellow] Failed to send ping:', err);
        }
      }
    }, 30000);
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Create a new payment session on Yellow Network
   */
  async createSession(partnerAddress: string): Promise<string> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to Yellow Network');
    }

    // Authenticate first if not already
    if (!this.isAuthenticated) {
      console.log('[Yellow] Authenticating before session creation...');
      await this.authenticate();
    }

    const timestamp = Date.now();
    const requestIdNumeric = timestamp;
    const requestIdString = `settleone-${timestamp}`;

    const sdkSigner = this.createSdkSigner();

    // Create the app session request using SDK types
    const definition: RPCAppDefinition = {
      application: 'settleone-payment',
      protocol: RPCProtocolVersion.NitroRPC_0_4,
      participants: [this.config.userAddress as Hex, partnerAddress as Hex],
      weights: [100, 0],
      quorum: 100,
      challenge: 0,
      nonce: timestamp,
    };

    const allocations: RPCAppSessionAllocation[] = [
      {
        participant: this.config.userAddress as Address,
        asset: 'usdc',
        amount: '0',
      },
      {
        participant: partnerAddress as Address,
        asset: 'usdc',
        amount: '0',
      },
    ];

    const sessionParams = { definition, allocations };

    try {
      const signedMessage = await createAppSessionMessage(
        sdkSigner,
        sessionParams,
        requestIdNumeric,
        timestamp
      );

      this.ws.send(signedMessage);
      console.log('[Yellow] Create session request sent');
    } catch (err) {
      console.error('[Yellow] Failed to create session with SDK, using fallback:', err);
      await this.createSessionFallback(partnerAddress, requestIdString);
    }

    // Set local session ID immediately for demo
    // In production, wait for ClearNode confirmation
    this.sessionId = requestIdString;
    this.stateVersion = 0;

    // Wait for session confirmation with timeout
    return new Promise((resolve) => {
      this.pendingSessionResolve = resolve;
      // Resolve immediately for demo (ClearNode will confirm async)
      setTimeout(() => {
        if (this.pendingSessionResolve) {
          this.pendingSessionResolve(this.sessionId!);
          this.pendingSessionResolve = null;
        }
      }, 100);
    });
  }

  /**
   * Fallback session creation without SDK
   */
  private async createSessionFallback(partnerAddress: string, requestId: string): Promise<void> {
    if (!this.ws) return;

    const appDefinition = {
      protocol: 'settleone-payment-v1',
      participants: [this.config.userAddress, partnerAddress],
      weights: [100, 0],
      quorum: 100,
      challenge: 0,
      nonce: Date.now(),
    };

    const allocations = [
      { participant: this.config.userAddress, asset: 'usdc', amount: '0' },
      { participant: partnerAddress, asset: 'usdc', amount: '0' },
    ];

    const rpcMessage = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'create_app_session',
      params: { definition: appDefinition, allocations },
    };

    const messageToSign = JSON.stringify(rpcMessage);
    const signature = await this.config.messageSigner(messageToSign);

    const signedMessage = {
      ...rpcMessage,
      signature,
      sender: this.config.userAddress,
    };

    this.ws.send(JSON.stringify(signedMessage));
  }

  /**
   * Send an instant payment through the Yellow Network state channel
   * Uses SDK's createSubmitAppStateMessage for proper protocol compliance
   */
  async sendPayment(recipient: string, amount: string): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to Yellow Network');
    }

    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const timestamp = Date.now();
    this.stateVersion++;

    // If we have an app session ID from ClearNode, use SDK method
    if (this.appSessionId) {
      try {
        const sdkSigner = this.createSdkSigner();

        // Calculate new allocations after payment
        const currentTotal = this.payments.reduce(
          (sum, p) => sum + BigInt(p.amount),
          BigInt(0)
        );
        const newTotal = currentTotal + BigInt(amount);

        const stateParams = {
          app_session_id: this.appSessionId,
          intent: RPCAppStateIntent.Operate,
          version: this.stateVersion,
          allocations: [
            {
              participant: this.config.userAddress as Address,
              asset: 'usdc',
              amount: newTotal.toString(),
            },
            {
              participant: recipient as Address,
              asset: 'usdc',
              amount: amount,
            },
          ],
          session_data: JSON.stringify({
            type: 'payment',
            recipient,
            amount,
            timestamp,
          }),
        };

        const signedMessage = await createSubmitAppStateMessage<typeof RPCProtocolVersion.NitroRPC_0_4>(
          sdkSigner,
          stateParams,
          timestamp,
          timestamp
        );

        this.ws.send(signedMessage);
        console.log('[Yellow] Payment sent via SDK');
      } catch (err) {
        console.error('[Yellow] SDK payment failed, using fallback:', err);
        await this.sendPaymentFallback(recipient, amount, timestamp);
      }
    } else {
      // Use fallback if no app session ID yet
      await this.sendPaymentFallback(recipient, amount, timestamp);
    }

    // Track payment locally
    this.payments.push({
      recipient,
      amount,
      asset: 'usdc',
      timestamp,
    });

    console.log('[Yellow] Payment recorded:', amount, 'to', recipient);
  }

  /**
   * Fallback payment without SDK
   */
  private async sendPaymentFallback(recipient: string, amount: string, timestamp: number): Promise<void> {
    if (!this.ws) return;

    const paymentData = {
      jsonrpc: '2.0',
      id: `payment-${timestamp}`,
      method: 'submit_app_state',
      params: {
        sessionId: this.sessionId,
        type: 'payment',
        amount,
        recipient,
        asset: 'usdc',
        version: this.stateVersion,
        timestamp,
      },
    };

    const signature = await this.config.messageSigner(JSON.stringify(paymentData));

    const signedPayment = {
      ...paymentData,
      signature,
      sender: this.config.userAddress,
    };

    this.ws.send(JSON.stringify(signedPayment));
  }

  /**
   * Close the current session
   * Returns final state for on-chain settlement
   */
  async closeSession(): Promise<{ payments: YellowPayment[]; totalSent: bigint }> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to Yellow Network');
    }

    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const timestamp = Date.now();

    // Calculate final allocations
    const totalSent = this.payments.reduce(
      (sum, p) => sum + BigInt(p.amount),
      BigInt(0)
    );

    // Aggregate by recipient
    const recipientTotals = new Map<string, bigint>();
    for (const payment of this.payments) {
      const current = recipientTotals.get(payment.recipient) || BigInt(0);
      recipientTotals.set(payment.recipient, current + BigInt(payment.amount));
    }

    const finalAllocations: RPCAppSessionAllocation[] = Array.from(recipientTotals.entries()).map(
      ([participant, amt]) => ({
        participant: participant as Address,
        asset: 'usdc',
        amount: amt.toString(),
      })
    );

    // Add sender's remaining allocation
    finalAllocations.unshift({
      participant: this.config.userAddress as Address,
      asset: 'usdc',
      amount: totalSent.toString(),
    });

    if (this.appSessionId) {
      try {
        const sdkSigner = this.createSdkSigner();

        const closeParams: CloseAppSessionRequestParams = {
          app_session_id: this.appSessionId,
          allocations: finalAllocations,
        };

        const signedMessage = await createCloseAppSessionMessage(
          sdkSigner,
          closeParams,
          timestamp,
          timestamp
        );

        this.ws.send(signedMessage);
        console.log('[Yellow] Close session request sent');
      } catch (err) {
        console.error('[Yellow] Failed to close session with SDK:', err);
      }
    }

    const result = {
      payments: [...this.payments],
      totalSent,
    };

    // Clear local state
    this.sessionId = null;
    this.appSessionId = null;
    this.payments = [];
    this.stateVersion = 0;

    return result;
  }

  /**
   * Get current session state
   */
  getState(): YellowSessionState {
    const totalSent = this.payments.reduce(
      (sum, p) => sum + BigInt(p.amount),
      BigInt(0)
    );

    return {
      sessionId: this.sessionId,
      appSessionId: this.appSessionId,
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      payments: [...this.payments],
      totalSent,
      stateVersion: this.stateVersion,
    };
  }

  /**
   * Get all payments in the current session for on-chain settlement
   */
  getPaymentsForSettlement(): Array<{ recipient: string; amount: bigint }> {
    const aggregated = new Map<string, bigint>();

    for (const payment of this.payments) {
      const current = aggregated.get(payment.recipient) || BigInt(0);
      aggregated.set(payment.recipient, current + BigInt(payment.amount));
    }

    return Array.from(aggregated.entries()).map(([recipient, amount]) => ({
      recipient,
      amount,
    }));
  }

  private handleMessage(message: YellowMessage): void {
    switch (message.type) {
      case 'auth_challenge':
        console.log('[Yellow] Auth challenge received');
        if (message.challenge) {
          this.handleAuthChallenge(message.challenge);
        }
        break;

      case 'auth_verified':
        this.isAuthenticated = true;
        console.log('[Yellow] Authentication successful');
        this.config.onAuthenticated?.();
        if (this.pendingAuthResolve) {
          this.pendingAuthResolve();
          this.pendingAuthResolve = null;
        }
        break;

      case 'session_created':
        if (message.sessionId) {
          this.appSessionId = message.sessionId as Hex;
          console.log('[Yellow] Session confirmed:', this.appSessionId);
        }
        if (this.pendingSessionResolve) {
          this.pendingSessionResolve(this.sessionId || message.sessionId || '');
          this.pendingSessionResolve = null;
        }
        break;

      case 'payment':
        console.log('[Yellow] Payment received:', message.amount);
        break;

      case 'state_update':
        console.log('[Yellow] State updated, version:', this.stateVersion);
        break;

      case 'session_closed':
        console.log('[Yellow] Session closed');
        this.sessionId = null;
        this.appSessionId = null;
        break;

      case 'error':
        console.error('[Yellow] Error:', message.error);
        break;

      case 'pong':
        // Heartbeat acknowledged
        break;

      default:
        console.log('[Yellow] Message:', message.type, message.data);
    }

    this.config.onMessage?.(message);
  }

  private attemptReconnect(): void {
    if (this.isManualDisconnect) {
      console.log('[Yellow] Skipping reconnect - manual disconnect');
      return;
    }

    if (this.isConnecting) {
      console.log('[Yellow] Skipping reconnect - connection in progress');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[Yellow] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.pow(2, this.reconnectAttempts) * 1000;

    console.log(
      `[Yellow] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      this.connect().catch((err) => {
        console.error('[Yellow] Reconnection failed:', err);
      });
    }, delay);
  }
}

export { CLEARNODE_URL, CLEARNODE_SANDBOX, CLEARNODE_PRODUCTION };
