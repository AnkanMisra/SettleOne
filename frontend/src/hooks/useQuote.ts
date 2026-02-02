'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { api, type QuoteData } from '@/lib/api';

// Chain ID to LI.FI chain key mapping
const CHAIN_KEY_MAP: Record<number, string> = {
  1: 'ETH',
  10: 'OPT',
  42161: 'ARB',
  137: 'POL',
  8453: 'BAS',
  11155111: 'SEP', // Sepolia
};

// Common USDC addresses
const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
};

export interface UseQuoteParams {
  fromChainId: number;
  toChainId: number;
  amount: string; // in USDC (6 decimals)
}

export interface UseQuoteReturn {
  quote: QuoteData | null;
  isLoading: boolean;
  error: string | null;
  fetchQuote: (params: UseQuoteParams) => Promise<void>;
  clearQuote: () => void;
}

export function useQuote(): UseQuoteReturn {
  const { address } = useAccount();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuote = useCallback(
    async (params: UseQuoteParams) => {
      const fromChainKey = CHAIN_KEY_MAP[params.fromChainId];
      const toChainKey = CHAIN_KEY_MAP[params.toChainId];

      if (!fromChainKey || !toChainKey) {
        setError('Unsupported chain');
        return;
      }

      const fromToken = USDC_ADDRESSES[params.fromChainId];
      const toToken = USDC_ADDRESSES[params.toChainId];

      if (!fromToken || !toToken) {
        setError('USDC not available on selected chain');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const quoteData = await api.getQuote({
          fromChain: fromChainKey,
          toChain: toChainKey,
          fromToken,
          toToken,
          fromAmount: params.amount,
          fromAddress: address,
        });

        if (quoteData.error) {
          setError(quoteData.error);
          setQuote(null);
        } else {
          setQuote(quoteData);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to fetch quote';
        setError(message);
        setQuote(null);
      } finally {
        setIsLoading(false);
      }
    },
    [address]
  );

  const clearQuote = useCallback(() => {
    setQuote(null);
    setError(null);
  }, []);

  return {
    quote,
    isLoading,
    error,
    fetchQuote,
    clearQuote,
  };
}
