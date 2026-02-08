'use client';

import { type SessionData } from '@/lib/api';
import { formatUnits } from 'viem';

interface SessionCardProps {
  session: SessionData;
  onAddPayment: () => void;
  onRemovePayment: (paymentId: string) => void;
  onFinalize: () => void;
  isLoading: boolean;
}

export function SessionCard({
  session,
  onAddPayment,
  onRemovePayment,
  onFinalize,
  isLoading,
}: SessionCardProps) {
  const formatAmount = (amount: string) => {
    try {
      const val = parseFloat(formatUnits(BigInt(amount), 6));
      if (val === 0) return '0.00';
      if (val < 0.01) return val.toFixed(6); // Show more precision for small amounts
      return val.toFixed(2);
    } catch {
      return '0.00';
    }
  };

  const shortenAddress = (address: string) => {
    if (!address) return '';
    if (address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const statusConfig = {
    active: { dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]', text: 'text-emerald-400', bg: 'bg-emerald-500/[0.08] border-emerald-500/[0.15]' },
    pending: { dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]', text: 'text-amber-400', bg: 'bg-amber-500/[0.08] border-amber-500/[0.15]' },
    settled: { dot: 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]', text: 'text-indigo-400', bg: 'bg-indigo-500/[0.08] border-indigo-500/[0.15]' },
    cancelled: { dot: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]', text: 'text-red-400', bg: 'bg-red-500/[0.08] border-red-500/[0.15]' },
  };

  const status = statusConfig[session.status];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 border border-indigo-500/[0.1] flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="M2 10h20" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Session</h3>
            <p className="text-xs text-gray-500 font-mono">{session.id.slice(0, 8)}...{session.id.slice(-4)}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.bg} ${status.text}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {session.status}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <p className="text-xs text-gray-500 mb-1">Total</p>
          <p className="text-lg font-semibold text-white tracking-tight">
            {formatAmount(session.total_amount)}
            <span className="text-sm text-gray-500 font-normal ml-1">USDC</span>
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <p className="text-xs text-gray-500 mb-1">Payments</p>
          <p className="text-lg font-semibold text-white tracking-tight">
            {session.payments.length}
            <span className="text-sm text-gray-500 font-normal ml-1">queued</span>
          </p>
        </div>
      </div>

      {/* Payment list */}
      {session.payments.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Payments</p>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {session.payments.map((payment, i) => (
              <div
                key={payment.id}
                className="group flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.03] transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-indigo-400">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate" title={payment.recipient}>
                      {payment.recipient_ens || shortenAddress(payment.recipient)}
                    </p>
                    <p className="text-xs text-gray-600">{payment.status}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-white tabular-nums flex-shrink-0 whitespace-nowrap">
                    {formatAmount(payment.amount)} <span className="text-gray-500 font-normal">USDC</span>
                  </span>
                  
                  {session.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => onRemovePayment(payment.id)}
                      disabled={isLoading}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Remove payment"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onAddPayment}
          disabled={isLoading || session.status !== 'active'}
          className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200
            bg-white/[0.04] border border-white/[0.06] text-gray-300
            hover:bg-white/[0.07] hover:text-white hover:border-white/[0.1]
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Add Payment
        </button>
        <button
          onClick={onFinalize}
          disabled={isLoading || session.payments.length === 0 || session.status !== 'active'}
          className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200
            bg-indigo-500 text-white
            hover:bg-indigo-400
            shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:shadow-[0_0_28px_rgba(99,102,241,0.35)]
            disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            'Settle All On-Chain'
          )}
        </button>
      </div>
    </div>
  );
}
