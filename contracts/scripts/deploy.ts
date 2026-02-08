import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying SessionSettlement contract...");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // USDC addresses per network
  const USDC_ADDRESSES: Record<string, string> = {
    // Mainnets
    mainnet: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    polygon: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    
    // Testnets
    sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle USDC on Sepolia
    baseSepolia: "", // Will deploy mock - no official USDC on Base Sepolia
    arc: process.env.ARC_USDC_ADDRESS || "0x0000000000000000000000000000000000000001", // Placeholder
    
    // Local
    hardhat: "", // Will deploy mock
    localhost: "", // Will deploy mock
  };

  let usdcAddress = USDC_ADDRESSES[network.name];

  // Deploy MockUSDC for local testing or testnets without official USDC
  if (!usdcAddress || network.name === "hardhat" || network.name === "localhost" || network.name === "baseSepolia" || network.name === "sepolia") {
    console.log("\nDeploying MockUSDC for local testing...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log("MockUSDC deployed to:", usdcAddress);

    // Mint some USDC to deployer for testing
    const mintAmount = ethers.parseUnits("1000000", 6); // 1M USDC
    const mintTx = await mockUsdc.mint(deployer.address, mintAmount);
    await mintTx.wait(1); // Wait for 1 confirmation
    console.log("Minted", ethers.formatUnits(mintAmount, 6), "USDC to deployer");
  }

  // Deploy SessionSettlement
  console.log("\nDeploying SessionSettlement...");
  const SessionSettlement = await ethers.getContractFactory("SessionSettlement");
  const settlement = await SessionSettlement.deploy(usdcAddress);
  await settlement.waitForDeployment();

  const settlementAddress = await settlement.getAddress();
  console.log("SessionSettlement deployed to:", settlementAddress);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    contracts: {
      SessionSettlement: settlementAddress,
      USDC: usdcAddress,
    },
    timestamp: new Date().toISOString(),
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info to file
  const deploymentPath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", deploymentPath);

  // Copy ABI to lib/contracts for frontend
  const abiDir = path.join(__dirname, "..", "..", "src", "lib", "contracts");
  if (fs.existsSync(path.join(__dirname, "..", "..", "src"))) {
    if (!fs.existsSync(abiDir)) {
      fs.mkdirSync(abiDir, { recursive: true });
    }

    // Read and save ABI
    const artifactPath = path.join(
      __dirname,
      "..",
      "artifacts",
      "contracts",
      "SessionSettlement.sol",
      "SessionSettlement.json"
    );
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      const abiExport = {
        abi: artifact.abi,
        address: {
          [network.config.chainId || 31337]: settlementAddress,
        },
      };
      fs.writeFileSync(
        path.join(abiDir, "SessionSettlement.json"),
        JSON.stringify(abiExport, null, 2)
      );
      console.log("ABI exported to frontend");
    }
  }

  console.log("\n========================================");
  console.log("Deployment complete!");
  console.log("========================================");
  console.log("SessionSettlement:", settlementAddress);
  console.log("USDC:", usdcAddress);
  console.log("========================================");

  // Verify instructions for testnets
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nTo verify on block explorer:");
    console.log(`npx hardhat verify --network ${network.name} ${settlementAddress} ${usdcAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
