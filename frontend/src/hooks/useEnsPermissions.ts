'use client';

import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import {
  BaseError,
  ContractFunctionRevertedError,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  parseEther,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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

  async function fundSecondary(secondary: string) {
    setBusy(true);
    setError(null);
    try {
      if (!wallet || !address || !sepoliaClient) throw new Error('Connect the owner on Sepolia');
      if (!isAddress(secondary)) throw new Error('Generate a secondary first');
      await requireSepolia();
      const hash = await wallet.sendTransaction({
        account: address,
        chain: sepolia,
        to: getAddress(secondary),
        value: parseEther('0.002'),
      });
      const receipt = await sepoliaClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Funding the secondary reverted');
      note(`Funded ${secondary} with 0.002 ETH. tx ${hash}`);
      return hash;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not fund secondary';
      setError(message);
      note(message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function secondaryClient(privateKey: Hex) {
    if (!sepoliaClient) throw new Error('Sepolia RPC is unavailable');
    const account = privateKeyToAccount(privateKey);
    return createWalletClient({
      account,
      chain: sepolia,
      transport: http(sepolia.rpcUrls.default.http[0]),
    });
  }

  async function updateServiceTextAsSecondary(name: string, value: string, privateKey: Hex) {
    setBusy(true);
    setError(null);
    try {
      if (!sepoliaClient) throw new Error('Sepolia RPC is unavailable');
      const client = secondaryClient(privateKey);
      const resolver = await currentResolver(name);
      note(`Secondary ${client.account.address} resolved ${resolver} before setText`);
      const hash = await client.writeContract({
        address: resolver,
        abi: permissionedResolverAbi,
        functionName: 'setText',
        args: [ensNode(name), SERVICE_METADATA_KEY, value],
      });
      const receipt = await sepoliaClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Text update reverted');
      note(`Secondary updated ${SERVICE_METADATA_KEY}. tx ${hash}`);
      return hash;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Secondary text update failed';
      setError(message);
      note(message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function simulateForbiddenAsSecondary(name: string, payout: string, privateKey: Hex) {
    setBusy(true);
    setError(null);
    try {
      if (!sepoliaClient) throw new Error('Sepolia RPC is unavailable');
      if (!isAddress(payout)) throw new Error('Payout address required for the forbidden simulation');
      const account = privateKeyToAccount(privateKey);
      const resolver = await currentResolver(name);
      const node = ensNode(name);
      const attempts = [
        sepoliaClient.simulateContract({
          account: account.address,
          address: resolver,
          abi: permissionedResolverAbi,
          functionName: 'setAddr',
          args: [node, getAddress(payout)],
        }),
        sepoliaClient.simulateContract({
          account: account.address,
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
            ? result.reason.walk((e) => e instanceof ContractFunctionRevertedError)
            : null;
          note(
            revert instanceof ContractFunctionRevertedError
              ? `${label} reverted in simulation: ${revert.shortMessage}`
              : `${label} could not be verified: RPC failure is not permission evidence.`,
          );
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

  async function inspectName(name: string) {
    setBusy(true);
    setError(null);
    try {
      if (!sepoliaClient) throw new Error('Sepolia RPC is unavailable');
      await requireSepolia();
      const resolver = await currentResolver(name);
      const payout = await sepoliaClient.getEnsAddress({
        name: normalize(name),
        universalResolverAddress: UNIVERSAL_RESOLVER,
      });
      const text = await sepoliaClient.getEnsText({
        name: normalize(name),
        key: SERVICE_METADATA_KEY,
        universalResolverAddress: UNIVERSAL_RESOLVER,
      });
      note(`Current resolver ${resolver}`);
      note(payout ? `Sepolia payout address ${payout}` : 'No payout address is set on this name');
      note(text ? `${SERVICE_METADATA_KEY}=${text}` : `${SERVICE_METADATA_KEY} is unset`);
      return { resolver, payout, text };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ENS inspect failed';
      setError(message);
      note(message);
      return null;
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
    inspectName,
    fundSecondary,
    updateServiceTextAsSecondary,
    simulateForbiddenAsSecondary,
  };
}
