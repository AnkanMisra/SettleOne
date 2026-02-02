'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { formatAddress } from '@/hooks/useENS';

export function ConnectButton() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Get MetaMask connector
  const metaMaskConnector = connectors.find((c) => c.id === 'metaMask' || c.name === 'MetaMask');

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl border border-gray-700">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span className="text-sm font-mono text-white">
            {formatAddress(address, 4)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => metaMaskConnector && connect({ connector: metaMaskConnector })}
      disabled={isConnecting || !metaMaskConnector}
      className={`
        flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all
        ${isConnecting
          ? 'bg-gray-700 text-gray-400 cursor-wait'
          : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/25'
        }
      `}
    >
      {/* MetaMask Fox Icon */}
      <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M36.0112 3.33325L22.1449 13.5L24.7462 7.55992L36.0112 3.33325Z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3.98877 3.33325L17.7388 13.5933L15.2538 7.55992L3.98877 3.33325Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M31.0149 27.2666L27.4199 32.9333L35.2449 35.0999L37.5199 27.3999L31.0149 27.2666Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2.48999 27.3999L4.75499 35.0999L12.58 32.9333L8.98499 27.2666L2.48999 27.3999Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12.1138 17.8333L9.89877 21.1666L17.6538 21.4999L17.3838 13.1333L12.1138 17.8333Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M27.8862 17.8333L22.5462 13.0333L22.1449 21.4999L29.8999 21.1666L27.8862 17.8333Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12.58 32.9333L17.1988 30.6333L13.2038 27.4333L12.58 32.9333Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22.8012 30.6333L27.4199 32.9333L26.7962 27.4333L22.8012 30.6333Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
    </button>
  );
}
