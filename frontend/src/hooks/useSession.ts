'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { api, type SessionData } from '@/lib/api';

export interface UseSessionReturn {
  session: SessionData | null;
  isLoading: boolean;
  error: string | null;
  createSession: () => Promise<string | null>;
  addPayment: (
    recipient: string,
    amount: string,
    recipientENS?: string
  ) => Promise<boolean>;
  finalizeSession: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
}

export function useSession(): UseSessionReturn {
  const { address } = useAccount();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(async (): Promise<string | null> => {
    if (!address) {
      setError('Wallet not connected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.createSession(address);
      // Fetch full session data
      const sessionResponse = await api.getSession(response.session_id);
      if (sessionResponse.session) {
        setSession(sessionResponse.session);
      }
      return response.session_id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const addPayment = useCallback(
    async (
      recipient: string,
      amount: string,
      recipientENS?: string
    ): Promise<boolean> => {
      if (!session) {
        setError('No active session');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await api.addPayment(session.id, {
          recipient,
          amount,
          recipient_ens: recipientENS,
        });

        if (response.error) {
          setError(response.error);
          return false;
        }

        if (response.session) {
          setSession(response.session);
        }
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add payment';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [session]
  );

  const finalizeSession = useCallback(async (): Promise<string | null> => {
    if (!session) {
      setError('No active session');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.finalizeSession(session.id);

      if (response.error) {
        setError(response.error);
        return null;
      }

      // Clear session after finalization
      if (response.tx_hash) {
        setSession(null);
      }
      return response.tx_hash;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to finalize session';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const refreshSession = useCallback(async () => {
    if (!session) return;

    setIsLoading(true);
    try {
      const response = await api.getSession(session.id);
      if (response.session) {
        setSession(response.session);
      }
    } catch (err) {
      console.error('Failed to refresh session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  return {
    session,
    isLoading,
    error,
    createSession,
    addPayment,
    finalizeSession,
    refreshSession,
  };
}
