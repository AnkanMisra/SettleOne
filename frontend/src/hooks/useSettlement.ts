'use client';
import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { encodeFunctionData, erc20Abi, getAddress, isHex, parseAbi } from 'viem';
import { arcTestnet } from '@/lib/wagmi';
import type { SessionData } from '@/lib/api';
import { api } from '@/lib/api';

const batchAbi = parseAbi([
  'function settleBatch(bytes32 draftId, (address recipient,uint256 amount)[] settlements, uint256 totalLimit, uint256 expiresAt)',
]);
export const ARC_USDC = '0x3600000000000000000000000000000000000000' as const;
export function retainedTxKey(sessionId: string) {
  return `settleone.tx:${sessionId}`;
}

function walletRejected(message: string) {
  return /user rejected|denied transaction|rejected the request/i.test(message);
}

export function useSettlement() {
  const { address, chainId } = useAccount();
  const client = usePublicClient({ chainId: arcTestnet.id });
  const { data: wallet } = useWalletClient();
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  async function settle(
    session: SessionData,
    submitted: (hash: string) => Promise<unknown>,
  ) {
    setPending(true);
    setError(null);
    let sent = false;
    try {
      if (!wallet || !client || !address || chainId !== arcTestnet.id) {
        throw new Error('Connect your payer wallet on Arc Testnet');
      }
      const retained =
        typeof window === 'undefined' ? null : localStorage.getItem(retainedTxKey(session.id));
      if (session.status === 'submitted' || session.status === 'confirmed') {
        const hash = session.tx_hash || retained;
        if (!hash) throw new Error('No transaction hash to verify');
        setProgress('Verifying the Arc receipt');
        await submitted(hash);
        return;
      }
      if (retained && session.status === 'awaiting_approval' && !session.tx_hash) {
        throw new Error(
          'A transaction hash is already retained for this draft. Verify that receipt before sending another batch.',
        );
      }
      const draft = session.prepared;
      if (
        !draft ||
        session.status !== 'awaiting_approval' ||
        session.user.toLowerCase() !== address.toLowerCase()
      ) {
        throw new Error('Prepare a fresh draft for this wallet');
      }
      if (draft.expires_at <= Math.floor(Date.now() / 1000)) {
        throw new Error('Draft expired. Return to editing and prepare again');
      }
      if (!isHex(draft.draft_id) || !isHex(draft.calldata)) {
        throw new Error('Invalid prepared draft');
      }
      const contract = getAddress(draft.contract);
      const data = encodeFunctionData({
        abi: batchAbi,
        functionName: 'settleBatch',
        args: [
          draft.draft_id,
          session.payments.map((p) => ({
            recipient: getAddress(p.recipient),
            amount: BigInt(p.amount),
          })),
          BigInt(draft.total_limit),
          BigInt(draft.expires_at),
        ],
      });
      if (
        session.chain_id !== arcTestnet.id ||
        session.token.toLowerCase() !== ARC_USDC.toLowerCase() ||
        data.toLowerCase() !== draft.calldata.toLowerCase()
      ) {
        throw new Error('Prepared transaction differs from this preview');
      }
      const rpcChain = await client.getChainId();
      if (rpcChain !== arcTestnet.id) {
        throw new Error('Switch MetaMask to Arc Testnet before paying');
      }
      const [decimals, tokenBalance, allowance, nativeBefore] = await Promise.all([
        client.readContract({ address: ARC_USDC, abi: erc20Abi, functionName: 'decimals' }),
        client.readContract({
          address: ARC_USDC,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        }),
        client.readContract({
          address: ARC_USDC,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, contract],
        }),
        client.getBalance({ address }),
      ]);
      if (decimals !== session.token_decimals) throw new Error('Token decimals changed');
      const total = BigInt(session.total_amount);
      const nativeAsToken = nativeBefore / (BigInt(10) ** BigInt(12));
      const spendable = tokenBalance > nativeAsToken ? tokenBalance : nativeAsToken;
      if (spendable < total) {
        throw new Error(
          'This Arc wallet does not have enough USDC for the batch. Confirm Arc Testnet and the same account that holds the faucet USDC.',
        );
      }
      if (allowance < total) {
        setProgress('Approve the exact USDC total in your wallet');
        const approvalData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [contract, total],
        });
        const gas = await client.estimateGas({
          account: address,
          to: ARC_USDC,
          data: approvalData,
        });
        const fees = await client.estimateFeesPerGas();
        const maxFee = fees.maxFeePerGas ?? fees.gasPrice ?? BigInt(0);
        if (nativeBefore < total * BigInt(10) ** BigInt(12) + gas * maxFee * BigInt(2)) {
          throw new Error('Not enough Arc USDC left for approval gas plus the batch');
        }
        const approvalHash = await wallet.sendTransaction({
          account: address,
          chain: arcTestnet,
          to: ARC_USDC,
          data: approvalData,
        });
        const approvalReceipt = await client.waitForTransactionReceipt({ hash: approvalHash });
        if (approvalReceipt.status !== 'success') throw new Error('USDC approval reverted');
      }
      setProgress('Review and sign the exact payment batch');
      const gas = await client.estimateGas({ account: address, to: contract, data });
      const fees = await client.estimateFeesPerGas();
      const maxFee = fees.maxFeePerGas ?? fees.gasPrice ?? BigInt(0);
      const nativeAfter = await client.getBalance({ address });
      if (nativeAfter < total * BigInt(10) ** BigInt(12) + gas * maxFee * BigInt(2)) {
        throw new Error('Not enough Arc USDC left for gas after the batch');
      }
      await api.beginSigning(session.id, draft.draft_id);
      const hash = await wallet.sendTransaction({
        account: address,
        chain: arcTestnet,
        to: contract,
        data,
      });
      sent = true;
      localStorage.setItem(retainedTxKey(session.id), hash);
      // An RPC may not see a just-broadcast transaction yet. Retain the hash and
      // keep waiting even when the initial reconciliation cannot complete.
      try { await submitted(hash); } catch { /* Final verification below reports failure. */ }
      setProgress('Waiting for Arc inclusion');
      const receipt = await client.waitForTransactionReceipt({
        hash,
        onReplaced: ({ transactionReceipt }) => {
          localStorage.setItem(retainedTxKey(session.id), transactionReceipt.transactionHash);
        },
      });
      setProgress('Verifying the Arc receipt');
      await submitted(receipt.transactionHash);
      if (receipt.status !== 'success') {
        throw new Error('Settlement reverted; no batch payments settled');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Payment failed';
      if (walletRejected(message)) {
        setError('Wallet rejected the signature. If signing was locked, refresh the session and wait for expiry before resetting.');
      } else {
        setError(
          message +
            (sent
              ? '. Transaction retained; use Verify receipt.'
              : '. No settlement transaction was submitted.'),
        );
      }
    } finally {
      setPending(false);
      setProgress('');
    }
  }

  return { settle, isPending, error, progress };
}
