// API client for SettleOne Rust backend

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types matching backend responses
export interface PreparedDraft {
  draft_id: string;
  contract: string;
  expires_at: number;
  total_limit: string;
  calldata: string;
}
export interface SessionData {
  id: string;
  user: string;
  status: 'draft' | 'awaiting_approval' | 'submitted' | 'confirmed' | 'failed';
  chain_id: number;
  token: string;
  token_decimals: number;
  payments: PaymentData[];
  total_amount: string;
  budget: string;
  prepared: PreparedDraft | null;
  tx_hash: string | null;
  failure: string | null;
  created_at: string;
}
export interface PaymentData {
  id: string;
  recipient: string;
  recipient_ens: string | null;
  amount: string;
  status: 'pending' | 'confirmed';
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

export interface GraphAgentEvidence {
  id: string;
  wallet: string;
  active: boolean;
  total_feedback: number;
  warning: string | null;
}

export interface GraphReview {
  fresh: boolean;
  indexed_at: string | null;
  deployment: string | null;
  note: string;
  agents: GraphAgentEvidence[];
}

export interface ApiError {
  message: string;
  code?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  setToken(token: string | null) { this.token = token; }

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
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `API error: ${response.status}`);
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

  async challenge(address: string): Promise<{ challenge_id: string; message: string }> {
    return this.request('/api/auth/challenge', { method: 'POST', body: JSON.stringify({ address }) });
  }
  async authenticate(challenge_id: string, signature: string): Promise<{ token: string; address: string }> {
    return this.request('/api/auth/verify', { method: 'POST', body: JSON.stringify({ challenge_id, signature }) });
  }
  async createSession(user_address: string, budget: string): Promise<{session: SessionData}> {
    return this.request('/api/session', {method: 'POST', body: JSON.stringify({user_address, budget})});
  }
  async getSession(id: string): Promise<{session: SessionData}> {
    return this.request(`/api/session/${encodeURIComponent(id)}`);
  }
  async addPayment(id: string, payment: {recipient: string; amount: string; recipient_ens?: string}): Promise<{session: SessionData}> {
    return this.request(`/api/session/${encodeURIComponent(id)}/payment`, {method: 'POST', body: JSON.stringify(payment)});
  }
  async removePayment(id: string, paymentId: string): Promise<{session: SessionData}> {
    return this.request(`/api/session/${encodeURIComponent(id)}/payment/${encodeURIComponent(paymentId)}`, {method: 'DELETE'});
  }
  async prepareSession(id: string): Promise<{session: SessionData}> {
    return this.request(`/api/session/${encodeURIComponent(id)}/prepare`, {method: 'POST'});
  }
  async resetSession(id: string): Promise<{session: SessionData}> {
    return this.request(`/api/session/${encodeURIComponent(id)}/reset`, {method: 'POST'});
  }
  async finalizeSession(id: string, tx_hash: string): Promise<{session: SessionData}> {
    return this.request(`/api/session/${encodeURIComponent(id)}/finalize`, {method: 'POST', body: JSON.stringify({tx_hash})});
  }
  async settlementContract(): Promise<{contract: string | null}> {
    return this.request('/api/settlement/contract');
  }
  async configureSettlement(address: string): Promise<{contract: string}> {
    return this.request('/api/settlement/contract', {method: 'POST', body: JSON.stringify({address})});
  }
  async graphReview(ids: string[]): Promise<GraphReview> {
    const query = ids.length ? `?ids=${encodeURIComponent(ids.join(','))}` : '';
    return this.request(`/api/graph/review${query}`);
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
