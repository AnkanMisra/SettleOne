/**
 * Yellow Network SDK Integration
 *
 * Uses @erc7824/nitrolite for off-chain state channel sessions.
 * Each payment session is managed via Yellow's ClearNode for instant payments,
 * with final settlement occurring on-chain via our SessionSettlement contract.
 */

import type { Hex } from 'viem';

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
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private payments: YellowPayment[] = [];

  constructor(config: YellowSessionConfig) {
    this.config = config;
  }

  /**
   * Connect to Yellow Network ClearNode
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(CLEARNODE_URL);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log('[Yellow] Connected to ClearNode');
          this.config.onConnect?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            // Parse the JSON-RPC response
            const rawMessage = JSON.parse(event.data);
            const message = this.parseMessage(rawMessage);
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
          console.log('[Yellow] Disconnected from ClearNode');
          this.config.onDisconnect?.();
          this.attemptReconnect();
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Parse Yellow Network RPC message into our format
   */
  private parseMessage(raw: unknown): YellowMessage {
    // Handle array format [requestId, method, params, timestamp?]
    if (Array.isArray(raw)) {
      const [, method, params] = raw;
      return {
        type: this.methodToType(method as string),
        method: method as string,
        data: params,
        timestamp: Date.now(),
      };
    }

    // Handle object format
    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, unknown>;
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

    return {
      type: 'session_message',
      data: raw,
      timestamp: Date.now(),
    };
  }

  private methodToType(method: string): YellowMessage['type'] {
    switch (method) {
      case 'create_app_session':
        return 'session_created';
      case 'error':
        return 'error';
      case 'auth_challenge':
        return 'auth_challenge';
      case 'auth_verify':
        return 'auth_verified';
      default:
        return 'session_message';
    }
  }

  /**
   * Disconnect from ClearNode
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.sessionId = null;
    this.payments = [];
  }

  /**
   * Create a new payment session on Yellow Network
   */
  async createSession(partnerAddress: string): Promise<string> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to Yellow Network');
    }

    // Generate a unique session ID
    const requestId = `settleone-${Date.now()}`;

    // Create the app session request following Yellow RPC format
    const appDefinition = {
      protocol: 'settleone-payment-v1',
      participants: [this.config.userAddress, partnerAddress],
      weights: [100, 0], // Sender has full control
      quorum: 100,
      challenge: 0,
      nonce: Date.now(),
    };

    const allocations = [
      {
        participant: this.config.userAddress,
        asset: 'usdc',
        amount: '0',
      },
      {
        participant: partnerAddress,
        asset: 'usdc',
        amount: '0',
      },
    ];

    // Build the RPC message
    const rpcMessage = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'create_app_session',
      params: {
        definition: appDefinition,
        allocations,
      },
    };

    // Sign the message
    const messageToSign = JSON.stringify(rpcMessage);
    const signature = await this.config.messageSigner(messageToSign);

    // Send signed request
    const signedMessage = {
      ...rpcMessage,
      signature,
      sender: this.config.userAddress,
    };

    try {
      this.ws.send(JSON.stringify(signedMessage));
    } catch (err) {
      console.error('[Yellow] Failed to send session creation:', err);
      throw new Error('Failed to send session creation request');
    }

    // For demo purposes, create a local session ID immediately
    // In production, we'd wait for ClearNode confirmation
    this.sessionId = requestId;
    console.log('[Yellow] Session created:', this.sessionId);

    return this.sessionId;
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
