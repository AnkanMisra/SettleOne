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

  const notifyParent = useCallback((addr: string | null) => {
    onChange(value, addr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    notifyParent(address);
  }, [address, notifyParent]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toLowerCase();
    onChange(newValue, null);
  };

  const isENS = value.endsWith('.eth');
  const isAddress = value.startsWith('0x') && value.length === 42;
  const showResolution = (isENS || isAddress) && address;

  return (
    <div className={`${className}`}>
      {label && (
        <label className="block text-xs text-gray-500 uppercase tracking-wider font-medium mb-2.5">
          {label}
        </label>
      )}
      <div
        className={`
          flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200
          bg-white/[0.02]
          ${isFocused
            ? 'border-indigo-500/40 shadow-[0_0_0_3px_rgba(99,102,241,0.08)]'
            : 'border-white/[0.06] hover:border-white/[0.1]'}
          ${error ? 'border-red-500/30' : ''}
          ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        `}
      >
        {/* Avatar */}
        {avatar ? (
          <Image
            src={avatar}
            alt="ENS Avatar"
            width={32}
            height={32}
            className="w-8 h-8 rounded-full ring-1 ring-white/10"
            unoptimized
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/[0.1] flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-400 text-xs font-bold">
              {value ? value[0].toUpperCase() : '?'}
            </span>
          </div>
        )}

        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none text-white placeholder-gray-600 text-sm"
        />

        {isLoading && (
          <div className="w-4 h-4 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin" />
        )}

        {showResolution && !isLoading && (
          <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {showResolution && !isLoading && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/[0.1] text-xs">
          <span className="text-gray-500">Resolved: </span>
          <span className="text-emerald-400 font-mono">{formatAddress(address, 6)}</span>
        </div>
      )}

      {error && !isLoading && value && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/[0.05] border border-red-500/[0.1] text-xs text-red-400">
          {error}
        </div>
      )}

      {value && !isENS && !isAddress && !error && (
        <div className="mt-2 px-1 text-xs text-gray-600">
          Enter an ENS name (.eth) or Ethereum address (0x...)
        </div>
      )}
    </div>
  );
}
