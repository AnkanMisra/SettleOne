/**
 * useSettlement - Hook for on-chain settlement transactions
 *
 * Handles:
 * - USDC approval for the settlement contract
 * - Single session settlement (finalizeSession)
 * - Batch session settlement (finalizeSessionBatch)
 */

import { useState, useCallback } from 'react';
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi';
import { parseUnits, keccak256, toBytes } from 'viem';
import {
  SESSION_SETTLEMENT_ABI,
  SESSION_SETTLEMENT_ADDRESSES,
  USDC_ADDRESSES,
  ERC20_ABI,
} from '@/lib/contracts';
import type { Settlement } from '@/types';

interface UseSettlementReturn {
  // State
  isApproving: boolean;
  isSettling: boolean;
  isPending: boolean;
  error: string | null;
  txHash: `0x${string}` | undefined;

  // Actions
  approveUSDC: (amount: string) => Promise<boolean>;
  settleSession: (
    sessionId: string,
    amount: string,
    recipient: `0x${string}`
  ) => Promise<`0x${string}` | null>;
  settleSessionBatch: (
    sessionId: string,
    settlements: Settlement[]
  ) => Promise<`0x${string}` | null>;

  // Helpers
  checkAllowance: (amount: string) => Promise<boolean>;
  getContractAddress: () => `0x${string}` | undefined;
}

export function useSettlement(): UseSettlementReturn {
  const { address } = useAccount();
  const chainId = useChainId();

  const [isApproving, setIsApproving] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get contract addresses for current chain
  const contractAddress = SESSION_SETTLEMENT_ADDRESSES[chainId];
  const usdcAddress = USDC_ADDRESSES[chainId];

  // Write contract hooks
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();

  // Wait for transaction receipt
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Read USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && contractAddress ? [address, contractAddress] : undefined,
  });

  // Get contract address helper
  const getContractAddress = useCallback(() => {
    return contractAddress;
  }, [contractAddress]);

  // Check if we have enough allowance
  const checkAllowance = useCallback(
    async (amount: string): Promise<boolean> => {
      if (!allowance) {
        await refetchAllowance();
      }
      const requiredAmount = parseUnits(amount, 6); // USDC has 6 decimals
      return (allowance as bigint) >= requiredAmount;
    },
    [allowance, refetchAllowance]
  );

  // Approve USDC spending
  const approveUSDC = useCallback(
    async (amount: string): Promise<boolean> => {
      if (!usdcAddress || !contractAddress) {
        setError('Contract not deployed on this network');
        return false;
      }

      setIsApproving(true);
      setError(null);

      try {
        const amountInUnits = parseUnits(amount, 6);

        await writeContractAsync({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [contractAddress, amountInUnits],
        });

        // Refetch allowance after approval
        await refetchAllowance();
        setIsApproving(false);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Approval failed');
        setIsApproving(false);
        return false;
      }
    },
    [usdcAddress, contractAddress, writeContractAsync, refetchAllowance]
  );

  // Settle a single session
  const settleSession = useCallback(
    async (
      sessionId: string,
      amount: string,
      recipient: `0x${string}`
    ): Promise<`0x${string}` | null> => {
      if (!contractAddress) {
        setError('Contract not deployed on this network');
        return null;
      }

      setIsSettling(true);
      setError(null);

      try {
        // Convert session ID to bytes32
        const sessionIdBytes = keccak256(toBytes(sessionId));
        const amountInUnits = parseUnits(amount, 6);

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: SESSION_SETTLEMENT_ABI,
          functionName: 'finalizeSession',
          args: [sessionIdBytes, amountInUnits, recipient],
        });

        setIsSettling(false);
        return hash;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Settlement failed');
        setIsSettling(false);
        return null;
      }
    },
    [contractAddress, writeContractAsync]
  );

  // Settle a batch of payments
  const settleSessionBatch = useCallback(
    async (
      sessionId: string,
      settlements: Settlement[]
    ): Promise<`0x${string}` | null> => {
      if (!contractAddress) {
        setError('Contract not deployed on this network');
        return null;
      }

      if (settlements.length === 0) {
        setError('No settlements to process');
        return null;
      }

      setIsSettling(true);
      setError(null);

      try {
        // Convert session ID to bytes32
        const sessionIdBytes = keccak256(toBytes(sessionId));

        // Format settlements for contract (amount is already bigint)
        const formattedSettlements = settlements.map((s) => ({
          recipient: s.recipient as `0x${string}`,
          amount: s.amount,
        }));

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: SESSION_SETTLEMENT_ABI,
          functionName: 'finalizeSessionBatch',
          args: [sessionIdBytes, formattedSettlements],
        });

        setIsSettling(false);
        return hash;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Batch settlement failed');
        setIsSettling(false);
        return null;
      }
    },
    [contractAddress, writeContractAsync]
  );

  return {
    isApproving,
    isSettling,
    isPending: isPending || isConfirming,
    error,
    txHash,
    approveUSDC,
    settleSession,
    settleSessionBatch,
    checkAllowance,
    getContractAddress,
  };
}
