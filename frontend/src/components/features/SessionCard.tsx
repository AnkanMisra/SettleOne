'use client';

import { type SessionData } from '@/lib/api';
import { formatUnits } from 'viem';
import { arcTestnet } from '@/lib/wagmi';

interface SessionCardProps {
  session: SessionData;
  isLoading: boolean;
  chainId?: number;
  approvedDraftId: string | null;
  onApprovedDraftIdChange: (draftId: string | null) => void;
  onRemovePayment: (paymentId: string) => void;
  onPrepare: () => void;
  onReset: () => void;
  onSettle: () => void;
  onVerify: () => void;
}

const statusStyles: Record<
  SessionData['status'],
  { dot: string; text: string; bg: string }
> = {
  signing: {dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10'},
  draft: {
    dot: 'bg-gray-400',
    text: 'text-gray-300',
    bg: 'bg-white/[0.04] border-white/[0.08]',
  },
  awaiting_approval: {
    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]',
    text: 'text-amber-400',
    bg: 'bg-amber-500/[0.08] border-amber-500/[0.15]',
  },
  submitted: {
    dot: 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]',
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/[0.08] border-indigo-500/[0.15]',
  },
  confirmed: {
    dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/[0.08] border-emerald-500/[0.15]',
  },
  failed: {
    dot: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]',
    text: 'text-red-400',
    bg: 'bg-red-500/[0.08] border-red-500/[0.15]',
  },
};

function formatAmount(amount: string, decimals: number) {
  try {
    return formatUnits(BigInt(amount), decimals);
  } catch {
    return amount;
  }
}

export function SessionCard({
  session,
  isLoading,
  chainId,
  approvedDraftId,
  onApprovedDraftIdChange,
  onRemovePayment,
  onPrepare,
  onReset,
  onSettle,
  onVerify,
}: SessionCardProps) {
  const status = statusStyles[session.status];
  const onArc = chainId === arcTestnet.id;
  const draft = session.prepared;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Payment batch</h3>
          <p className="text-xs text-gray-500 font-mono break-all">Session {session.id}</p>
        </div>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.bg} ${status.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {session.status.replaceAll('_', ' ')}
        </span>
      </div>

      <p className="text-sm text-gray-400">
        Arc Testnet · USDC · {session.token_decimals} token decimals
      </p>
      <p className="break-all text-xs text-gray-500">Token: {session.token}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <p className="text-xs text-gray-500 mb-1">Total</p>
          <p className="text-lg font-semibold text-white tracking-tight">
            {formatAmount(session.total_amount, session.token_decimals)}
            <span className="text-sm text-gray-500 font-normal ml-1">USDC</span>
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <p className="text-xs text-gray-500 mb-1">Budget</p>
          <p className="text-lg font-semibold text-white tracking-tight">
            {formatAmount(session.budget, session.token_decimals)}
            <span className="text-sm text-gray-500 font-normal ml-1">USDC</span>
          </p>
        </div>
      </div>

      {session.payments.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="py-3 text-xs text-gray-500 font-medium">Pinned recipient</th>
                <th className="text-xs text-gray-500 font-medium">USDC</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {session.payments.map((payment) => (
                <tr key={payment.id} className="border-t border-white/10">
                  <td className="py-3">
                    {payment.recipient_ens && <div>{payment.recipient_ens}</div>}
                    <code className="break-all text-xs text-gray-400">{payment.recipient}</code>
                  </td>
                  <td>{formatAmount(payment.amount, session.token_decimals)}</td>
                  <td>
                    {session.status === 'draft' && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => onRemovePayment(payment.id)}
                        className="text-sm text-gray-400 hover:text-red-400"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {session.status === 'draft' && (
        <button
          type="button"
          onClick={onPrepare}
          disabled={isLoading || session.payments.length === 0}
          className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-indigo-500 text-white disabled:opacity-30"
        >
          Prepare exact preview
        </button>
      )}

      {draft && (
        <div className="space-y-3 rounded-xl border border-indigo-400/40 p-4">
          <p className="text-sm font-medium text-white">Exact settlement preview</p>
          <p className="break-all text-xs text-gray-400">Settlement contract: {draft.contract}</p>
          <p className="text-sm">Chain: Arc Testnet ({session.chain_id})</p>
          <p className="text-sm">Token: USDC ({session.token})</p>
          <p className="text-sm">Expires {new Date(draft.expires_at * 1000).toLocaleString()}</p>
          <p className="text-sm">
            Onchain total limit: {formatAmount(draft.total_limit, session.token_decimals)} USDC
          </p>
          <ul className="text-sm space-y-1">
            {session.payments.map((payment) => (
              <li key={payment.id} className="break-all">
                {payment.recipient} · {formatAmount(payment.amount, session.token_decimals)} USDC
              </li>
            ))}
          </ul>
          {session.status === 'awaiting_approval' && (
            <>
              <label className="flex gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={approvedDraftId === draft.draft_id}
                  onChange={(e) =>
                    onApprovedDraftIdChange(e.target.checked ? draft.draft_id : null)
                  }
                />
                I approve the exact recipients, amounts, chain, token and total shown above.
              </label>
              <button
                type="button"
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-indigo-500 text-white disabled:opacity-30"
                disabled={
                  isLoading || approvedDraftId !== draft.draft_id || !onArc
                }
                onClick={onSettle}
              >
                Approve USDC and sign batch
              </button>
              {!onArc && (
                <p className="text-xs text-amber-300">Switch to Arc Testnet before signing.</p>
              )}
            </>
          )}
        </div>
      )}

      {session.status === 'signing' && <p className="text-amber-300 text-sm">Signing is locked across tabs. Verify any retained transaction. If signing was rejected, reset after the expiry shown above; Arc must confirm the draft was not paid.</p>}
      {(session.status === 'awaiting_approval' || session.status === 'signing' || session.status === 'failed') && (
        <button
          type="button"
          disabled={isLoading}
          onClick={onReset}
          className="text-sm text-gray-400 hover:text-white"
        >
          Return to editing · invalidates this preview
        </button>
      )}

      <button
        type="button"
        className="block text-indigo-300 text-sm"
        disabled={isLoading}
        onClick={onVerify}
      >
        Verify receipt
      </button>

      {session.tx_hash && (
        <a
          className="block break-all text-indigo-300 text-sm"
          href={`${arcTestnet.blockExplorers.default.url}/tx/${session.tx_hash}`}
          target="_blank"
          rel="noreferrer"
        >
          {session.tx_hash}
        </a>
      )}
      {session.failure && <p role="alert">{session.failure}</p>}
      {session.status === 'confirmed' && (
        <p className="text-green-300">Confirmed by backend receipt and payment-event verification.</p>
      )}
    </div>
  );
}
