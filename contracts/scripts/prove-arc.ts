import { ethers } from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ARC_CHAIN_ID, ARC_USDC, verifyArc } from "./arc";

async function main() {
  const usdc = await verifyArc();
  const [payer] = await ethers.getSigners();
  if (!payer) throw new Error("A funded testnet PRIVATE_KEY must be supplied through the environment");
  if (await usdc.balanceOf(payer.address) < 1000000n) throw new Error("Fund the payer with at least 1 testnet USDC for proof transactions and gas");
  const contract = await (await ethers.getContractFactory("SessionSettlement")).deploy(ARC_USDC);
  const deploymentTx = contract.deploymentTransaction();
  if (!deploymentTx) throw new Error("Missing deployment transaction");
  const deployment = await deploymentTx.wait();
  if (!deployment || deployment.status !== 1) throw new Error("Deployment failed");
  const address = await contract.getAddress();
  const batches: unknown[] = [];
  const evidence = {
    chainId: Number(ARC_CHAIN_ID), usdc: ARC_USDC, erc20Decimals: 6, nativeDecimals: 18,
    payer: payer.address, settlement: address, deploymentTxHash: deployment.hash,
    deploymentBlock: deployment.blockNumber, batches,
  };
  const dir = join(__dirname, "..", "deployments");
  mkdirSync(dir, {recursive: true});
  const file = join(dir, `arc-proof-${Date.now()}.json`);
  const save = () => writeFileSync(file, JSON.stringify(evidence, null, 2) + "\n");
  save();
  for (const count of [2, 3]) {
    const payments = Array.from({length: count}, (_, i) => ({recipient: ethers.Wallet.createRandom().address, amount: BigInt(i + 1) * 1000n}));
    const total = payments.reduce((sum, payment) => sum + payment.amount, 0n);
    const draftId = ethers.hexlify(ethers.randomBytes(32));
    const latest = await ethers.provider.getBlock("latest");
    if (!latest) throw new Error("Missing latest block");
    const expiresAt = latest.timestamp + 600;
    const approval = await (await usdc.connect(payer).approve(address, total)).wait();
    if (!approval || approval.status !== 1) throw new Error("Approval failed");
    const before = await Promise.all(payments.map(payment => usdc.balanceOf(payment.recipient)));
    const receipt = await (await contract.settleBatch(draftId, payments, total, expiresAt)).wait();
    if (!receipt || receipt.status !== 1) throw new Error("Settlement failed");
    const balancesAfter: string[] = [];
    const record = {
      draftId, payer: payer.address, totalLimit: total.toString(), expiresAt,
      approvalTxHash: approval.hash, transactionHash: receipt.hash, blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash, recipientCount: count,
      payments: payments.map(payment => ({recipient: payment.recipient, amount: payment.amount.toString()})),
      logs: receipt.logs.map(log => ({address: log.address, topics: [...log.topics], data: log.data})),
      balancesBefore: before.map(balance => balance.toString()),
      balancesAfter,
      verified: false,
    };
    batches.push(record);
    save();
    const paymentEvents = receipt.logs.filter(log => log.address.toLowerCase() === address.toLowerCase())
      .map(log => contract.interface.parseLog(log)).filter(event => event?.name === "DraftPayment");
    if (paymentEvents.length !== count) throw new Error("Recipient event count mismatch");
    const summaries = receipt.logs.filter(log => log.address.toLowerCase() === address.toLowerCase())
      .map(log => contract.interface.parseLog(log)).filter(event => event?.name === "DraftSettled");
    const summary = summaries[0];
    if (summaries.length !== 1 || !summary || summary.args.draftId !== draftId || summary.args.payer !== payer.address || summary.args.totalAmount !== total || summary.args.recipientCount !== BigInt(count)) throw new Error("Draft summary mismatch");
    const after = await Promise.all(payments.map(payment => usdc.balanceOf(payment.recipient)));
    record.balancesAfter = after.map(balance => balance.toString());
    for (const [i, payment] of payments.entries()) {
      const event = paymentEvents[i];
      if (!event || event.args.draftId !== draftId || event.args.payer !== payer.address || event.args.recipient !== payment.recipient || event.args.amount !== payment.amount) throw new Error("Recipient event mismatch");
      if (after[i] - before[i] !== payment.amount) throw new Error("Recipient balance delta mismatch");
    }
    if (!await contract.isDraftSettled(payer.address, draftId)) throw new Error("Replay state not recorded");
    await expectRevert(() => contract.settleBatch.staticCall(draftId, payments, total, expiresAt), "DraftAlreadySettled");
    await expectRevert(() => contract.settleBatch.staticCall(ethers.hexlify(ethers.randomBytes(32)), payments, total - 1n, expiresAt), "TotalLimitExceeded");
    await expectRevert(() => contract.settleBatch.staticCall(ethers.hexlify(ethers.randomBytes(32)), payments, total, 1), "DraftExpired");
    record.verified = true;
    save();
  }
  process.stdout.write(JSON.stringify({evidenceFile: file, ...evidence}, null, 2) + "\n");

  async function expectRevert(action: () => Promise<unknown>, expected: string) {
    try { await action(); }
    catch (error: unknown) {
      if (typeof error === "object" && error !== null && "data" in error && typeof error.data === "string") {
        if (contract.interface.parseError(error.data)?.name === expected) return;
      }
      throw new Error(`Expected ${expected}; received a different RPC failure`);
    }
    throw new Error(`Expected ${expected}; call unexpectedly succeeded`);
  }
}
main().catch(() => {
  process.stderr.write("Arc proof failed. Check the testnet RPC and funded PRIVATE_KEY. Saved receipts remain in contracts/deployments; unverified evidence is marked false.\n");
  process.exitCode = 1;
});
