'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { normalize } from 'viem/ens';
import { isAddress } from 'viem';
import { sepolia } from 'wagmi/chains';
import type { ENSResolutionResult } from '@/types';
import { UNIVERSAL_RESOLVER, isEnsName } from '@/lib/ensv2';

interface UseENSOptions {
  debounceMs?: number;
  enabled?: boolean;
}

export function useENS(
  nameOrAddress: string,
  options: UseENSOptions = {},
): ENSResolutionResult {
  const { debounceMs = 300, enabled = true } = options;
  const [result, setResult] = useState<ENSResolutionResult>({
    name: nameOrAddress,
    address: null,
    isLoading: false,
  });
  const publicClient = usePublicClient({ chainId: sepolia.id });

  const resolveENS = useCallback(
    async (name: string) => {
      if (!name || !publicClient) {
        setResult({ name, address: null, isLoading: false });
        return;
      }
      if (isAddress(name)) {
        setResult({ name, address: name, isLoading: false });
        return;
      }
      if (!isEnsName(name)) {
        setResult({
          name,
          address: null,
          isLoading: false,
          error: 'Use a Sepolia ENS name ending in .eth, or a 0x address',
        });
        return;
      }
      setResult((prev) => ({ ...prev, isLoading: true, error: undefined }));
      try {
        const normalizedName = normalize(name);
        const address = await publicClient.getEnsAddress({
          name: normalizedName,
          universalResolverAddress: UNIVERSAL_RESOLVER,
        });
        if (address) {
          let avatar: string | undefined;
          try {
            const avatarUrl = await publicClient.getEnsAvatar({
              name: normalizedName,
              universalResolverAddress: UNIVERSAL_RESOLVER,
            });
            avatar = avatarUrl || undefined;
          } catch {
            avatar = undefined;
          }
          setResult({ name, address, avatar, isLoading: false });
        } else {
          setResult({
            name,
            address: null,
            isLoading: false,
            error: 'ENS name has no payout address on Sepolia',
          });
        }
      } catch (error) {
        setResult({
          name,
          address: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to resolve ENS on Sepolia',
        });
      }
    },
    [publicClient],
  );

  useEffect(() => {
    if (!enabled) return;
    const timeoutId = setTimeout(() => {
      void resolveENS(nameOrAddress);
    }, debounceMs);
    return () => clearTimeout(timeoutId);
  }, [nameOrAddress, debounceMs, enabled, resolveENS]);

  return result;
}

export function useENSName(address: string | undefined) {
  const [resolved, setResolved] = useState<{
    address: string;
    name: string | null;
  } | null>(null);
  const publicClient = usePublicClient({ chainId: sepolia.id });

  useEffect(() => {
    if (!address || !isAddress(address) || !publicClient) {
      return;
    }
    const target = address;
    let cancelled = false;
    publicClient
      .getEnsName({
        address: target,
        universalResolverAddress: UNIVERSAL_RESOLVER,
      })
      .then((ensName) => {
        if (!cancelled) {
          setResolved({ address: target, name: ensName });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolved({ address: target, name: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [address, publicClient]);

  const ready = Boolean(address && resolved?.address === address);
  return {
    name: ready ? resolved?.name ?? null : null,
    isLoading: Boolean(address && isAddress(address) && publicClient && !ready),
  };
}

export function isValidENS(name: string): boolean {
  return isEnsName(name);
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
