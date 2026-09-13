import { ethers, network } from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ARC_USDC, verifyArc } from "./arc";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("Provide a funded testnet PRIVATE_KEY through the environment");
  const chain = await ethers.provider.getNetwork();
  const local = network.name === "hardhat" || network.name === "localhost";
  const addresses: Record<string, string> = {
    arc: ARC_USDC,
    sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  };
  const expectedChains: Record<string, bigint> = {arc: 5042002n, sepolia: 11155111n, baseSepolia: 84532n};
  let usdcAddress = addresses[network.name];
  if (local) {
    if (chain.chainId !== 31337n) throw new Error("Local chain ID mismatch");
    const mock = await (await ethers.getContractFactory("MockUSDC")).deploy();
    await mock.waitForDeployment();
    usdcAddress = await mock.getAddress();
    await (await mock.mint(deployer.address, ethers.parseUnits("1000000", 6))).wait();
  } else {
    if (!usdcAddress || chain.chainId !== expectedChains[network.name]) throw new Error("Unsupported testnet or chain ID mismatch");
    if (network.name === "arc") await verifyArc();
  }
  const usdc = await ethers.getContractAt("IERC20Metadata", usdcAddress);
  const decimals = await usdc.decimals();
  if (decimals !== 6n) throw new Error("Expected six-decimal USDC");
  const settlement = await (await ethers.getContractFactory("SessionSettlement")).deploy(usdcAddress);
  const tx = settlement.deploymentTransaction();
  if (!tx) throw new Error("Missing deployment transaction");
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  const address = await settlement.getAddress();
  if (await ethers.provider.getCode(address) === "0x") throw new Error("Deployment has no bytecode");
  const evidence = {
    network: network.name, chainId: Number(chain.chainId), deployer: deployer.address,
    contracts: {SessionSettlement: address, USDC: usdcAddress},
    usdcDecimals: Number(decimals), deploymentTxHash: receipt.hash,
    blockNumber: receipt.blockNumber, blockHash: receipt.blockHash,
    timestamp: new Date().toISOString(), mock: local,
  };
  const dir = join(__dirname, "..", "deployments");
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, `${network.name}.json`), JSON.stringify(evidence, null, 2) + "\n");
  process.stdout.write(JSON.stringify(evidence, null, 2) + "\n");
}
main().catch(() => {
  process.stderr.write("Deployment failed. Check testnet network, funded PRIVATE_KEY, and USDC configuration. No evidence was fabricated.\n");
  process.exitCode = 1;
});
