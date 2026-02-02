'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useENS, formatAddress } from '@/hooks/useENS';

interface ENSInputProps {
  value: string;
  onChange: (value: string, resolvedAddress: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export function ENSInput({
  value,
  onChange,
  placeholder = 'vitalik.eth or 0x...',
  disabled = false,
  className = '',
  label,
}: ENSInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  
  const { address, avatar, isLoading, error } = useENS(value, {
    enabled: value.length > 0,
  });

  // Stable callback to notify parent
  const notifyParent = useCallback((addr: string | null) => {
    onChange(value, addr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Notify parent when address resolution changes
  useEffect(() => {
    notifyParent(address);
  }, [address, notifyParent]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toLowerCase();
    onChange(newValue, null); // Reset resolved address when input changes
  };

  const isENS = value.endsWith('.eth');
  const isAddress = value.startsWith('0x') && value.length === 42;
  const showResolution = (isENS || isAddress) && address;

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div
        className={`
          flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all
          bg-gray-900/50 backdrop-blur
          ${isFocused ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-700'}
          ${error ? 'border-red-500' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Avatar */}
        {avatar ? (
          <Image
            src={avatar}
            alt="ENS Avatar"
            width={32}
            height={32}
            className="w-8 h-8 rounded-full"
            unoptimized
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {value ? value[0].toUpperCase() : '?'}
            </span>
          </div>
        )}

        {/* Input */}
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            flex-1 bg-transparent outline-none text-white placeholder-gray-500
            ${disabled ? 'cursor-not-allowed' : ''}
          `}
        />

        {/* Loading indicator */}
        {isLoading && (
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}

        {/* Success indicator */}
        {showResolution && !isLoading && (
          <div className="flex items-center gap-1 text-green-400">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Resolution result */}
      {showResolution && !isLoading && (
        <div className="mt-2 px-4 py-2 bg-gray-800/50 rounded-lg text-sm">
          <span className="text-gray-400">Resolved to: </span>
          <span className="text-white font-mono">{formatAddress(address, 6)}</span>
        </div>
      )}

      {/* Error message */}
      {error && !isLoading && value && (
        <div className="mt-2 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Hint for valid ENS */}
      {value && !isENS && !isAddress && !error && (
        <div className="mt-2 px-4 text-xs text-gray-500">
          Enter an ENS name (ending with .eth) or an Ethereum address
        </div>
      )}
    </div>
  );
}
