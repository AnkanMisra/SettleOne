import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("Draft settlement", function () {
  async function fixture() {
    const [payer, other, ...recipients] = await ethers.getSigners();
    const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    const settlement = await (await ethers.getContractFactory("SessionSettlement")).deploy(await usdc.getAddress());
    for (const signer of [payer, other]) {
      await usdc.mint(signer.address, 10000000n);
      await usdc.connect(signer).approve(await settlement.getAddress(), 10000000n);
    }
    const items = recipients.slice(0, 3).map((r, i) => ({ recipient: r.address, amount: BigInt(i + 1) * 1000000n }));
    return { payer, other, usdc, settlement, items, draftId: ethers.id("draft"), expiry: await time.latest() + 3600 };
  }
  for (const count of [2, 3]) {
    it(`pays ${count} recipients exactly and binds events to payer and draft`, async function () {
      const { payer, usdc, settlement, items, draftId, expiry } = await loadFixture(fixture);
      const batch = items.slice(0, count);
      const total = batch.reduce((sum, item) => sum + item.amount, 0n);
      const tx = settlement.settleBatch(draftId, batch, total, expiry);
      await expect(tx).to.emit(settlement, "DraftSettled").withArgs(draftId, payer.address, total, count);
      for (const item of batch) {
        await expect(tx).to.emit(settlement, "DraftPayment").withArgs(draftId, payer.address, item.recipient, item.amount);
        expect(await usdc.balanceOf(item.recipient)).to.equal(item.amount);
      }
      expect(await settlement.isDraftSettled(payer.address, draftId)).to.equal(true);
    });
  }
  it("rejects replay while isolating payers and legacy session IDs", async function () {
    const { payer, other, settlement, items, draftId, expiry } = await loadFixture(fixture);
    await settlement.finalizeSession(draftId, 1n, items[0].recipient);
    await settlement.settleBatch(draftId, items, 6000000n, expiry);
    await expect(settlement.settleBatch(draftId, items, 6000000n, expiry)).to.be.revertedWithCustomError(settlement, "DraftAlreadySettled").withArgs(payer.address, draftId);
    await settlement.connect(other).settleBatch(draftId, items, 6000000n, expiry);
    expect(await settlement.isDraftSettled(other.address, draftId)).to.equal(true);
  });
  it("rejects expired drafts and permits the exact expiry timestamp", async function () {
    const { settlement, items, draftId, expiry } = await loadFixture(fixture);
    await time.setNextBlockTimestamp(expiry);
    await settlement.settleBatch(draftId, items, 6000000n, expiry);
    await expect(settlement.settleBatch(ethers.id("expired"), items, 6000000n, expiry)).to.be.revertedWithCustomError(settlement, "DraftExpired");
  });
  it("enforces the total limit", async function () {
    const { settlement, items, draftId, expiry } = await loadFixture(fixture);
    await expect(settlement.settleBatch(draftId, items, 5999999n, expiry)).to.be.revertedWithCustomError(settlement, "TotalLimitExceeded").withArgs(6000000n, 5999999n);
  });
  it("rejects zero IDs, empty/oversized batches, zero recipients and amounts", async function () {
    const { settlement, items, draftId, expiry } = await loadFixture(fixture);
    await expect(settlement.settleBatch(ethers.ZeroHash, items, 6000000n, expiry)).to.be.revertedWithCustomError(settlement, "InvalidDraftId");
    await expect(settlement.settleBatch(draftId, [], 1n, expiry)).to.be.revertedWithCustomError(settlement, "EmptyBatch");
    await expect(settlement.settleBatch(draftId, Array.from({length: 101}, () => items[0]), 999999999n, expiry)).to.be.revertedWithCustomError(settlement, "BatchTooLarge");
    await expect(settlement.settleBatch(draftId, [{recipient: ethers.ZeroAddress, amount: 1n}], 1n, expiry)).to.be.revertedWithCustomError(settlement, "InvalidRecipient");
    await expect(settlement.settleBatch(draftId, [{recipient: items[0].recipient, amount: 0n}], 1n, expiry)).to.be.revertedWithCustomError(settlement, "InvalidAmount");
  });
  it("rolls back every transfer and replay state when a later transfer fails", async function () {
    const { payer, settlement, usdc, items, draftId, expiry } = await loadFixture(fixture);
    const batch = [items[0], {...items[1], amount: 10000000n}];
    await usdc.approve(await settlement.getAddress(), 11000000n);
    await expect(settlement.settleBatch(draftId, batch, 11000000n, expiry)).to.be.revertedWithCustomError(usdc, "ERC20InsufficientBalance");
    expect(await usdc.balanceOf(items[0].recipient)).to.equal(0n);
    expect(await usdc.balanceOf(payer.address)).to.equal(10000000n);
    expect(await settlement.isDraftSettled(payer.address, draftId)).to.equal(false);
  });
  it("requires allowance and supports a full bounded batch", async function () {
    const { settlement, usdc, items, draftId, expiry } = await loadFixture(fixture);
    await usdc.approve(await settlement.getAddress(), 0n);
    await expect(settlement.settleBatch(draftId, items, 6000000n, expiry)).to.be.revertedWithCustomError(settlement, "InsufficientAllowance");
    await usdc.approve(await settlement.getAddress(), 100n);
    const batch = Array.from({length: 100}, () => ({recipient: items[0].recipient, amount: 1n}));
    await settlement.settleBatch(draftId, batch, 100n, expiry);
    expect(await usdc.balanceOf(items[0].recipient)).to.equal(100n);
  });
  it("rejects aggregate integer overflow", async function () {
    const { settlement, items, draftId, expiry } = await loadFixture(fixture);
    const batch = [{recipient: items[0].recipient, amount: ethers.MaxUint256}, {recipient: items[1].recipient, amount: 1n}];
    await expect(settlement.settleBatch(draftId, batch, ethers.MaxUint256, expiry)).to.be.revertedWithCustomError(settlement, "BatchAmountOverflow");
  });

});
