'use client';
import { useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';
import { ConnectButton } from '@/components/ConnectButton';
import { PaymentForm } from '@/components/features/PaymentForm';
import { SessionCard } from '@/components/features/SessionCard';
import { IdentityPanel } from '@/components/features/IdentityPanel';
import { GraphReviewPanel } from '@/components/features/GraphReview';
import { useSession } from '@/hooks/useSession';
import { useDeploySettlement } from '@/hooks/useDeploySettlement';
import { retainedTxKey, useSettlement } from '@/hooks/useSettlement';
import { arcTestnet } from '@/lib/wagmi';

const button = 'rounded-xl bg-indigo-500 px-5 py-3 text-white disabled:opacity-40';
const input = 'w-full rounded-xl border border-white/20 bg-white/5 p-3';

export default function Home() {
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const flow = useSession();
  const settlement = useSettlement();
  const deploy = useDeploySettlement();
  const [budget, setBudget] = useState('10');
  const [error, setError] = useState('');
  const [approved, setApproved] = useState<string | null>(null);
  const session = flow.session;
  const busy = flow.isLoading || settlement.isPending || deploy.busy;

  function units(value: string) {
    if (!/^\d+(\.\d{1,6})?$/.test(value) || parseUnits(value, 6) <= BigInt(0)) {
      throw new Error('Enter a positive amount with at most 6 decimal places');
    }
    return parseUnits(value, 6).toString();
  }

  async function act(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    }
  }

  return (
    <div className="min-h-screen text-white">
      <header className="mx-auto flex max-w-4xl items-center justify-between p-6">
        <h1 className="text-xl font-semibold">SettleOne</h1>
        <ConnectButton />
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div>
          <p className="text-sm text-indigo-300">ETHOnline 2026 · Continuity</p>
          <h2 className="mt-3 text-4xl font-semibold">Review every payment. Settle one batch.</h2>
          <p className="mt-4 text-gray-400">
            Prepare contractor or AI-vendor payments without moving funds. Your wallet signs the exact Arc Testnet
            batch. Yellow Network is not part of this payment path.
          </p>
        </div>
        {isConnected && chainId !== arcTestnet.id && (
          <button className={button} onClick={() => act(() => switchChainAsync({ chainId: arcTestnet.id }))}>
            Switch to Arc Testnet
          </button>
        )}
        {!isConnected ? (
          <p className="glass rounded-xl p-6">Connect your wallet to prepare payments.</p>
        ) : !session ? (
          <section className="glass space-y-4 rounded-2xl p-6">
            <label className="block">
              Approved budget · USDC
              <input className={input} value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" />
            </label>
            <div className="flex flex-wrap gap-3">
              <button className={button} disabled={busy} onClick={() => act(() => flow.createSession(units(budget)))}>
                Sign in and create draft
              </button>
              <button className={button} disabled={busy} onClick={() => act(flow.restoreSession)}>
                Restore saved session
              </button>
            </div>
            <p className="text-sm text-gray-400">
              The sign-in message authenticates your session. It does not authorize a transfer.
            </p>
            <p className="text-sm text-gray-400">
              After sign-in, deploy SessionSettlement from this wallet if the backend has no Arc contract yet.
            </p>
          </section>
        ) : (
          <section className="glass space-y-5 rounded-2xl p-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-400">
                Arc settlement contract:{' '}
                {deploy.contract || 'not configured'}
              </p>
              {!deploy.contract && (
                <button
                  className={button}
                  disabled={busy || chainId !== arcTestnet.id}
                  onClick={() =>
                    act(async () => {
                      await deploy.deploy();
                    })
                  }
                >
                  Deploy SessionSettlement on Arc Testnet
                </button>
              )}
              {deploy.txHash && (
                <a
                  className="block break-all text-indigo-300 text-sm"
                  href={`${arcTestnet.blockExplorers.default.url}/tx/${deploy.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {deploy.txHash}
                </a>
              )}
            </div>
            <SessionCard
              session={session}
              isLoading={busy}
              chainId={chainId}
              approvedDraftId={approved}
              onApprovedDraftIdChange={setApproved}
              onRemovePayment={(paymentId) => act(() => flow.removePayment(paymentId))}
              onPrepare={() => act(flow.prepareSession)}
              onReset={() =>
                act(async () => {
                  await flow.resetSession();
                  setApproved(null);
                })
              }
              onSettle={() => act(async () => { await settlement.settle(session, flow.finalizeSession); await flow.refreshSession(); })}
              onVerify={() =>
                act(async () => {
                  const hash = session.tx_hash || localStorage.getItem(retainedTxKey(session.id));
                  if (!hash) throw new Error('No submitted transaction to verify');
                  await flow.finalizeSession(hash);
                })
              }
            />
            {session.status === 'draft' && (
              <PaymentForm
                isLoading={busy}
                onSubmit={async (data) => {
                  setError('');
                  const saved = await flow.addPayment(data.recipient, data.amount, data.recipientENS);
                  if (!saved) throw new Error(flow.error || 'Payment was not added');
                }}
              />
            )}
          </section>
        )}
        {settlement.progress && <p role="status">{settlement.progress}</p>}
        {(error || flow.error || settlement.error) && (
          <p role="alert" className="break-words rounded-xl border border-red-400/30 p-4 text-red-300">
            {error || flow.error || settlement.error}
          </p>
        )}
        <IdentityPanel />
        <GraphReviewPanel />
        <p className="text-sm text-gray-500">
          Testnet payments only. USDC also pays Arc gas.{' '}
          <a className="underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">
            Fund your test wallet
          </a>
          .
        </p>
      </main>
    </div>
  );
}
