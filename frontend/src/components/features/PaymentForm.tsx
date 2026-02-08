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
  const [fromChainId, setFromChainId] = useState<number>(8453);
  const [toChainId, setToChainId] = useState<number>(8453);
  const [error, setError] = useState<string | null>(null);

  const { quote, isLoading: quoteLoading, error: quoteError, fetchQuote, clearQuote } = useQuote();

  const isCrossChain = useMemo(() => fromChainId !== toChainId, [fromChainId, toChainId]);

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
      try {
        const amountInBaseUnits = parseUnits(amountValue, 6).toString();
        fetchQuote({ fromChainId: fromChain, toChainId: toChain, amount: amountInBaseUnits });
      } catch {
        clearQuote();
      }
    },
    500
  );

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

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    let amountInBaseUnits: string;
    try {
      amountInBaseUnits = parseUnits(amount, 6).toString();
    } catch {
      setError('Invalid amount format');
      return;
    }

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
    <form onSubmit={handleSubmit} className="space-y-5">
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
        <label className="block text-xs text-gray-500 uppercase tracking-wider font-medium mb-2.5">
          Amount
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            className="w-full px-4 py-3.5 pr-20 rounded-xl border transition-all duration-200 text-sm
              bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]
              text-white placeholder-gray-600
              focus:border-indigo-500/40 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)]"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-semibold tracking-wide">
            USDC
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ChainSelector
          label="From"
          selectedChainId={fromChainId}
          onSelect={setFromChainId}
          excludeChainId={undefined}
        />
        <ChainSelector
          label="To"
          selectedChainId={toChainId}
          onSelect={setToChainId}
          excludeChainId={undefined}
        />
      </div>

      {isCrossChain && (
        <div className="flex items-center gap-2 text-xs">
          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
          <span className="text-amber-300/80">Cross-chain via LI.FI</span>
        </div>
      )}

      <QuoteDisplay
        quote={quote}
        isLoading={quoteLoading}
        error={quoteError}
        isCrossChain={isCrossChain}
      />

      {error && (
        <div className="p-3 rounded-xl bg-red-500/[0.06] border border-red-500/[0.12] text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200
              bg-white/[0.04] border border-white/[0.06] text-gray-400
              hover:bg-white/[0.07] hover:text-gray-300"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading || !recipient || !amount}
          className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200
            bg-indigo-500 text-white hover:bg-indigo-400
            shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:shadow-[0_0_28px_rgba(99,102,241,0.35)]
            disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Adding...
            </span>
          ) : (
            'Add Payment'
          )}
        </button>
      </div>
    </form>
  );
}
