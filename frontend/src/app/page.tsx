'use client';

import { useAccount } from 'wagmi';
import { useState } from 'react';
import { ConnectButton } from '@/components/ConnectButton';
import { SessionCard } from '@/components/features/SessionCard';
import { PaymentForm } from '@/components/features/PaymentForm';
import { useSession } from '@/hooks/useSession';

type ViewMode = 'home' | 'payment';

export default function Home() {
  const { isConnected } = useAccount();
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const {
    session,
    isLoading,
    error,
    createSession,
    addPayment,
    finalizeSession,
  } = useSession();

  const handleStartSession = async () => {
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
    const success = await addPayment(
      data.recipient,
      data.amount,
      data.recipientENS
    );
    if (success) {
      setViewMode('home');
    }
  };

  const handleFinalize = async () => {
    const txHash = await finalizeSession();
    if (txHash) {
      // Show success notification
      alert(`Settlement complete! TX: ${txHash}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">S1</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">SettleOne</h1>
              <p className="text-xs text-gray-400">Send USDC, Settle Once</p>
            </div>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Send USDC Anywhere
          </h2>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            Pay anyone with their ENS name. Cross-chain, gasless, instant.
          </p>
        </div>

        {/* Payment Card */}
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl p-6 md:p-8">
          {!isConnected ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center">
                {/* MetaMask Fox */}
                <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M36.0112 3.33325L22.1449 13.5L24.7462 7.55992L36.0112 3.33325Z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.98877 3.33325L17.7388 13.5933L15.2538 7.55992L3.98877 3.33325Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M31.0149 27.2666L27.4199 32.9333L35.2449 35.0999L37.5199 27.3999L31.0149 27.2666Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.48999 27.3999L4.75499 35.0999L12.58 32.9333L8.98499 27.2666L2.48999 27.3999Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Connect MetaMask</h3>
              <p className="text-gray-400 mb-6">
                Connect your MetaMask wallet to start sending payments
              </p>
              <ConnectButton />
            </div>
          ) : viewMode === 'payment' ? (
            <div>
              <h3 className="text-lg font-semibold text-white mb-6">Add Payment</h3>
              <PaymentForm
                onSubmit={handleAddPayment}
                isLoading={isLoading}
                onCancel={() => setViewMode('home')}
              />
            </div>
          ) : session ? (
            <SessionCard
              session={session}
              onAddPayment={() => setViewMode('payment')}
              onFinalize={handleFinalize}
              isLoading={isLoading}
            />
          ) : (
            <div className="space-y-6">
              {/* No session yet - show start button */}
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Start a Payment Session</h3>
                <p className="text-gray-400 mb-6 max-w-sm mx-auto">
                  Create a session to batch multiple payments and settle them all on-chain at once
                </p>
                <button
                  onClick={handleStartSession}
                  disabled={isLoading}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 
                    hover:from-blue-600 hover:to-purple-700 text-white font-semibold
                    shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Start Session'}
                </button>
              </div>

              {/* Error display */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Session Info */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">How it works</span>
                </div>
                <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                  <li>Start a session to begin batching payments</li>
                  <li>Add multiple payments to recipients (ENS or address)</li>
                  <li>Settle all payments on-chain in one transaction</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-5">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h4 className="font-semibold mb-1">ENS Names</h4>
            <p className="text-sm text-gray-400">Send to human-readable .eth names</p>
          </div>
          
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-5">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4 className="font-semibold mb-1">Instant</h4>
            <p className="text-sm text-gray-400">Off-chain execution, on-chain settlement</p>
          </div>
          
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-5">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="font-semibold mb-1">Low Fees</h4>
            <p className="text-sm text-gray-400">Batch settlements save on gas</p>
          </div>
        </div>

        {/* Sponsor Badges */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-500 mb-4">Powered by</p>
          <div className="flex items-center justify-center gap-6 text-gray-400">
            <span className="text-sm">Yellow Network</span>
            <span className="text-gray-700">|</span>
            <span className="text-sm">Circle Arc</span>
            <span className="text-gray-700">|</span>
            <span className="text-sm">ENS</span>
            <span className="text-gray-700">|</span>
            <span className="text-sm">LI.FI</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-20 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>Built for ETHGlobal HackMoney 2026</p>
        </div>
      </footer>
    </div>
  );
}
