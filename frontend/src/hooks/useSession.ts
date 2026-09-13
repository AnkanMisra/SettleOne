'use client';
import { useState, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { api, type SessionData } from '@/lib/api';

export function useSession() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [stored, setStored] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = stored?.user.toLowerCase() === address?.toLowerCase() ? stored : null;
  const accept = useCallback((next: SessionData) => {
    setStored(next);
    localStorage.setItem(`settleone.session.v2:${next.user.toLowerCase()}`, next.id);
    return next;
  }, []);
  const authenticate = useCallback(async () => {
    if (!address) throw new Error('Connect your wallet first');
    api.setToken(null);
    const challenge = await api.challenge(address);
    const signature = await signMessageAsync({ message: challenge.message });
    const result = await api.authenticate(challenge.challenge_id, signature);
    api.setToken(result.token);
  }, [address, signMessageAsync]);
  const run = useCallback(async (action: () => Promise<SessionData>) => {
    setIsLoading(true); setError(null);
    try { return accept(await action()); }
    catch (error) { setError(error instanceof Error ? error.message : 'Request failed'); return null; }
    finally { setIsLoading(false); }
  }, [accept]);
  return {
    session, isLoading, error,
    createSession: (budget: string) => run(async () => { await authenticate(); return (await api.createSession(address || '', budget)).session; }),
    restoreSession: () => run(async () => {
      await authenticate();
      const id = localStorage.getItem(`settleone.session.v2:${address?.toLowerCase()}`);
      if (!id) throw new Error('No saved session for this wallet');
      return (await api.getSession(id)).session;
    }),
    addPayment: (recipient: string, amount: string, recipient_ens?: string) => run(async () => {
      if (!session) throw new Error('No active session');
      return (await api.addPayment(session.id, {recipient, amount, recipient_ens})).session;
    }),
    removePayment: (paymentId: string) => run(async () => {
      if (!session) throw new Error('No active session');
      return (await api.removePayment(session.id, paymentId)).session;
    }),
    prepareSession: () => run(async () => {
      if (!session) throw new Error('No active session');
      return (await api.prepareSession(session.id)).session;
    }),
    resetSession: () => run(async () => {
      if (!session) throw new Error('No active session');
      return (await api.resetSession(session.id)).session;
    }),
    finalizeSession: (hash: string) => run(async () => {
      if (!session) throw new Error('No active session');
      return (await api.finalizeSession(session.id, hash)).session;
    }),
    refreshSession: () => run(async () => {
      if (!session) throw new Error('No active session');
      return (await api.getSession(session.id)).session;
    }),
  };
}
