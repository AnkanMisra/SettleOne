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
  usePublicClient,
} from 'wagmi';
import { keccak256, toBytes, type TransactionReceipt } from 'viem';
import {
  SESSION_SETTLEMENT_ABI,
  SESSION_SETTLEMENT_ADDRESSES,
  USDC_ADDRESSES,
  ERC20_ABI,
  TESTNET_CHAIN_IDS,
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
  checkBalance: (amount: string) => Promise<boolean>;
  checkIsSettled: (sessionId: string) => Promise<boolean>;
  mintTestUSDC: (amount: string) => Promise<boolean>;
  isTestnet: boolean;
  getContractAddress: () => `0x${string}` | undefined;
}

interface ClientWithWaitForTransactionReceipt {
  waitForTransactionReceipt: (args: {
    hash: `0x${string}`;
    confirmations?: number;
    timeout?: number;
  }) => Promise<TransactionReceipt>;
}

// Helper to wait for transaction receipt with retries
async function waitForReceiptWithRetry(
  publicClient: ClientWithWaitForTransactionReceipt,
  hash: `0x${string}`,
  retries = 5,
  delay = 2000
) {
  for (let i = 0; i < retries; i++) {
    try {
      return await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 60000, // 60s timeout per attempt
      });
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

export function useSettlement(): UseSettlementReturn {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [isApproving, setIsApproving] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get contract addresses for current chain
  const contractAddress = SESSION_SETTLEMENT_ADDRESSES[chainId];
  const usdcAddress = USDC_ADDRESSES[chainId];
  const isTestnet = (TESTNET_CHAIN_IDS as readonly number[]).includes(chainId);

  // Write contract hooks
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();

  // Wait for transaction receipt
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Read USDC allowance - only run query when inputs exist
  const { refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: {
      enabled: Boolean(usdcAddress && address && contractAddress),
    },
  });

  // Get contract address helper
  const getContractAddress = useCallback(() => {
    return contractAddress;
  }, [contractAddress]);

  // Check if we have enough allowance
  const checkAllowance = useCallback(
    async (amount: string): Promise<boolean> => {
      // Refetch to get the latest allowance value
      const result = await refetchAllowance();
      const currentAllowance = result.data ?? BigInt(0);
      const requiredAmount = BigInt(amount); // amount is already in base units (6 decimals)
      return currentAllowance >= requiredAmount;
    },
    [refetchAllowance]
  );

  // Check if we have enough USDC balance
  const checkBalance = useCallback(
    async (amount: string): Promise<boolean> => {
      if (!usdcAddress || !address || !publicClient) return false;

      try {
        const balance = await publicClient.readContract({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        });
        const requiredAmount = BigInt(amount);
        return (balance as bigint) >= requiredAmount;
      } catch {
        return false;
      }
    },
    [usdcAddress, address, publicClient]
  );

  // Check if session is already settled on-chain
  const checkIsSettled = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!contractAddress || !publicClient) return false;

      try {
        const sessionIdBytes = keccak256(toBytes(sessionId));
        const isSettled = await publicClient.readContract({
          address: contractAddress,
          abi: SESSION_SETTLEMENT_ABI,
          functionName: 'isSessionSettled',
          args: [sessionIdBytes],
        });
        return isSettled as boolean;
      } catch {
        return false;
      }
    },
    [contractAddress, publicClient]
  );

  // Mint test USDC on testnet (MockUSDC has a public mint function)
  const mintTestUSDC = useCallback(
    async (amount: string): Promise<boolean> => {
      if (!usdcAddress || !address || !publicClient || !isTestnet) {
        setError('Minting only available on testnets');
        return false;
      }

      try {
        // Mint either requested amount or 1000 USDC (whichever is larger)
        // This avoids small amount issues and ensures future tests work
        const requestedAmount = BigInt(amount);
        const bufferAmount = BigInt(1000 * 1_000_000); // 1000 USDC
        const amountToMint = requestedAmount > bufferAmount ? requestedAmount : bufferAmount;

        const hash = await writeContractAsync({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'mint',
          args: [address, amountToMint],
        });

        // Wait for transaction to be confirmed with retries
        await waitForReceiptWithRetry(publicClient, hash);

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Mint failed');
        return false;
      }
    },
    [usdcAddress, address, publicClient, isTestnet, writeContractAsync]
  );

  // Approve USDC spending
  const approveUSDC = useCallback(
    async (amount: string): Promise<boolean> => {
      if (!usdcAddress || !contractAddress) {
        setError('Contract not deployed on this network');
        return false;
      }

      if (!publicClient) {
        setError('Unable to connect to network');
        return false;
      }

      setIsApproving(true);
      setError(null);

      try {
        const amountInUnits = BigInt(amount); // amount is already in base units

        const hash = await writeContractAsync({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [contractAddress, amountInUnits],
        });

        // Wait for the transaction to be confirmed with retries
        await waitForReceiptWithRetry(publicClient, hash);

        // Refetch allowance after confirmation to ensure we have the latest value
        await refetchAllowance();
        setIsApproving(false);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Approval failed');
        setIsApproving(false);
        return false;
      }
    },
    [usdcAddress, contractAddress, publicClient, writeContractAsync, refetchAllowance]
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

      if (!publicClient) {
        setError('Unable to connect to network');
        return null;
      }

      setIsSettling(true);
      setError(null);

      try {
        // Convert session ID to bytes32
        const sessionIdBytes = keccak256(toBytes(sessionId));
        const amountInUnits = BigInt(amount); // amount is already in base units

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: SESSION_SETTLEMENT_ABI,
          functionName: 'finalizeSession',
          args: [sessionIdBytes, amountInUnits, recipient],
        });

        // Wait for the transaction to be confirmed with retries
        await waitForReceiptWithRetry(publicClient, hash);

        setIsSettling(false);
        return hash;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Settlement failed');
        setIsSettling(false);
        return null;
      }
    },
    [contractAddress, publicClient, writeContractAsync]
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

      if (!publicClient) {
        setError('Unable to connect to network');
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

        // Wait for the transaction to be confirmed with retries
        await waitForReceiptWithRetry(publicClient, hash);

        setIsSettling(false);
        return hash;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Batch settlement failed');
        setIsSettling(false);
        return null;
      }
    },
    [contractAddress, publicClient, writeContractAsync]
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
    checkBalance,
    checkIsSettled,
    mintTestUSDC,
    isTestnet,
    getContractAddress,
  };
}
