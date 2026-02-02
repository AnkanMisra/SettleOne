'use client';

import { useState } from 'react';
import { parseUnits } from 'viem';
import { ENSInput } from './ENSInput';
import { ChainSelector } from './ChainSelector';

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
  const [fromChainId, setFromChainId] = useState<number>(1); // Default to Ethereum
  const [toChainId, setToChainId] = useState<number>(42161); // Default to Arbitrum
  const [error, setError] = useState<string | null>(null);

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
          excludeChainId={toChainId}
        />
        <ChainSelector
          label="To Chain"
          selectedChainId={toChainId}
          onSelect={setToChainId}
          excludeChainId={fromChainId}
        />
      </div>

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
