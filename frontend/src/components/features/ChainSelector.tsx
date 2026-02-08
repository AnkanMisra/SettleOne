'use client';

import { useState, useRef, useEffect } from 'react';

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
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const availableChains = SUPPORTED_CHAINS.filter(
    (chain) => chain.id !== excludeChainId
  );

  const selectedChain = SUPPORTED_CHAINS.find((c) => c.id === selectedChainId);

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs text-gray-500 uppercase tracking-wider font-medium mb-2.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3.5 py-3 rounded-xl border text-left flex items-center gap-2.5
          transition-all duration-200 text-sm
          ${disabled
            ? 'bg-white/[0.01] border-white/[0.04] cursor-not-allowed opacity-40'
            : isOpen
              ? 'bg-white/[0.03] border-indigo-500/30'
              : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
          }
        `}
      >
        {selectedChain ? (
          <>
            <span
              className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: selectedChain.color }}
            >
              {selectedChain.icon}
            </span>
            <span className="text-white text-sm">{selectedChain.name}</span>
          </>
        ) : (
          <span className="text-gray-600 text-sm">Select</span>
        )}
        <svg
          className={`ml-auto w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1.5 w-full glass rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
          {availableChains.map((chain) => (
            <button
              key={chain.id}
              onClick={() => {
                onSelect(chain.id);
                setIsOpen(false);
              }}
              className={`
                w-full px-3.5 py-2.5 flex items-center gap-2.5 text-sm transition-colors
                ${selectedChainId === chain.id ? 'bg-indigo-500/[0.08]' : 'hover:bg-white/[0.04]'}
              `}
            >
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: chain.color }}
              >
                {chain.icon}
              </span>
              <span className="text-gray-200">{chain.name}</span>
              {selectedChainId === chain.id && (
                <svg className="ml-auto w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
