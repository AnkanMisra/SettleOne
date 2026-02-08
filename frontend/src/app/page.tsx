'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import toast from 'react-hot-toast';
import { ConnectButton } from '@/components/ConnectButton';
import { SessionCard } from '@/components/features/SessionCard';
import { PaymentForm } from '@/components/features/PaymentForm';
import { useSession } from '@/hooks/useSession';
import { useSettlement } from '@/hooks/useSettlement';
import { useYellow } from '@/hooks/useYellow';
import { SESSION_SETTLEMENT_ADDRESSES } from '@/lib/contracts';

type ViewMode = 'home' | 'payment' | 'approving' | 'settling';

function getExplorerUrl(chainId: number, hash: string): string {
  const explorers: Record<number, string> = {
    84532: 'https://sepolia.basescan.org',
    8453: 'https://basescan.org',
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
  };
  const base = explorers[chainId] || 'https://sepolia.basescan.org';
  return `${base}/tx/${hash}`;
}

export default function Home() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [settlementStatus, setSettlementStatus] = useState<string>('');

  const {
    session,
    isLoading,
    error,
    createSession,
    addPayment,
    removePayment,
    finalizeSession,
  } = useSession();

  const {
    isApproving,
    isSettling,
    isPending,
    error: settlementError,
    approveUSDC,
    settleSessionBatch,
    getContractAddress,
    checkAllowance,
    checkBalance,
    checkIsSettled,
    mintTestUSDC,
    isTestnet,
  } = useSettlement();

  const {
    isConnected: yellowConnected,
    isConnecting: yellowConnecting,
    connectionError: yellowError,
    sessionId: yellowSessionId,
    payments: yellowPayments,
    totalSent: yellowTotalSent,
    connect: connectYellow,
    sendPayment: sendYellowPayment,
  } = useYellow();

  useEffect(() => {
    if (isConnected && !yellowConnected && !yellowConnecting) {
      // Optional: auto-connect to Yellow Network
    }
  }, [isConnected, yellowConnected, yellowConnecting]);

  const handleStartSession = async () => {
    if (!yellowConnected) {
      await connectYellow();
    }
    const sessionId = await createSession();
    if (sessionId) {
      setViewMode('payment');
    }
  };

  const handleAddPayment = async (data: {
    recipient: string;
    recipientENS?: string;
    amount: string;
    fromChainId: number;
    toChainId: number;
  }) => {
    if (yellowConnected && yellowSessionId) {
      const yellowSuccess = await sendYellowPayment(data.recipient, data.amount);
      if (!yellowSuccess) {
        console.warn('[Yellow] Off-chain payment failed, falling back to backend only');
      }
    }
    const success = await addPayment(data.recipient, data.amount, data.recipientENS);
    if (success) {
      setViewMode('home');
    }
  };

  const handleRemovePayment = async (paymentId: string) => {
    const success = await removePayment(paymentId);
    if (!success) {
      // Error is handled by useSession hook and displayed in UI
    }
  };

  const handleFinalize = async () => {
    if (!session || session.payments.length === 0) return;

    const contractAddress = getContractAddress();
    if (!contractAddress) {
      toast.error(`Contract not deployed on this network (Chain ID: ${chainId}). Please switch to Base Sepolia or Sepolia.`);
      return;
    }

    try {
      const totalAmount = session.total_amount;

      // Step 0: Check if already settled
      const isAlreadySettled = await checkIsSettled(session.id);
      if (isAlreadySettled) {
        await finalizeSession(); // Sync backend
        toast.success('Session was already settled on-chain. Syncing status...');
        setSettlementStatus('');
        setViewMode('home');
        return;
      }

      if (BigInt(totalAmount) === BigInt(0)) {
        toast.error('Total amount is zero. Please add payments with a valid amount.');
        return;
      }

      // Step 1: Check USDC balance
      setSettlementStatus('Checking USDC balance...');
      setViewMode('approving');

      let hasBalance = await checkBalance(totalAmount);
      if (!hasBalance) {
        if (isTestnet) {
          // Auto-mint on testnet
          setSettlementStatus('Minting test USDC (1000 USDC buffer)...');
          const minted = await mintTestUSDC(totalAmount);
          if (!minted) {
            toast.error('Failed to mint test USDC. Please try again.');
            setSettlementStatus('');
            setViewMode('home');
            return;
          }
          
          // Verify balance updated
          setSettlementStatus('Verifying balance...');
          // Add a small delay for node indexing just in case
          await new Promise(r => setTimeout(r, 2000));
          hasBalance = await checkBalance(totalAmount);
          
          if (!hasBalance) {
            toast.error('Mint succeeded but balance still insufficient. Please try again.');
            setSettlementStatus('');
            setViewMode('home');
            return;
          }
          
          toast.success('Test USDC minted successfully!');
        } else {
          toast.error('Insufficient USDC balance. Please fund your wallet.');
          setSettlementStatus('');
          setViewMode('home');
          return;
        }
      }

      // Step 2: Check and approve USDC allowance
      setSettlementStatus('Checking USDC approval...');

      const hasAllowance = await checkAllowance(totalAmount);
      if (!hasAllowance) {
        setSettlementStatus('Approving USDC...');
        const approved = await approveUSDC(totalAmount);
        if (!approved) {
          setSettlementStatus('USDC approval failed');
          setViewMode('home');
          return;
        }
      }

      // Step 3: Settle on-chain
      setSettlementStatus('Settling on-chain...');
      setViewMode('settling');

      const settlements = session.payments.map((payment) => ({
        recipient: payment.recipient,
        amount: BigInt(payment.amount),
      }));

      const hash = await settleSessionBatch(session.id, settlements);

      if (hash) {
        await finalizeSession(hash);
        setSettlementStatus('');
        setViewMode('home');

        const explorerUrl = getExplorerUrl(chainId, hash);
        toast.success(
          (t) => (
            <span
              onClick={() => {
                window.open(explorerUrl, '_blank');
                toast.dismiss(t.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              Settlement complete! TX: {hash.slice(0, 10)}...{hash.slice(-8)}
              <br />
              <span style={{ fontSize: '0.75rem', textDecoration: 'underline', opacity: 0.7 }}>
                View on Explorer
              </span>
            </span>
          ),
          { duration: 8000 }
        );
      } else {
        setSettlementStatus('Settlement failed');
        setViewMode('home');
      }
    } catch (err) {
      console.error('Settlement error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Settlement failed: ${message}`);
      setSettlementStatus('');
      setViewMode('home');
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[60%] h-[60%] rounded-full bg-indigo-600/[0.07] blur-[120px]" />
        <div className="absolute -bottom-[30%] -right-[20%] w-[50%] h-[50%] rounded-full bg-violet-600/[0.05] blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-600/[0.04] blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">SettleOnce</h1>
              <p className="text-[11px] text-gray-500 -mt-0.5 tracking-wide">Batch payments, one settlement</p>
            </div>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 max-w-xl mx-auto px-6 pt-16 pb-24">
        {/* Hero */}
        {!session && viewMode === 'home' && (
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/[0.08] border border-indigo-500/[0.15] text-indigo-400 text-xs font-medium mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-subtle-pulse" />
              Built on Yellow Network + Circle
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white tracking-tight leading-[1.1]">
              Send USDC to anyone.<br />
              <span className="text-gradient">Settle once.</span>
            </h2>
            <p className="text-gray-400 text-base max-w-lg mx-auto leading-relaxed">
              Batch multiple payments off-chain, then settle everything on-chain in a single transaction. Pay with ENS names.
            </p>
          </div>
        )}

        {/* Main Card */}
        <div className="glass rounded-2xl glow-sm overflow-hidden">
          {!isConnected ? (
            /* Not connected state */
            <div className="p-8 md:p-10">
              <div className="text-center flex flex-col items-center">
                <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/[0.15] flex items-center justify-center animate-float">
                  <svg className="w-7 h-7 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="12" rx="3" />
                    <path d="M16 12h.01" />
                    <path d="M2 10h20" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Connect your wallet</h3>
                <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto text-center">
                  Connect MetaMask or any injected wallet to start sending payments
                </p>
                <ConnectButton />
              </div>
            </div>
          ) : viewMode === 'payment' ? (
            /* Payment form */
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setViewMode('home')}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-lg font-semibold text-white">Add Payment</h3>
              </div>
              <PaymentForm
                onSubmit={handleAddPayment}
                isLoading={isLoading}
                onCancel={() => setViewMode('home')}
              />
            </div>
          ) : session ? (
            /* Active session */
            <div className="p-6 md:p-8">
              {/* Yellow Network Status */}
              {yellowConnected && (
                <div className="mb-5 p-3.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/[0.12]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)] animate-subtle-pulse" />
                    <span className="text-amber-300/90 text-sm font-medium">
                      Yellow Network
                      {yellowSessionId && (
                        <span className="text-amber-400/50 font-mono ml-1.5">
                          {yellowSessionId.slice(0, 8)}...
                        </span>
                      )}
                    </span>
                  </div>
                  {yellowPayments.length > 0 && (
                    <div className="mt-2 text-xs text-amber-400/50 pl-4.5">
                      {yellowPayments.length} off-chain payment{yellowPayments.length !== 1 && 's'} | {(Number(yellowTotalSent) / 1e6).toFixed(2)} USDC
                    </div>
                  )}
                </div>
              )}

              {yellowError && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-500/[0.06] border border-red-500/[0.12] text-red-400 text-sm">
                  Yellow Network: {yellowError}
                </div>
              )}

              {/* Settlement Progress */}
              {(viewMode === 'approving' || viewMode === 'settling') && (
                <div className="mb-5 p-4 rounded-xl bg-indigo-500/[0.06] border border-indigo-500/[0.12]">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-indigo-300 text-sm font-medium">
                      {settlementStatus || 'Processing...'}
                    </span>
                  </div>
                </div>
              )}

              {settlementError && (
                <div className="mb-5 p-4 rounded-xl bg-red-500/[0.06] border border-red-500/[0.12] text-red-400 text-sm">
                  {settlementError}
                </div>
              )}

              {!SESSION_SETTLEMENT_ADDRESSES[chainId] && (
                <div className="mb-5 p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/[0.12] text-amber-300 text-sm">
                  Contract not deployed on this network. Switch to Base Sepolia or Sepolia.
                </div>
              )}

              <SessionCard
                session={session}
                onAddPayment={() => setViewMode('payment')}
                onRemovePayment={handleRemovePayment}
                onFinalize={handleFinalize}
                isLoading={isLoading || isApproving || isSettling || isPending}
              />
            </div>
          ) : (
            /* No session yet */
            <div className="p-8 md:p-10">
              <div className="text-center mb-8">
                <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/[0.15] flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v8M8 12h8" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Start a session</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">
                  Batch multiple payments and settle them all on-chain in one go
                </p>
              </div>

              <button
                onClick={handleStartSession}
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200
                  bg-indigo-500 hover:bg-indigo-400 text-white
                  shadow-[0_0_24px_rgba(99,102,241,0.3)] hover:shadow-[0_0_32px_rgba(99,102,241,0.4)]
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  'Start Payment Session'
                )}
              </button>

              {error && (
                <div className="mt-4 p-3.5 rounded-xl bg-red-500/[0.06] border border-red-500/[0.12] text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* How it works */}
              <div className="mt-8 pt-6 border-t border-white/[0.04]">
                <p className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-4">How it works</p>
                <div className="space-y-3">
                  {[
                    { step: '1', text: 'Start session (connects to Yellow Network)', color: 'from-indigo-500 to-indigo-600' },
                    { step: '2', text: 'Add payments - instant off-chain via state channels', color: 'from-violet-500 to-violet-600' },
                    { step: '3', text: 'Settle all on-chain in a single transaction', color: 'from-purple-500 to-purple-600' },
                  ].map((item) => (
                    <div key={item.step} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-xs font-bold">{item.step}</span>
                      </div>
                      <span className="text-sm text-gray-400">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature pills */}
        {!session && viewMode === 'home' && (
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              {
                icon: (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="5" />
                    <path d="M20 21a8 8 0 10-16 0" />
                  </svg>
                ),
                label: 'ENS Names',
                sub: 'Pay vitalik.eth',
              },
              {
                icon: (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                ),
                label: 'Instant',
                sub: 'State channels',
              },
              {
                icon: (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                ),
                label: 'Low Cost',
                sub: 'Batch gas savings',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="glass-light rounded-xl p-4 text-center hover:bg-white/[0.03] transition-colors"
              >
                <div className="w-8 h-8 mx-auto mb-2.5 rounded-lg bg-indigo-500/[0.08] border border-indigo-500/[0.1] flex items-center justify-center text-indigo-400">
                  {item.icon}
                </div>
                <p className="text-sm font-medium text-gray-200">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Powered by */}
        {!session && viewMode === 'home' && (
          <div className="mt-14 text-center">
            <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-medium mb-4">Powered by</p>
            <div className="flex items-center justify-center gap-5 text-gray-500">
              {['Yellow Network', 'Circle', 'ENS', 'LI.FI'].map((name, i) => (
                <span key={name} className="flex items-center gap-5 text-xs font-medium tracking-wide">
                  {i > 0 && <span className="text-white/[0.06] mr-5">|</span>}
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.03] py-6">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs text-gray-600">
            Built for ETHGlobal HackMoney 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
