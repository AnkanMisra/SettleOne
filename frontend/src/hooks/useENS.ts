'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [state, setState] = useState<{ name: string | null; isLoading: boolean }>({
    name: null,
    isLoading: false,
  });
  const cancelledRef = useRef(false);
  const publicClient = usePublicClient({ chainId: sepolia.id });

  useEffect(() => {
    cancelledRef.current = false;
    if (!address || !isAddress(address) || !publicClient) {
      return;
    }
    setState({ name: null, isLoading: true });
    publicClient
      .getEnsName({
        address,
        universalResolverAddress: UNIVERSAL_RESOLVER,
      })
      .then((ensName) => {
        if (!cancelledRef.current) {
          setState({ name: ensName, isLoading: false });
        }
      })
      .catch(() => {
        if (!cancelledRef.current) {
          setState({ name: null, isLoading: false });
        }
      });
    return () => {
      cancelledRef.current = true;
    };
  }, [address, publicClient]);

  return state;
}

export function isValidENS(name: string): boolean {
  return isEnsName(name);
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
