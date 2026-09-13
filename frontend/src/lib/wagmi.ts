import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ARC_RPC || 'https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' } },
  testnet: true,
});
export const config = createConfig({
  chains: [arcTestnet, sepolia],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'),
  },
});
declare module 'wagmi' { interface Register { config: typeof config } }
