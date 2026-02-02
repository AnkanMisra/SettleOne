'use client';

import { useState } from 'react';

export interface Chain {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export const SUPPORTED_CHAINS: Chain[] = [
  { id: 1, name: 'Ethereum', icon: 'E', color: '#627EEA' },
  { id: 10, name: 'Optimism', icon: 'O', color: '#FF0420' },
  { id: 42161, name: 'Arbitrum', icon: 'A', color: '#12AAFF' },
  { id: 137, name: 'Polygon', icon: 'P', color: '#8247E5' },
  { id: 8453, name: 'Base', icon: 'B', color: '#0052FF' },
];

interface ChainSelectorProps {
  label: string;
  selectedChainId: number | null;
  onSelect: (chainId: number) => void;
  disabled?: boolean;
  excludeChainId?: number;
}

export function ChainSelector({
  label,
  selectedChainId,
  onSelect,
  disabled = false,
  excludeChainId,
}: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const availableChains = SUPPORTED_CHAINS.filter(
    (chain) => chain.id !== excludeChainId
  );

  const selectedChain = SUPPORTED_CHAINS.find((c) => c.id === selectedChainId);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-3 rounded-xl border text-left flex items-center gap-3
          transition-all duration-200
          ${
            disabled
              ? 'bg-gray-800 border-gray-700 cursor-not-allowed opacity-50'
              : 'bg-gray-900 border-gray-700 hover:border-blue-500 cursor-pointer'
          }
        `}
      >
        {selectedChain ? (
          <>
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: selectedChain.color }}
            >
              {selectedChain.icon}
            </span>
            <span className="text-white">{selectedChain.name}</span>
          </>
        ) : (
          <span className="text-gray-500">Select chain</span>
        )}
        <svg
          className={`ml-auto w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-full bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
          {availableChains.map((chain) => (
            <button
              key={chain.id}
              onClick={() => {
                onSelect(chain.id);
                setIsOpen(false);
              }}
              className={`
                w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800 transition-colors
                ${selectedChainId === chain.id ? 'bg-gray-800' : ''}
              `}
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: chain.color }}
              >
                {chain.icon}
              </span>
              <span className="text-white">{chain.name}</span>
              {selectedChainId === chain.id && (
                <svg
                  className="ml-auto w-5 h-5 text-blue-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
