/**
 * Yellow Network SDK Integration
 *
 * Uses @erc7824/nitrolite for off-chain state channel sessions.
 * Each payment session is managed via Yellow's ClearNode for instant payments,
 * with final settlement occurring on-chain via our SessionSettlement contract.
 */

import type { Hex, Address } from 'viem';
import {
  parseAnyRPCResponse,
  createAppSessionMessage,
  createPingMessageV2,
  type MessageSigner as NitroliteMessageSigner,
  type RPCResponse,
  type RPCData,
  type RPCAppDefinition,
  type RPCAppSessionAllocation,
  RPCProtocolVersion,
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
}

export interface YellowMessage {
  type:
    | 'session_created'
    | 'payment'
    | 'session_message'
    | 'error'
    | 'state_update'
    | 'auth_challenge'
    | 'auth_verified';
  sessionId?: string;
  amount?: string;
  sender?: string;
  recipient?: string;
  data?: unknown;
  error?: string;
  timestamp?: number;
  method?: string;
}

export interface YellowPayment {
  recipient: string;
  amount: string; // In base units (6 decimals for USDC)
  asset: 'usdc';
  timestamp: number;
}

export interface YellowSessionState {
  sessionId: string | null;
  isConnected: boolean;
  payments: YellowPayment[];
  totalSent: bigint;
}

/**
 * YellowSession manages a WebSocket connection to Yellow Network's ClearNode
 * for off-chain payment session management.
 */
