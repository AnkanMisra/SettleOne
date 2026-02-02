'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePublicClient } from 'wagmi';
import { normalize } from 'viem/ens';
import { mainnet } from 'wagmi/chains';
import type { ENSResolutionResult } from '@/types';

interface UseENSOptions {
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Hook for resolving ENS names to addresses
 * Uses mainnet for ENS resolution (ENS is only on mainnet)
 */
export function useENS(
  nameOrAddress: string,
  options: UseENSOptions = {}
): ENSResolutionResult {
  const { debounceMs = 300, enabled = true } = options;
  
  const [result, setResult] = useState<ENSResolutionResult>({
    name: nameOrAddress,
    address: null,
    isLoading: false,
  });

  // Get mainnet client for ENS resolution
  const publicClient = usePublicClient({ chainId: mainnet.id });

  const resolveENS = useCallback(async (name: string) => {
    if (!name || !publicClient) {
      setResult({
        name,
        address: null,
        isLoading: false,
      });
      return;
    }

    // Check if it's already an address
    if (name.startsWith('0x') && name.length === 42) {
      setResult({
        name,
        address: name,
        isLoading: false,
      });
      return;
    }

    // Check if it's a valid ENS name
    if (!name.endsWith('.eth')) {
      setResult({
        name,
        address: null,
        isLoading: false,
        error: 'Invalid ENS name (must end with .eth)',
      });
      return;
    }

    setResult((prev) => ({ ...prev, isLoading: true, error: undefined }));

    try {
      // Normalize the ENS name
      const normalizedName = normalize(name);

      // Resolve ENS name to address
      const address = await publicClient.getEnsAddress({
        name: normalizedName,
      });

      if (address) {
        // Try to get avatar
        let avatar: string | undefined;
        try {
          const avatarUrl = await publicClient.getEnsAvatar({
            name: normalizedName,
          });
          avatar = avatarUrl || undefined;
        } catch {
          // Avatar fetch failed, continue without it
        }

        setResult({
          name,
          address,
          avatar,
          isLoading: false,
        });
      } else {
        setResult({
          name,
          address: null,
          isLoading: false,
          error: 'ENS name not found',
        });
      }
    } catch (error) {
      setResult({
        name,
        address: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to resolve ENS',
      });
    }
  }, [publicClient]);

  // Debounced resolution
  useEffect(() => {
    if (!enabled) return;

    const timeoutId = setTimeout(() => {
      resolveENS(nameOrAddress);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [nameOrAddress, debounceMs, enabled, resolveENS]);

  return result;
}

/**
 * Hook for reverse ENS lookup (address to name)
 */
export function useENSName(address: string | undefined) {
  const [state, setState] = useState<{ name: string | null; isLoading: boolean }>({
    name: null,
    isLoading: false,
  });
  const cancelledRef = useRef(false);

  const publicClient = usePublicClient({ chainId: mainnet.id });

  useEffect(() => {
    cancelledRef.current = false;

    if (!address || !publicClient) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: data fetching pattern
    setState({ name: null, isLoading: true });

    publicClient
      .getEnsName({ address: address as `0x${string}` })
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

/**
 * Utility function to check if a string is a valid ENS name
 */
export function isValidENS(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  if (!name.endsWith('.eth')) return false;
  
  // Basic validation - ENS names must be at least 3 characters (+ .eth = 7)
  if (name.length < 7) return false;
  
  // Check for valid characters
  const label = name.slice(0, -4); // Remove .eth
  const validPattern = /^[a-z0-9-]+$/;
  return validPattern.test(label);
}

/**
 * Format an address for display (truncate middle)
 */
export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
