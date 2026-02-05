'use client';

import { useState, useEffect, useMemo } from 'react';
import { parseUnits } from 'viem';
import { ENSInput } from './ENSInput';
import { ChainSelector } from './ChainSelector';
import { QuoteDisplay } from './QuoteDisplay';
import { useQuote } from '@/hooks/useQuote';
import { useDebouncedCallback } from '@/hooks/useDebounce';

interface PaymentFormProps {
  onSubmit: (data: {
    recipient: string;
    recipientENS?: string;
    amount: string;
    fromChainId: number;
    toChainId: number;
  }) => void;
  isLoading: boolean;
  onCancel?: () => void;
}

export function PaymentForm({ onSubmit, isLoading, onCancel }: PaymentFormProps) {
  const [recipient, setRecipient] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [fromChainId, setFromChainId] = useState<number>(8453); // Default to Base
  const [toChainId, setToChainId] = useState<number>(8453); // Default to Base (same chain)
  const [error, setError] = useState<string | null>(null);

  const { quote, isLoading: quoteLoading, error: quoteError, fetchQuote, clearQuote } = useQuote();

  // Check if it's a cross-chain transfer
  const isCrossChain = useMemo(() => fromChainId !== toChainId, [fromChainId, toChainId]);

  // Debounced quote fetch for cross-chain
  const debouncedFetchQuote = useDebouncedCallback(
    (amountValue: string, fromChain: number, toChain: number) => {
      if (fromChain === toChain) {
        clearQuote();
        return;
      }

      const amountNum = parseFloat(amountValue);
      if (isNaN(amountNum) || amountNum <= 0) {
        clearQuote();
        return;
      }

      // Convert to base units (6 decimals for USDC)
      try {
        const amountInBaseUnits = parseUnits(amountValue, 6).toString();
        fetchQuote({
          fromChainId: fromChain,
          toChainId: toChain,
          amount: amountInBaseUnits,
        });
      } catch {
        // Invalid amount format, clear any stale quote
        clearQuote();
      }
    },
    500
  );

  // Fetch quote when relevant inputs change
  useEffect(() => {
    if (isCrossChain && amount) {
      debouncedFetchQuote(amount, fromChainId, toChainId);
    } else {
      clearQuote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromChainId, toChainId, isCrossChain]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // Convert to USDC base units (6 decimals)
    let amountInBaseUnits: string;
    try {
      amountInBaseUnits = parseUnits(amount, 6).toString();
    } catch {
      setError('Invalid amount format');
      return;
    }

    // Use resolved address or direct input
    const finalRecipient = resolvedAddress || recipient;
    if (!finalRecipient || !finalRecipient.startsWith('0x')) {
      setError('Please enter a valid address or ENS name');
      return;
    }

    onSubmit({
      recipient: finalRecipient,
      recipientENS: resolvedAddress ? recipient : undefined,
      amount: amountInBaseUnits,
      fromChainId,
      toChainId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ENSInput
        value={recipient}
        onChange={(value, resolved) => {
          setRecipient(value);
          setResolvedAddress(resolved);
        }}
        placeholder="vitalik.eth or 0x..."
        label="Recipient"
      />

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Amount (USDC)
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            className="w-full px-4 py-3 pr-20 bg-gray-900 border border-gray-700 rounded-xl
              text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
              transition-colors"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
            USDC
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChainSelector
          label="From Chain"
          selectedChainId={fromChainId}
          onSelect={setFromChainId}
          excludeChainId={undefined}
        />
        <ChainSelector
          label="To Chain"
          selectedChainId={toChainId}
          onSelect={setToChainId}
          excludeChainId={undefined}
        />
      </div>

      {/* Cross-chain indicator */}
      {isCrossChain && (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-yellow-400 rounded-full" />
          <span className="text-yellow-400">Cross-chain transfer via LI.FI</span>
        </div>
      )}

      {/* Quote Display for cross-chain */}
      <QuoteDisplay
        quote={quote}
        isLoading={quoteLoading}
        error={quoteError}
        isCrossChain={isCrossChain}
      />

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl bg-gray-800 text-white font-medium
              hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading || !recipient || !amount}
          className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium
            hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Adding...' : 'Add Payment'}
        </button>
      </div>
    </form>
  );
}
