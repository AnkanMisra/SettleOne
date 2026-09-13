'use client';

import { useEffect, useState } from 'react';
import { isAddress, parseUnits } from 'viem';
import { ENSInput } from './ENSInput';

interface PaymentFormProps {
  onSubmit: (data: {
    recipient: string;
    recipientENS?: string;
    amount: string;
  }) => Promise<unknown> | void;
  isLoading: boolean;
  onCancel?: () => void;
  suggestedRecipient?: string;
}

export function PaymentForm({ onSubmit, isLoading, onCancel, suggestedRecipient }: PaymentFormProps) {
  const [recipient, setRecipient] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (suggestedRecipient) {
      setRecipient(suggestedRecipient);
      setResolvedAddress(suggestedRecipient);
    }
  }, [suggestedRecipient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let amountInBaseUnits: string;
    try {
      if (!/^\d+(\.\d{1,6})?$/.test(amount) || parseUnits(amount, 6) <= BigInt(0)) {
        throw new Error('Enter a positive amount with at most 6 decimal places');
      }
      amountInBaseUnits = parseUnits(amount, 6).toString();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid amount format');
      return;
    }

    const finalRecipient = resolvedAddress || recipient;
    if (!isAddress(finalRecipient) || /^0x0{40}$/i.test(finalRecipient)) {
      setError('Enter a nonzero recipient address, or a Sepolia ENS name that resolves to one');
      return;
    }

    try {
      await onSubmit({
        recipient: finalRecipient,
        recipientENS: resolvedAddress && recipient.endsWith('.eth') ? recipient : undefined,
        amount: amountInBaseUnits,
      });
      setRecipient('');
      setResolvedAddress(null);
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add payment');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-xs text-gray-500">
        Arc Testnet only. Identity names resolve on Sepolia and are pinned to an address before payment. These are not one atomic cross-chain transaction.
      </p>
      <ENSInput
        value={recipient}
        onChange={(value, resolved) => {
          setRecipient(value);
          setResolvedAddress(resolved);
        }}
        placeholder="vendor.eth or 0x..."
        label="Recipient"
      />

      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-wider font-medium mb-2.5">
          Approved invoice amount
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
          {isLoading ? 'Adding...' : 'Add payment'}
        </button>
      </div>
    </form>
  );
}
