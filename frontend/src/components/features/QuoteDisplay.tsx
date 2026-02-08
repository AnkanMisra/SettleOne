'use client';

import type { QuoteData } from '@/lib/api';
import { formatUnits } from 'viem';

interface QuoteDisplayProps {
  quote: QuoteData | null;
  isLoading: boolean;
  error: string | null;
  isCrossChain: boolean;
}

export function QuoteDisplay({
  quote,
  isLoading,
  error,
  isCrossChain,
}: QuoteDisplayProps) {
  if (!isCrossChain) return null;

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-3.5 h-3.5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          Fetching cross-chain quote...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-500/[0.05] border border-red-500/[0.1]">
        <span className="text-red-400 text-sm">{error}</span>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        <p className="text-gray-600 text-sm">Enter amount for cross-chain quote</p>
      </div>
    );
  }

  const safeParseBigInt = (value: string | undefined | null): bigint | null => {
    if (!value || typeof value !== 'string') return null;
    if (!/^\d+$/.test(value)) return null;
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  };

  const fromAmountBigInt = safeParseBigInt(quote.from_amount);
  const toAmountBigInt = safeParseBigInt(quote.to_amount);
  const gasEstimateBigInt = safeParseBigInt(quote.estimated_gas);

  if (fromAmountBigInt === null || toAmountBigInt === null) {
    return (
      <div className="p-4 rounded-xl bg-red-500/[0.05] border border-red-500/[0.1]">
        <span className="text-red-400 text-sm">Invalid quote data</span>
      </div>
    );
  }

  const fromAmount = formatUnits(fromAmountBigInt, 6);
  const toAmount = formatUnits(toAmountBigInt, 6);
  const gasEstimate = gasEstimateBigInt !== null ? formatUnits(gasEstimateBigInt, 18) : null;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  const fromNum = parseFloat(fromAmount);
  const toNum = parseFloat(toAmount);
  const fee = fromNum - toNum;
  const feePercent = fromNum > 0 ? ((fee / fromNum) * 100).toFixed(2) : '0.00';
  const isBonus = fee < 0;

  return (
    <div className="p-4 rounded-xl bg-indigo-500/[0.04] border border-indigo-500/[0.1]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Quote</span>
        <span className="text-[10px] text-gray-600">via LI.FI</span>
      </div>

      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Send</span>
          <span className="text-white font-medium tabular-nums">{parseFloat(fromAmount).toFixed(2)} USDC</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-500">Receive</span>
          <span className="text-emerald-400 font-medium tabular-nums">{parseFloat(toAmount).toFixed(2)} USDC</span>
        </div>

        <div className="border-t border-white/[0.04] my-1" />

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">{isBonus ? 'Bonus' : 'Bridge fee'}</span>
          <span className={isBonus ? 'text-emerald-400' : 'text-amber-400'}>
            {isBonus ? '+' : ''}{Math.abs(fee).toFixed(4)} USDC ({isBonus ? '+' : ''}{feePercent}%)
          </span>
        </div>

        {gasEstimate && parseFloat(gasEstimate) > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Gas</span>
            <span className="text-gray-400 tabular-nums">{parseFloat(gasEstimate).toFixed(6)} ETH</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Time</span>
          <span className="text-gray-400">~{formatTime(quote.estimated_time)}</span>
        </div>
      </div>
    </div>
  );
}
