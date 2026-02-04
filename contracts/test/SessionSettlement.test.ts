import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { SessionSettlement, MockUSDC } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SessionSettlement", function () {
  // Test constants
  const INITIAL_USDC_SUPPLY = ethers.parseUnits("1000000", 6); // 1M USDC
  const SETTLEMENT_AMOUNT = ethers.parseUnits("100", 6); // 100 USDC

  // Fixture to deploy contracts
  async function deployContractsFixture() {
    const [owner, user1, user2, recipient1, recipient2] =
      await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    // Deploy SessionSettlement
    const SessionSettlement =
      await ethers.getContractFactory("SessionSettlement");
    const settlement = await SessionSettlement.deploy(await usdc.getAddress());

    // Mint USDC to owner for settlements (new approach: sender approves and transfers)
    await usdc.mint(owner.address, INITIAL_USDC_SUPPLY);
    
    // Approve the settlement contract to spend owner's USDC
    await usdc.approve(await settlement.getAddress(), INITIAL_USDC_SUPPLY);

    // Also mint some USDC to the contract for emergencyWithdraw tests
    await usdc.mint(await settlement.getAddress(), INITIAL_USDC_SUPPLY);

    return { settlement, usdc, owner, user1, user2, recipient1, recipient2 };
  }

  // Helper function to generate a session ID
  function generateSessionId(user: string, nonce: number): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint256"],
        [user, nonce, Date.now()],
      ),
    );
  }

  describe("Deployment", function () {
    it("should set the correct USDC address", async function () {
      const { settlement, usdc } = await loadFixture(deployContractsFixture);
      expect(await settlement.usdc()).to.equal(await usdc.getAddress());
    });

    it("should set the deployer as owner", async function () {
      const { settlement, owner } = await loadFixture(deployContractsFixture);
      expect(await settlement.owner()).to.equal(owner.address);
    });

    it("should have the correct initial USDC balance", async function () {
      const { settlement } = await loadFixture(deployContractsFixture);
      expect(await settlement.getBalance()).to.equal(INITIAL_USDC_SUPPLY);
    });

    it("should revert with zero USDC address", async function () {
      const SessionSettlement =
        await ethers.getContractFactory("SessionSettlement");
      await expect(
        SessionSettlement.deploy(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(SessionSettlement, "InvalidUSDCAddress");
    });
  });

  describe("Session Management", function () {
    describe("startSession", function () {
      it("should start a session successfully", async function () {
        const { settlement, user1 } = await loadFixture(deployContractsFixture);
        const sessionId = generateSessionId(user1.address, 1);

        await expect(settlement.startSession(sessionId, user1.address))
          .to.emit(settlement, "SessionStarted")
          .withArgs(
            sessionId,
            user1.address,
            (timestamp: bigint) => timestamp > 0n,
          );

        const session = await settlement.getSession(sessionId);
        expect(session.user).to.equal(user1.address);
        expect(session.active).to.be.true;
      });

      it("should revert when session already exists", async function () {
        const { settlement, user1 } = await loadFixture(deployContractsFixture);
        const sessionId = generateSessionId(user1.address, 1);

        await settlement.startSession(sessionId, user1.address);

        await expect(settlement.startSession(sessionId, user1.address))
          .to.be.revertedWithCustomError(settlement, "SessionAlreadyExists")
          .withArgs(sessionId);
      });

      it("should revert with zero address user", async function () {
        const { settlement } = await loadFixture(deployContractsFixture);
        const sessionId = generateSessionId(ethers.ZeroAddress, 1);

        await expect(
          settlement.startSession(sessionId, ethers.ZeroAddress),
        ).to.be.revertedWithCustomError(settlement, "InvalidRecipient");
      });
    });
  });

  describe("Single Settlement", function () {
    describe("finalizeSession", function () {
      it("should finalize a session and transfer USDC", async function () {
        const { settlement, usdc, owner, user1, recipient1 } = await loadFixture(
          deployContractsFixture,
        );
        const sessionId = generateSessionId(user1.address, 1);

        // Start session first
        await settlement.startSession(sessionId, user1.address);

        // Check initial balances
        const initialRecipientBalance = await usdc.balanceOf(
          recipient1.address,
        );
        const initialOwnerBalance = await usdc.balanceOf(owner.address);

        // Finalize session (transfers from msg.sender via safeTransferFrom)
        await expect(
          settlement.finalizeSession(
            sessionId,
            SETTLEMENT_AMOUNT,
            recipient1.address,
          ),
        )
          .to.emit(settlement, "SessionSettled")
          .withArgs(
            sessionId,
            recipient1.address,
            SETTLEMENT_AMOUNT,
            (timestamp: bigint) => timestamp > 0n,
          );

        // Check balances after - USDC transferred from owner to recipient
        expect(await usdc.balanceOf(recipient1.address)).to.equal(
          initialRecipientBalance + SETTLEMENT_AMOUNT,
        );
        expect(await usdc.balanceOf(owner.address)).to.equal(
          initialOwnerBalance - SETTLEMENT_AMOUNT,
        );

        // Check session is marked as settled
        expect(await settlement.isSessionSettled(sessionId)).to.be.true;

        // Check session is deactivated
        const session = await settlement.getSession(sessionId);
        expect(session.active).to.be.false;
      });

      it("should finalize session without prior startSession call", async function () {
        const { settlement, usdc, user1, recipient1 } = await loadFixture(
          deployContractsFixture,
        );
        const sessionId = generateSessionId(user1.address, 1);

        // Finalize without starting (Yellow SDK may handle session start off-chain)
        await expect(
          settlement.finalizeSession(
            sessionId,
            SETTLEMENT_AMOUNT,
            recipient1.address,
          ),
        ).to.emit(settlement, "SessionSettled");

        expect(await usdc.balanceOf(recipient1.address)).to.equal(
          SETTLEMENT_AMOUNT,
        );
        expect(await settlement.isSessionSettled(sessionId)).to.be.true;
      });

      it("should revert when session already settled", async function () {
        const { settlement, user1, recipient1 } = await loadFixture(
          deployContractsFixture,
        );
        const sessionId = generateSessionId(user1.address, 1);

        await settlement.finalizeSession(
          sessionId,
          SETTLEMENT_AMOUNT,
          recipient1.address,
        );

        await expect(
          settlement.finalizeSession(
            sessionId,
            SETTLEMENT_AMOUNT,
            recipient1.address,
          ),
        )
          .to.be.revertedWithCustomError(settlement, "SessionAlreadySettled")
          .withArgs(sessionId);
      });

      it("should revert with zero recipient address", async function () {
        const { settlement, user1 } = await loadFixture(deployContractsFixture);
        const sessionId = generateSessionId(user1.address, 1);

        await expect(
          settlement.finalizeSession(
            sessionId,
            SETTLEMENT_AMOUNT,
            ethers.ZeroAddress,
          ),
        ).to.be.revertedWithCustomError(settlement, "InvalidRecipient");
      });

      it("should revert with zero amount", async function () {
        const { settlement, user1, recipient1 } = await loadFixture(
          deployContractsFixture,
        );
        const sessionId = generateSessionId(user1.address, 1);

        await expect(
          settlement.finalizeSession(sessionId, 0, recipient1.address),
        ).to.be.revertedWithCustomError(settlement, "InvalidAmount");
      });

      it("should revert with insufficient sender allowance", async function () {
        const { settlement, usdc, user1, recipient1 } = await loadFixture(
          deployContractsFixture,
        );
        const sessionId = generateSessionId(user1.address, 1);
        
        // Try to settle more than the owner has approved
        const excessiveAmount = INITIAL_USDC_SUPPLY + 1n;

        // This will revert with ERC20 error since sender doesn't have enough allowance
        await expect(
          settlement.finalizeSession(
            sessionId,
            excessiveAmount,
            recipient1.address,
          ),
        ).to.be.revertedWithCustomError(usdc, "ERC20InsufficientAllowance");
      });
    });
  });

  describe("Batch Settlement", function () {
    describe("finalizeSessionBatch", function () {
      it("should finalize batch with multiple recipients", async function () {
        const { settlement, usdc, user1, recipient1, recipient2 } =
          await loadFixture(deployContractsFixture);
        const sessionId = generateSessionId(user1.address, 1);

        const settlements = [
          { recipient: recipient1.address, amount: SETTLEMENT_AMOUNT },
          { recipient: recipient2.address, amount: SETTLEMENT_AMOUNT * 2n },
        ];

        const totalAmount = SETTLEMENT_AMOUNT + SETTLEMENT_AMOUNT * 2n;

        await expect(settlement.finalizeSessionBatch(sessionId, settlements))
          .to.emit(settlement, "BatchSettled")
          .withArgs(sessionId, totalAmount, 2);

        expect(await usdc.balanceOf(recipient1.address)).to.equal(
          SETTLEMENT_AMOUNT,
        );
        expect(await usdc.balanceOf(recipient2.address)).to.equal(
          SETTLEMENT_AMOUNT * 2n,
        );
        expect(await settlement.isSessionSettled(sessionId)).to.be.true;
      });

      it("should emit individual SessionSettled events for each recipient", async function () {
        const { settlement, user1, recipient1, recipient2 } = await loadFixture(
          deployContractsFixture,
        );
        const sessionId = generateSessionId(user1.address, 1);

        const settlements = [
          { recipient: recipient1.address, amount: SETTLEMENT_AMOUNT },
          { recipient: recipient2.address, amount: SETTLEMENT_AMOUNT },
        ];

        const tx = await settlement.finalizeSessionBatch(
          sessionId,
          settlements,
        );
        const receipt = await tx.wait();

        // Should have 2 SessionSettled events + 1 BatchSettled event
        const settledEvents = receipt?.logs.filter(
          (log) =>
            log.topics[0] ===
            settlement.interface.getEvent("SessionSettled").topicHash,
        );
        expect(settledEvents?.length).to.equal(2);
      });

      it("should revert with empty batch", async function () {
        const { settlement, user1 } = await loadFixture(deployContractsFixture);
        const sessionId = generateSessionId(user1.address, 1);

        await expect(
          settlement.finalizeSessionBatch(sessionId, []),
        ).to.be.revertedWithCustomError(settlement, "EmptyBatch");
      });

      it("should revert when session already settled", async function () {
        const { settlement, user1, recipient1 } = await loadFixture(
          deployContractsFixture,
        );
        const sessionId = generateSessionId(user1.address, 1);

        const settlements = [
          { recipient: recipient1.address, amount: SETTLEMENT_AMOUNT },
        ];

        await settlement.finalizeSessionBatch(sessionId, settlements);

        await expect(
          settlement.finalizeSessionBatch(sessionId, settlements),
        ).to.be.revertedWithCustomError(settlement, "SessionAlreadySettled");
      });

      it("should revert with zero recipient in batch", async function () {
        const { settlement, user1, recipient1 } = await loadFixture(
          deployContractsFixture,
        );
        const sessionId = generateSessionId(user1.address, 1);

        const settlements = [
          { recipient: recipient1.address, amount: SETTLEMENT_AMOUNT },
          { recipient: ethers.ZeroAddress, amount: SETTLEMENT_AMOUNT },
        ];

        await expect(
          settlement.finalizeSessionBatch(sessionId, settlements),
        ).to.be.revertedWithCustomError(settlement, "InvalidRecipient");
      });

      it("should revert with zero amount in batch", async function () {
        const { settlement, user1, recipient1 } = await loadFixture(
          deployContractsFixture,
        );
        const sessionId = generateSessionId(user1.address, 1);

        const settlements = [
          { recipient: recipient1.address, amount: SETTLEMENT_AMOUNT },
          { recipient: recipient1.address, amount: 0 },
        ];

        await expect(
          settlement.finalizeSessionBatch(sessionId, settlements),
        ).to.be.revertedWithCustomError(settlement, "InvalidAmount");
      });

      it("should revert with insufficient sender allowance for batch", async function () {
        const { settlement, usdc, user1, recipient1 } = await loadFixture(
          deployContractsFixture,
        );
        const sessionId = generateSessionId(user1.address, 1);

        const settlements = [
          { recipient: recipient1.address, amount: INITIAL_USDC_SUPPLY },
          { recipient: recipient1.address, amount: 1n },
        ];

        // This will revert with ERC20 error since sender doesn't have enough allowance
        await expect(
          settlement.finalizeSessionBatch(sessionId, settlements),
        ).to.be.revertedWithCustomError(usdc, "ERC20InsufficientAllowance");
      });

      it("should revert when batch exceeds MAX_BATCH_SIZE", async function () {
        const { settlement, user1, recipient1 } = await loadFixture(
          deployContractsFixture,
        );
        const sessionId = generateSessionId(user1.address, 1);

        // Create a batch with 101 settlements (MAX_BATCH_SIZE is 100)
        const settlements = Array.from({ length: 101 }, () => ({
          recipient: recipient1.address,
          amount: ethers.parseUnits("1", 6),
        }));

        await expect(
          settlement.finalizeSessionBatch(sessionId, settlements),
        )
          .to.be.revertedWithCustomError(settlement, "BatchTooLarge")
          .withArgs(101, 100);
      });
    });
  });

  describe("Admin Functions", function () {
    describe("emergencyWithdraw", function () {
      it("should allow owner to withdraw USDC", async function () {
        const { settlement, usdc, owner } = await loadFixture(
          deployContractsFixture,
        );
        const withdrawAmount = ethers.parseUnits("1000", 6);

        const initialOwnerBalance = await usdc.balanceOf(owner.address);

        await settlement.emergencyWithdraw(owner.address, withdrawAmount);

        expect(await usdc.balanceOf(owner.address)).to.equal(
          initialOwnerBalance + withdrawAmount,
        );
      });

      it("should revert when called by non-owner", async function () {
        const { settlement, user1 } = await loadFixture(deployContractsFixture);

        await expect(
          settlement.connect(user1).emergencyWithdraw(user1.address, 1000),
        ).to.be.revertedWithCustomError(
          settlement,
          "OwnableUnauthorizedAccount",
        );
      });

      it("should revert with zero address", async function () {
        const { settlement } = await loadFixture(deployContractsFixture);

        await expect(
          settlement.emergencyWithdraw(ethers.ZeroAddress, 1000),
        ).to.be.revertedWithCustomError(settlement, "InvalidRecipient");
      });
    });
  });

  describe("View Functions", function () {
    it("should return correct session status", async function () {
      const { settlement, user1, recipient1 } = await loadFixture(
        deployContractsFixture,
      );
      const sessionId = generateSessionId(user1.address, 1);

      expect(await settlement.isSessionSettled(sessionId)).to.be.false;

      await settlement.finalizeSession(
        sessionId,
        SETTLEMENT_AMOUNT,
        recipient1.address,
      );

      expect(await settlement.isSessionSettled(sessionId)).to.be.true;
    });

    it("should return correct session metadata", async function () {
      const { settlement, user1 } = await loadFixture(deployContractsFixture);
      const sessionId = generateSessionId(user1.address, 1);

      // Before starting
      let session = await settlement.getSession(sessionId);
      expect(session.user).to.equal(ethers.ZeroAddress);
      expect(session.createdAt).to.equal(0);
      expect(session.active).to.be.false;

      // After starting
      await settlement.startSession(sessionId, user1.address);
      session = await settlement.getSession(sessionId);
      expect(session.user).to.equal(user1.address);
      expect(session.createdAt).to.be.greaterThan(0);
      expect(session.active).to.be.true;
    });
  });
});
