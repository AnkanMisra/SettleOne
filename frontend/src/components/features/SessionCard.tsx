'use client';

import { type SessionData } from '@/lib/api';
import { formatUnits } from 'viem';

interface SessionCardProps {
  session: SessionData;
  onAddPayment: () => void;
  onFinalize: () => void;
  isLoading: boolean;
}

export function SessionCard({
  session,
  onAddPayment,
  onFinalize,
  isLoading,
}: SessionCardProps) {
  const formatAmount = (amount: string) => {
    try {
      return formatUnits(BigInt(amount), 6);
    } catch {
      return '0.00';
    }
  };

  const statusColors = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    settled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Active Session</h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium border ${
            statusColors[session.status]
          }`}
        >
          {session.status}
        </span>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Session ID</span>
          <span className="text-gray-300 font-mono text-xs">
            {session.id.slice(0, 8)}...{session.id.slice(-6)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total Amount</span>
          <span className="text-white font-medium">
            {formatAmount(session.total_amount)} USDC
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Payments</span>
          <span className="text-gray-300">{session.payments.length}</span>
        </div>
      </div>

      {session.payments.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-400 mb-3">
            Pending Payments
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {session.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm text-white">
                    {payment.recipient_ens || (
                      <>
                        {payment.recipient.slice(0, 6)}...
                        {payment.recipient.slice(-4)}
                      </>
                    )}
                  </span>
                  <span className="text-xs text-gray-500">
                    {payment.status}
                  </span>
                </div>
                <span className="text-sm font-medium text-white">
                  {formatAmount(payment.amount)} USDC
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onAddPayment}
          disabled={isLoading || session.status !== 'active'}
          className="flex-1 py-3 px-4 rounded-xl bg-gray-800 text-white font-medium
            hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Payment
        </button>
        <button
          onClick={onFinalize}
          disabled={
            isLoading ||
            session.payments.length === 0 ||
            session.status !== 'active'
          }
          className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium
            hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Settle All'}
        </button>
      </div>
    </div>
  );
}
