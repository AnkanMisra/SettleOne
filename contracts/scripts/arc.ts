import { ethers } from "hardhat";

// https://docs.arc.io/integrate/infrastructure
export const ARC_CHAIN_ID = 5042002n;
export const ARC_USDC = "0x3600000000000000000000000000000000000000";
export const ARC_ERC20_DECIMALS = 6;
export const ARC_NATIVE_DECIMALS = 18;

export async function verifyArc() {
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== ARC_CHAIN_ID) throw new Error("Arc testnet chain ID mismatch; refusing transaction");
  const usdc = await ethers.getContractAt("IERC20Metadata", ARC_USDC);
  if (await usdc.decimals() !== BigInt(ARC_ERC20_DECIMALS)) throw new Error("Arc USDC decimals mismatch");
  return usdc;
}
