import { http, createConfig } from 'wagmi';
import { mainnet, sepolia, arbitrum, polygon, optimism, base, baseSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// Define Arc testnet chain (placeholder - update with actual values)
export const arcTestnet = {
  id: 4457845,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC || 'https://rpc.arc.circle.com'],
    },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.circle.com' },
  },
  testnet: true,
} as const;

export const config = createConfig({
  chains: [mainnet, sepolia, baseSepolia, base, arbitrum, polygon, optimism, arcTestnet],
  connectors: [
    // MetaMask via injected connector
    injected({
      target: 'metaMask',
    }),
    // Also support any injected wallet (Phantom, etc.)
    injected(),
  ],
  transports: {
    [mainnet.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_ID
        ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_ID}`
        : undefined
    ),
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_ID
        ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_ID}`
        : undefined
    ),
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [base.id]: http('https://mainnet.base.org'),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arcTestnet.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
