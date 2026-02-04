'use client';

/**
 * useYellow Hook
 *
 * React hook for managing Yellow Network state channel sessions.
 * Provides instant off-chain payments with later on-chain settlement.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import {
  YellowSession,
  YellowSessionState,
  YellowMessage,
  YellowPayment,
  type MessageSigner,
} from '@/lib/yellow';

export interface UseYellowReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Session state
  sessionId: string | null;
  isCreatingSession: boolean;
  payments: YellowPayment[];
  totalSent: bigint;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  createSession: (partnerAddress: string) => Promise<string | null>;
  sendPayment: (recipient: string, amount: string) => Promise<boolean>;
  getPaymentsForSettlement: () => Array<{ recipient: string; amount: bigint }>;

  // Events
  lastMessage: YellowMessage | null;
}

export function useYellow(): UseYellowReturn {
  const { address, isConnected: walletConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const sessionRef = useRef<YellowSession | null>(null);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Session state
  const [sessionState, setSessionState] = useState<YellowSessionState>({
    sessionId: null,
    isConnected: false,
    payments: [],
    totalSent: BigInt(0),
  });
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [lastMessage, setLastMessage] = useState<YellowMessage | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.disconnect();
        sessionRef.current = null;
      }
    };
  }, []);

  // Update session state periodically
  useEffect(() => {
    if (!sessionRef.current || !isConnected) return;

    const interval = setInterval(() => {
      if (sessionRef.current) {
        setSessionState(sessionRef.current.getState());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  /**
   * Connect to Yellow Network
   */
  const connect = useCallback(async () => {
    if (!address || !walletClient) {
      setConnectionError('Wallet not connected');
      return;
    }

    if (sessionRef.current?.getState().isConnected) {
      return; // Already connected
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Create message signer from wallet - returns Hex type
      const messageSigner: MessageSigner = async (message: string) => {
        const signature = await walletClient.signMessage({
          message,
          account: address,
        });
        return signature;
      };

      // Create Yellow session instance
      const session = new YellowSession({
        userAddress: address,
        messageSigner,
        onConnect: () => {
          setIsConnected(true);
          setConnectionError(null);
        },
        onDisconnect: () => {
          setIsConnected(false);
        },
        onMessage: (message) => {
          setLastMessage(message);
          if (sessionRef.current) {
            setSessionState(sessionRef.current.getState());
          }
        },
        onError: (error) => {
          setConnectionError(error.message);
        },
      });

      await session.connect();
      sessionRef.current = session;
      setSessionState(session.getState());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to connect to Yellow Network';
      setConnectionError(message);
      console.error('[useYellow] Connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [address, walletClient]);

  /**
   * Disconnect from Yellow Network
   */
  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }
    setIsConnected(false);
    setSessionState({
      sessionId: null,
      isConnected: false,
      payments: [],
      totalSent: BigInt(0),
    });
    setLastMessage(null);
  }, []);

  /**
   * Create a new payment session
   */
  const createSession = useCallback(
    async (partnerAddress: string): Promise<string | null> => {
      if (!sessionRef.current || !isConnected) {
        setConnectionError('Not connected to Yellow Network');
        return null;
      }

      setIsCreatingSession(true);
      setConnectionError(null);

      try {
        const sessionId =
          await sessionRef.current.createSession(partnerAddress);
        setSessionState(sessionRef.current.getState());
        return sessionId;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create session';
        setConnectionError(message);
        console.error('[useYellow] Session creation error:', err);
        return null;
      } finally {
        setIsCreatingSession(false);
      }
    },
    [isConnected]
  );

  /**
   * Send an instant payment
   */
  const sendPayment = useCallback(
    async (recipient: string, amount: string): Promise<boolean> => {
      if (!sessionRef.current || !isConnected) {
        setConnectionError('Not connected to Yellow Network');
        return false;
      }

      if (!sessionState.sessionId) {
        setConnectionError('No active session');
        return false;
      }

      try {
        await sessionRef.current.sendPayment(recipient, amount);
        setSessionState(sessionRef.current.getState());
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to send payment';
        setConnectionError(message);
        console.error('[useYellow] Payment error:', err);
        return false;
      }
    },
    [isConnected, sessionState.sessionId]
  );

  /**
   * Get payments aggregated for on-chain settlement
   */
  const getPaymentsForSettlement = useCallback(() => {
    if (!sessionRef.current) {
      return [];
    }
    return sessionRef.current.getPaymentsForSettlement();
  }, []);

  // Auto-connect when wallet connects
  useEffect(() => {
    if (walletConnected && address && walletClient && !isConnected && !isConnecting) {
      // Don't auto-connect, let the user initiate
      // connect();
    }
  }, [walletConnected, address, walletClient, isConnected, isConnecting]);

  return {
    // Connection state
    isConnected,
    isConnecting,
    connectionError,

    // Session state
    sessionId: sessionState.sessionId,
    isCreatingSession,
    payments: sessionState.payments,
    totalSent: sessionState.totalSent,

    // Actions
    connect,
    disconnect,
    createSession,
    sendPayment,
    getPaymentsForSettlement,

    // Events
    lastMessage,
  };
}
