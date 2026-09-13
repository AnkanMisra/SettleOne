'use client';

import { useEffect, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseAbi } from 'viem';
import { api } from '@/lib/api';
import { ARC_USDC } from '@/hooks/useSettlement';
import { SESSION_SETTLEMENT_BYTECODE } from '@/lib/sessionSettlementBytecode';
import { arcTestnet } from '@/lib/wagmi';

const deployAbi = parseAbi(['constructor(address usdc)']);

export function useDeploySettlement() {
  const { address, chainId } = useAccount();
  const client = usePublicClient({ chainId: arcTestnet.id });
  const { data: wallet } = useWalletClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contract, setContract] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function refresh() {
    const current = await api.settlementContract();
    setContract(current.contract);
    return current.contract;
  }

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  async function deploy() {
    setBusy(true);
    setError(null);
    try {
      if (!wallet || !client || !address || chainId !== arcTestnet.id) {
        throw new Error('Connect the payer wallet on Arc Testnet to deploy');
      }
      const current = await api.settlementContract();
      setContract(current.contract);
      if (current.contract) return current.contract;
      if (current.registration_admin?.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Contract deployment requires the server-configured SETTLEMENT_ADMIN wallet. No deployment was sent.');
      }
      const hash = await wallet.deployContract({
        abi: deployAbi,
        bytecode: SESSION_SETTLEMENT_BYTECODE,
        args: [ARC_USDC],
        account: address,
        chain: arcTestnet,
      });
      setTxHash(hash);
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success' || !receipt.contractAddress) {
        throw new Error('Deployment transaction reverted');
      }
      const configured = await api.configureSettlement(receipt.contractAddress);
      setContract(configured.contract);
      return configured.contract;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Deployment failed';
      setError(message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  return { deploy, refresh, busy, error, contract, txHash };
}
