'use client';

import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { BaseError, ContractFunctionRevertedError, getAddress, isAddress } from 'viem';
import { normalize } from 'viem/ens';
import {
  SERVICE_METADATA_KEY,
  UNIVERSAL_RESOLVER,
  dnsEncodedName,
  ensNode,
  permissionedResolverAbi,
} from '@/lib/ensv2';

export function useEnsPermissions() {
  const { address, chainId } = useAccount();
  const sepoliaClient = usePublicClient({ chainId: sepolia.id });
  const { data: wallet } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function note(line: string) {
    setLog((current) => [...current, line]);
  }

  async function requireSepolia() {
    if (chainId !== sepolia.id) {
      await switchChainAsync({ chainId: sepolia.id });
    }
  }

  async function currentResolver(name: string) {
    if (!sepoliaClient) throw new Error('Sepolia RPC is unavailable');
    const resolver = await sepoliaClient.getEnsResolver({
      name: normalize(name),
      universalResolverAddress: UNIVERSAL_RESOLVER,
    });
    if (!resolver) throw new Error('No resolver is set for this name on Sepolia');
    return getAddress(resolver);
  }

  async function grantTextRole(name: string, secondary: string, grant: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (!wallet || !address || !sepoliaClient) throw new Error('Connect the name owner on Sepolia');
      if (!isAddress(secondary)) throw new Error('Secondary account must be a nonzero address');
      await requireSepolia();
      const resolver = await currentResolver(name);
      note(`Resolved current resolver ${resolver} before ${grant ? 'grant' : 'revoke'}`);
      const hash = await wallet.writeContract({
        account: address,
        chain: sepolia,
        address: resolver,
        abi: permissionedResolverAbi,
        functionName: 'authorizeTextRoles',
        args: [dnsEncodedName(name), SERVICE_METADATA_KEY, getAddress(secondary), grant],
      });
      const receipt = await sepoliaClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Permission transaction reverted');
      note(`${grant ? 'Granted' : 'Revoked'} ${SERVICE_METADATA_KEY} for ${secondary}. tx ${hash}`);
      return hash;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ENS permission update failed';
      setError(message);
      note(message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function updateServiceText(name: string, value: string) {
    setBusy(true);
    setError(null);
    try {
      if (!wallet || !address || !sepoliaClient) throw new Error('Connect the secondary wallet on Sepolia');
      await requireSepolia();
      const resolver = await currentResolver(name);
      note(`Resolved current resolver ${resolver} before setText`);
      const hash = await wallet.writeContract({
        account: address,
        chain: sepolia,
        address: resolver,
        abi: permissionedResolverAbi,
        functionName: 'setText',
        args: [ensNode(name), SERVICE_METADATA_KEY, value],
      });
      const receipt = await sepoliaClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Text update reverted');
      note(`Updated ${SERVICE_METADATA_KEY}. tx ${hash}`);
      return hash;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Text update failed';
      setError(message);
      note(message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function simulateForbiddenWrites(name: string, payout: string) {
    setBusy(true);
    setError(null);
    try {
      if (!wallet || !address || !sepoliaClient) throw new Error('Connect the secondary wallet on Sepolia');
      if (!isAddress(payout)) throw new Error('Payout address required for the forbidden simulation');
      await requireSepolia();
      const resolver = await currentResolver(name);
      const account = address;
      const node = ensNode(name);
      const attempts = [
        sepoliaClient.simulateContract({
          account,
          address: resolver,
          abi: permissionedResolverAbi,
          functionName: 'setAddr',
          args: [node, getAddress(payout)],
        }),
        sepoliaClient.simulateContract({
          account,
          address: resolver,
          abi: permissionedResolverAbi,
          functionName: 'setText',
          args: [node, 'url', 'https://example.invalid'],
        }),
      ];
      const results = await Promise.allSettled(attempts);
      results.forEach((result, index) => {
        const label = index === 0 ? 'setAddr payout' : 'setText url';
        if (result.status === 'fulfilled') {
          note(`${label} unexpectedly simulated successfully. Do not claim this grant is narrow.`);
        } else {
          const revert = result.reason instanceof BaseError
            ? result.reason.walk(e => e instanceof ContractFunctionRevertedError) : null;
          note(revert instanceof ContractFunctionRevertedError
            ? `${label} reverted in simulation. Inspect the revert to confirm it is an authorization denial: ${revert.shortMessage}`
            : `${label} could not be verified: RPC or simulation failure is not permission evidence.`);
        }
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Forbidden write simulation failed';
      setError(message);
      note(message);
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    log,
    error,
    grantTextRole: (name: string, secondary: string) => grantTextRole(name, secondary, true),
    revokeTextRole: (name: string, secondary: string) => grantTextRole(name, secondary, false),
    updateServiceText,
    simulateForbiddenWrites,
  };
}
