// Type definitions for SettleOne

export interface SessionState {
  id: string;
  user: string;
  createdAt: number;
  active: boolean;
  payments: Payment[];
  totalAmount: bigint;
}

export interface Payment {
  id: string;
  recipient: string;
  recipientENS?: string;
  amount: bigint;
  status: 'pending' | 'confirmed' | 'settled';
  timestamp: number;
}

export interface PaymentRequest {
  readonly recipient: string;
  readonly recipientENS?: string;
  readonly amount: bigint;
  chainId: number;
}

export interface Settlement {
  recipient: string;
  amount: bigint;
}

export interface ENSResolutionResult {
  name: string;
  address: string | null;
  avatar?: string;
  isLoading: boolean;
  error?: string;
}

export interface LiFiQuote {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedGas: string;
  estimatedTime: number; // seconds
  route: unknown;
}

export interface ChainConfig {
  id: number;
  name: string;
  network: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts: {
    usdc: string;
    settlement?: string;
  };
}
