'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { formatAddress } from '@/hooks/useENS';

export function ConnectButton() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Phantom, MetaMask, and other browser wallets all inject as EIP-1193 providers
  const injectedConnector = connectors.find(
    (c) => c.type === 'injected' || c.id === 'injected' || c.id === 'metaMask'
  );

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2.5 px-4 py-2 glass rounded-full">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          <span className="text-sm font-mono text-gray-200">
            {formatAddress(address, 4)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors rounded-full
            hover:bg-white/[0.03]"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      disabled={isConnecting || !injectedConnector}
      className={`
        flex items-center justify-center mx-auto gap-2.5 px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-200
        ${isConnecting
          ? 'bg-white/5 text-gray-500 cursor-wait'
          : 'bg-indigo-500/90 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:shadow-[0_0_30px_rgba(99,102,241,0.35)]'
        }
      `}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="3" />
        <path d="M16 12h.01" />
      </svg>
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