export class YellowSession {
  private ws: WebSocket | null = null;
  private config: YellowSessionConfig;
  private sessionId: string | null = null;
  private isConnected = false;
  private isConnecting = false;
  private isManualDisconnect = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private payments: YellowPayment[] = [];
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: YellowSessionConfig) {
    this.config = config;
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
      this.ws.onclose = null; // Prevent triggering reconnect
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
          
          // Start heartbeat using SDK's ping message
          this.startHeartbeat();
          
          this.config.onConnect?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            // Pass raw string to parseMessage - SDK handles JSON parsing
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
            // Clean up WebSocket before rejecting
            this.isConnecting = false;
            if (this.ws) {
              this.ws.onclose = null; // Prevent reconnect attempt
              this.ws.close();
              this.ws = null;
            }
            reject(err);
          }
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.isConnecting = false;
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
   * Parse Yellow Network RPC message into our format
   */
  private parseMessage(raw: string): YellowMessage {
    try {
      // Use SDK's parser for proper RPC response handling
      const parsed: RPCResponse = parseAnyRPCResponse(raw);
      
      // Extract method from the response
      const method = (parsed as { method?: string }).method || 'unknown';
      
      return {
        type: this.methodToType(method),
        method: method,
        data: parsed,
        sessionId: (parsed as { result?: { sessionId?: string } }).result?.sessionId,
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
          timestamp: Date.now(),
        };
      }

      // Handle object format
      if (typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as Record<string, unknown>;
        return {
          type: (obj.type as YellowMessage['type']) || 'session_message',
          sessionId: obj.sessionId as string | undefined,
          amount: obj.amount as string | undefined,
          sender: obj.sender as string | undefined,
          recipient: obj.recipient as string | undefined,
          data: obj,
          error: obj.error as string | undefined,
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
        return 'session_created';
      case 'submit_app_state':
      case 'state_update':
      case 'app_state_update':
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
        return 'auth_verified';
      default:
        return 'session_message';
    }
  }

  /**
   * Disconnect from ClearNode
   */
  disconnect(): void {
    // Set flag to prevent automatic reconnection
    this.isManualDisconnect = true;
    this.isConnecting = false;
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    if (this.ws) {
      // Remove handlers to prevent any callbacks
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.sessionId = null;
    this.payments = [];
    this.reconnectAttempts = 0;
  }

  /**
   * Start heartbeat/ping interval using SDK
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    // Send ping every 30 seconds to keep connection alive
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

    // Generate a unique session ID (numeric for SDK, string for internal use)
    const timestamp = Date.now();
    const requestIdNumeric = timestamp; // SDK expects number
    const requestIdString = `settleone-${timestamp}`; // For fallback/internal use

    // Create the SDK-compatible message signer
    // SDK's MessageSigner expects (payload: RPCData) => Promise<Hex>
    // We stringify the RPCData and pass to our string-based signer
    const sdkSigner: NitroliteMessageSigner = async (payload: RPCData) => {
      const messageString = JSON.stringify(payload);
      return this.config.messageSigner(messageString);
    };

    // Create the app session request using SDK types
    const definition: RPCAppDefinition = {
      application: 'settleone-payment',
      protocol: RPCProtocolVersion.NitroRPC_0_4,
      participants: [this.config.userAddress as Hex, partnerAddress as Hex],
      weights: [100, 0], // Sender has full control
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
      // Use SDK to create the signed message
      const signedMessage = await createAppSessionMessage(
        sdkSigner,
        sessionParams,
        requestIdNumeric,
        timestamp
      );

      this.ws.send(signedMessage);
    } catch (err) {
      console.error('[Yellow] Failed to create session with SDK, using fallback:', err);
      // Fallback to manual message creation
      await this.createSessionFallback(partnerAddress, requestIdString);
    }

    // For demo purposes, create a local session ID immediately
    // In production, we'd wait for ClearNode confirmation
    this.sessionId = requestIdString;
    console.log('[Yellow] Session created:', this.sessionId);

    return this.sessionId;
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
   */
  async sendPayment(recipient: string, amount: string): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to Yellow Network');
    }

    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const paymentData = {
      jsonrpc: '2.0',
      id: `payment-${Date.now()}`,
      method: 'submit_app_state',
      params: {
        sessionId: this.sessionId,
        type: 'payment',
        amount,
        recipient,
        asset: 'usdc',
        timestamp: Date.now(),
      },
    };

    // Sign the payment
    const signature = await this.config.messageSigner(
      JSON.stringify(paymentData)
    );

    const signedPayment = {
      ...paymentData,
      signature,
      sender: this.config.userAddress,
    };

    // Send through ClearNode
    try {
      this.ws.send(JSON.stringify(signedPayment));
    } catch (err) {
      console.error('[Yellow] Failed to send payment:', err);
      throw new Error('Failed to send payment request');
    }

    // Track payment locally
    this.payments.push({
      recipient,
      amount,
      asset: 'usdc',
      timestamp: paymentData.params.timestamp,
    });

    console.log('[Yellow] Payment sent:', amount, 'to', recipient);
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
      isConnected: this.isConnected,
      payments: [...this.payments],
      totalSent,
    };
  }

  /**
   * Get all payments in the current session for on-chain settlement
   */
  getPaymentsForSettlement(): Array<{ recipient: string; amount: bigint }> {
    // Aggregate payments by recipient
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
      case 'session_created':
        this.sessionId = message.sessionId || this.sessionId;
        console.log('[Yellow] Session confirmed:', this.sessionId);
        break;

      case 'payment':
        console.log('[Yellow] Payment received:', message.amount);
        break;

      case 'state_update':
        console.log('[Yellow] State updated');
        break;

      case 'error':
        console.error('[Yellow] Error:', message.error);
        break;

      case 'auth_challenge':
        console.log('[Yellow] Auth challenge received');
        break;

      case 'auth_verified':
        console.log('[Yellow] Auth verified');
        break;

      default:
        console.log('[Yellow] Message:', message.type, message.data);
    }

    this.config.onMessage?.(message);
  }

  private attemptReconnect(): void {
    // Don't reconnect if disconnect was called manually
    if (this.isManualDisconnect) {
      console.log('[Yellow] Skipping reconnect - manual disconnect');
      return;
    }

    // Don't reconnect if a connection is already in progress
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
