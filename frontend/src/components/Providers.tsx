'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '@/lib/wagmi';
import { useState, useSyncExternalStore, type ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

// SSR-safe way to check if we're on the client
function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function Providers({ children }: ProvidersProps) {
  const mounted = useIsMounted();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-950">
        {/* Loading placeholder to prevent layout shift */}
      </div>
    );
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
