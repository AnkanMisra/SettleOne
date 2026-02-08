// API client for SettleOne Rust backend

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types matching backend responses
export interface SessionData {
  id: string;
  user: string;
  status: 'active' | 'pending' | 'settled' | 'cancelled';
  payments: PaymentData[];
  total_amount: string;
  created_at: string;
}

export interface PaymentData {
  id: string;
  recipient: string;
  recipient_ens: string | null;
  amount: string;
  status: 'pending' | 'confirmed' | 'settled';
  created_at: string;
}

export interface ENSResolution {
  name: string;
  address: string | null;
  avatar: string | null;
  error: string | null;
}

export interface QuoteData {
  from_amount: string;
  to_amount: string;
  estimated_gas: string;
  estimated_time: number;
  route: unknown | null;
  error: string | null;
}

export interface ApiError {
  message: string;
  code?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API error: ${response.status}`);
    }

    return response.json();
  }

  // Health check
  async health(): Promise<{ status: string }> {
    return this.request('/health');
  }

  // ENS Resolution
  async resolveENS(name: string): Promise<ENSResolution> {
    return this.request(`/api/ens/resolve?name=${encodeURIComponent(name)}`);
  }

  async lookupENS(address: string): Promise<ENSResolution> {
    return this.request(
      `/api/ens/lookup?address=${encodeURIComponent(address)}`
    );
  }

  // Session Management
  async createSession(userAddress: string): Promise<{
    session_id: string;
    status: string;
  }> {
    return this.request('/api/session', {
      method: 'POST',
      body: JSON.stringify({ user_address: userAddress }),
    });
  }

  async getSession(sessionId: string): Promise<{
    session: SessionData | null;
    error: string | null;
  }> {
    return this.request(`/api/session/${sessionId}`);
  }

  async addPayment(
    sessionId: string,
    payment: {
      recipient: string;
      recipient_ens?: string;
      amount: string;
    }
  ): Promise<{
    session: SessionData | null;
    error: string | null;
  }> {
    return this.request(`/api/session/${sessionId}/payment`, {
      method: 'POST',
      body: JSON.stringify(payment),
    });
  }

  async removePayment(
    sessionId: string,
    paymentId: string
  ): Promise<{
    session: SessionData | null;
    error: string | null;
  }> {
    return this.request(`/api/session/${sessionId}/payment/${paymentId}`, {
      method: 'DELETE',
    });
  }

  async finalizeSession(sessionId: string, txHash?: string): Promise<{
    session_id: string;
    status: string;
    tx_hash: string | null;
  }> {
    return this.request(`/api/session/${sessionId}/finalize`, {
      method: 'POST',
      body: JSON.stringify({ tx_hash: txHash }),
    });
  }

  // Cross-chain Quotes (LI.FI)
  async getQuote(params: {
    fromChain: string;
    toChain: string;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    fromAddress?: string;
  }): Promise<QuoteData> {
    const queryParams = new URLSearchParams({
      from_chain: params.fromChain,
      to_chain: params.toChain,
      from_token: params.fromToken,
      to_token: params.toToken,
      from_amount: params.fromAmount,
    });

    if (params.fromAddress) {
      queryParams.set('from_address', params.fromAddress);
    }

    return this.request(`/api/quote?${queryParams.toString()}`);
  }
}

// Singleton instance
export const api = new ApiClient();

// Export class for testing/custom instances
export { ApiClient };
