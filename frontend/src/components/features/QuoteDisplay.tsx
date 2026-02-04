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
  // Don't render anything if not cross-chain
  if (!isCrossChain) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl animate-pulse">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <span>Fetching cross-chain quote...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
        <div className="flex items-start gap-2">
          <span className="text-red-400 font-medium">Quote Error:</span>
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
        <p className="text-gray-400 text-sm">
          Enter amount to see cross-chain quote
        </p>
      </div>
    );
  }

  // Format amounts (USDC has 6 decimals)
  const fromAmount = formatUnits(BigInt(quote.from_amount), 6);
  const toAmount = formatUnits(BigInt(quote.to_amount), 6);
  const gasEstimate = quote.estimated_gas
    ? formatUnits(BigInt(quote.estimated_gas), 18)
    : null;

  // Calculate estimated time in human-readable format
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  // Calculate fee/slippage
  const fromNum = parseFloat(fromAmount);
  const toNum = parseFloat(toAmount);
  const fee = fromNum - toNum;
  const feePercent = ((fee / fromNum) * 100).toFixed(2);

  return (
    <div className="p-4 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-blue-400">
          Cross-Chain Quote
        </span>
        <span className="text-xs text-gray-400">via LI.FI</span>
      </div>

      <div className="space-y-3">
        {/* Amount breakdown */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">You send</span>
          <span className="text-white font-medium">
            {parseFloat(fromAmount).toFixed(2)} USDC
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Recipient gets</span>
          <span className="text-green-400 font-medium">
            {parseFloat(toAmount).toFixed(2)} USDC
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700" />

        {/* Fee info */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Bridge fee</span>
          <span className="text-yellow-400 text-sm">
            {fee.toFixed(4)} USDC ({feePercent}%)
          </span>
        </div>

        {/* Gas estimate if available */}
        {gasEstimate && parseFloat(gasEstimate) > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Est. gas</span>
            <span className="text-gray-300 text-sm">
              {parseFloat(gasEstimate).toFixed(6)} ETH
            </span>
          </div>
        )}

        {/* Estimated time */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Est. time</span>
          <span className="text-gray-300 text-sm">
            ~{formatTime(quote.estimated_time)}
          </span>
        </div>
      </div>
    </div>
  );
}
