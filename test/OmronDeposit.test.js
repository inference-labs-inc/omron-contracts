import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, parseEther } from "ethers";
import { deployContract } from "../helpers/deployment.js";
import {
  deployDepositContractFixture,
  deployMockClaimContractFixture,
} from "./helpers/fixtures.js";
import { addAllowance, depositTokens } from "./helpers/interactions.js";

describe("OmronDeposit", () => {
  let owner, user1, user2;
  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });

  let deposit,
    erc20Deployments,
    token1,
    token2,
    nonWhitelistedToken,
    brokenERC20;
  beforeEach(async () => {
    ({ deposit, erc20Deployments, nonWhitelistedToken, brokenERC20 } =
      await loadFixture(deployDepositContractFixture));
    [token1, token2] = erc20Deployments;
  });
  describe("constructor", () => {
    it("Should revert with ZeroAddress if any whitelisted token is zero address", async () => {
      await expect(
        deployContract("OmronDeposit", [owner.address, [ZeroAddress]])
      ).to.be.revertedWithCustomError(deposit.contract, "ZeroAddress");
    });
    it("Should emit events for each whitelisted token", async () => {
      const tokenAddresses = [...[...erc20Deployments].map((x) => x.address)];

      const txHash = deposit.hash;
      const tx = await ethers.provider.getTransaction(txHash);

      const receipt = await ethers.provider.getTransactionReceipt(txHash);

      const events = receipt.logs.map((x) =>
        deposit.contract.interface.parseLog(x)
      );

      const whitelistedTokenEvents = events.filter(
        (x) => x.name === "WhitelistedTokenAdded"
      );
      expect(whitelistedTokenEvents).to.have.lengthOf(tokenAddresses.length);
      const whitelistedTokenAddresses = whitelistedTokenEvents.map(
        (x) => x.args[0]
      );
      expect(whitelistedTokenAddresses).to.have.members(tokenAddresses);
    });
    it("Should whitelist tokens as expected", async () => {
      const whitelist = await deposit.contract.getAllWhitelistedTokens();
      expect([...whitelist]).to.have.members([
        ...erc20Deployments.map((x) => x.address),
      ]);
    });
  });
  describe("getAllWhitelistedTokens", () => {
    it("Should return all whitelisted tokens", async () => {
      const whitelistedTokens =
        await deposit.contract.getAllWhitelistedTokens();
      expect([...whitelistedTokens]).to.have.members([
        ...erc20Deployments.map((x) => x.address),
      ]);
    });
    it("Should get updated whitelisted tokens after adding a new token", async () => {
      await deposit.contract.addWhitelistedToken(nonWhitelistedToken.address);
      const whitelistedTokens =
        await deposit.contract.getAllWhitelistedTokens();

      expect([...whitelistedTokens]).to.have.members([
        ...erc20Deployments.map((x) => x.address),
        nonWhitelistedToken.address,
      ]);
    });
  });
  describe("pause", () => {
    it("Should reject pause when not owner", async () => {
      await expect(
        deposit.contract.connect(user1).pause()
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "OwnableUnauthorizedAccount"
      );
    });
    it("Should reject pause when already paused", async () => {
      await deposit.contract.connect(owner).pause();
      await expect(
        deposit.contract.connect(owner).pause()
      ).to.be.revertedWithCustomError(deposit.contract, "EnforcedPause");
    });
    it("Should accept pause when not paused", async () => {
      await expect(deposit.contract.connect(owner).pause())
        .to.emit(deposit.contract, "Paused")
        .withArgs(owner.address);
    });
  });
  describe("unpause", () => {
    it("Should reject unpause when not owner", async () => {
      await expect(
        deposit.contract.connect(user1).unpause()
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "OwnableUnauthorizedAccount"
      );
    });
    it("Should reject unpause when not paused", async () => {
      await expect(
        deposit.contract.connect(owner).unpause()
      ).to.be.revertedWithCustomError(deposit.contract, "ExpectedPause");
    });
    it("Should accept unpause when paused", async () => {
      await deposit.contract.connect(owner).pause();
      await expect(deposit.contract.connect(owner).unpause())
        .to.emit(deposit.contract, "Unpaused")

        .withArgs(owner.address);
    });
  });

  describe("deposit", () => {
    it("Should reject deposit of zero tokens", async () => {
      await addAllowance(token1, owner, deposit, parseEther("1"));
      await depositTokens(
        deposit,
        token1,
        parseEther("0"),
        owner,
        true,
        "ZeroAmount"
      );
    });
    it("Should reject deposit when past deposit stop time", async () => {
      await deposit.contract.setClaimManager(user1.address);
      const currentTime = await time.latest();
      await deposit.contract.stopDeposits();
      await time.increase(3600);
      await expect(
        deposit.contract.connect(owner).deposit(token1.address, parseEther("1"))
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "DepositStopTimePassed"
      );
    });
    it("Should reject deposit when paused", async () => {
      await deposit.contract.connect(owner).pause();

      await expect(
        deposit.contract.connect(user1).deposit(token1.address, parseEther("1"))
      ).to.be.revertedWithCustomError(deposit.contract, "EnforcedPause");
    });
    it("Should handle falsy transferFrom response", async () => {
      await addAllowance(brokenERC20, owner, deposit, parseEther("1"));
      await deposit.contract.addWhitelistedToken(brokenERC20.address);
      await brokenERC20.contract.setTransfersEnabled(false);
      await expect(
        deposit.contract.deposit(brokenERC20.address, parseEther("1"))
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "SafeERC20FailedOperation"
      );
    });
    it("Should reject deposit with no allowance", async () => {
      await expect(
        deposit.contract.deposit(token1.address, parseEther("1"))
      ).to.be.revertedWithCustomError(
        token1.contract,
        "ERC20InsufficientAllowance"
      );
    });
    it("Should reject deposit with empty balance", async () => {
      await addAllowance(token1, user2, deposit, parseEther("1"));

      await expect(
        deposit.contract.connect(user2).deposit(token1.address, parseEther("1"))
      ).to.be.revertedWithCustomError(
        token1.contract,
        "ERC20InsufficientBalance"
      );
    });
    it("Should accept valid deposit", async () => {
      await addAllowance(token1, owner, deposit, parseEther("1"));

      await expect(deposit.contract.deposit(token1.address, parseEther("1")))
        .to.emit(deposit.contract, "Deposit")
        .withArgs(owner.address, token1.address, parseEther("1"));
    });
    it("Should reject deposit of non-whitelisted token", async () => {
      const { deposit, nonWhitelistedToken } = await loadFixture(
        deployDepositContractFixture
      );

      await addAllowance(nonWhitelistedToken, owner, deposit, parseEther("1"));
      await expect(
        deposit.contract
          .connect(owner)
          .deposit(nonWhitelistedToken.address, parseEther("1"))
      ).to.be.revertedWithCustomError(deposit.contract, "TokenNotWhitelisted");
    });
  });
  describe("tokenBalance", () => {
    it("Should correctly return ERC20 token balance", async () => {
      await addAllowance(token1, owner, deposit, parseEther("1"));
      await deposit.contract.deposit(token1.address, parseEther("1"));
      const balance = await deposit.contract.tokenBalance(
        owner.address,
        token1.address
      );
      expect(balance).to.equal(parseEther("1"));
    });
  });
  describe("setClaimManager", () => {
    it("Should set claim manager when owner", async () => {
      await expect(
        deposit.contract.connect(owner).setClaimManager(user2.address)
      )
        .to.emit(deposit.contract, "ClaimManagerSet")
        .withArgs(user2.address);
    });

    it("Should not set claim manager provided zero address", async () => {
      await expect(
        deposit.contract.connect(owner).setClaimManager(ZeroAddress)
      ).to.be.revertedWithCustomError(deposit.contract, "ZeroAddress");
    });
    it("Should not set claim manager when not owner", async () => {
      await expect(
        deposit.contract.connect(user1).setClaimManager(user2.address)
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("setDepositStopTime", () => {
    it("Should only allow owner to set deposit stop time", async () => {
      await expect(
        deposit.contract.connect(user1).stopDeposits()
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "OwnableUnauthorizedAccount"
      );
    });
    it("Should prevent setting a new deposit stop time once one is selected", async () => {
      const currentTime = await time.latest();
      await deposit.contract.stopDeposits();
      await expect(
        deposit.contract.connect(owner).stopDeposits()
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "DepositStopTimeAlreadySet"
      );
    });
  });

  describe("withdrawTokens", () => {
    it("Should accept valid token withdrawal", async () => {
      await deposit.contract.setClaimManager(user1.address);

      await token1.contract.transfer(user2.address, parseEther("1"));
      await token2.contract.transfer(user2.address, parseEther("1"));
      await addAllowance(token1, user2, deposit, parseEther("1"));
      await addAllowance(token2, user2, deposit, parseEther("1"));
      await depositTokens(deposit, token1, parseEther("1"), user2);
      await depositTokens(deposit, token2, parseEther("1"), user2);

      await time.increase(3602);
      await deposit.contract.stopDeposits();
      await expect(
        deposit.contract.connect(user1).withdrawTokens(user2.address)
      )
        .to.emit(deposit.contract, "WithdrawTokens")
        .withArgs(
          user2.address,
          erc20Deployments.map((token) =>
            [token1.address, token2.address].includes(token.address)
              ? parseEther("1")
              : parseEther("0")
          )
        );
      const newDepositBalances = await Promise.all([
        deposit.contract.tokenBalance(user1.address, token1.address),
        deposit.contract.tokenBalance(user1.address, token2.address),
      ]);
      expect(newDepositBalances).to.eql([parseEther("0"), parseEther("0")]);
    });
    it("Should reject when not called from claim manager", async () => {
      await deposit.contract.setClaimManager(user2.address);
      await expect(
        deposit.contract.connect(user1).withdrawTokens(user1.address)
      ).to.be.revertedWithCustomError(deposit.contract, "NotClaimManager");
    });
    it("Should reject when called before deposit stop time", async () => {
      await deposit.contract.setClaimManager(user1.address);
      await expect(
        deposit.contract.connect(user1).withdrawTokens(user1.address)
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "DepositStopTimeNotPassed"
      );
    });
    it("Should reject withdrawal when contract paused", async () => {
      await deposit.contract.pause();
      await expect(
        deposit.contract.connect(user1).withdrawTokens(user1.address)
      ).to.be.revertedWithCustomError(deposit.contract, "EnforcedPause");
    });
  });

  describe("claim", () => {
    it("Should correctly claim using mock claim contract", async () => {
      const mockClaimContract = await deployMockClaimContractFixture(
        deposit.address
      );
      await deposit.contract.setClaimManager(mockClaimContract.address);
      await token1.contract.transfer(user2.address, parseEther("1"));
      await addAllowance(token1, user2, deposit, parseEther("2"));
      await depositTokens(deposit, token1, parseEther("1"), user2);
      await time.increase(3599);
      await deposit.contract.stopDeposits();
      await expect(mockClaimContract.contract.claimPoints(user2.address))
        .to.emit(mockClaimContract.contract, "PointsClaimed")
        .withArgs(user2.address, parseEther("1"));
    });
    it("Should accept claim and reduce user's point balance to zero", async () => {
      await deposit.contract.setClaimManager(user1.address);
      await token1.contract.transfer(user2.address, parseEther("2"));
      await addAllowance(token1, user2, deposit, parseEther("2"));
      await depositTokens(deposit, token1, parseEther("1"), user2);
      await time.increase(3599);
      await depositTokens(deposit, token1, parseEther("1"), user2);
      await deposit.contract.stopDeposits();
      const initialInfo = await deposit.contract.getUserInfo(user2.address);
      expect(initialInfo.pointBalance).to.equal(parseEther("1"));
      await deposit.contract.connect(user1).claim(user2.address);
      const info = await deposit.contract.getUserInfo(user2.address);
      expect(info.pointBalance).to.equal(parseEther("0"));
    });
    it("Should correctly handle point accrual and claim process", async () => {
      await deposit.contract.setClaimManager(user1.address);

      // Transfer and allow tokens for deposit
      await token1.contract.transfer(user2.address, parseEther("2"));
      await addAllowance(token1, user2, deposit, parseEther("2"));

      // Initial deposit
      await depositTokens(deposit, token1, parseEther("1"), user2);
      // In two hours, the contract will switch to claim mode
      await time.increase(7199);

      // Make a last-second deposit
      await depositTokens(deposit, token1, parseEther("1"), user2);

      // Stop deposits
      await deposit.contract.stopDeposits();

      const additionalPointsFromLastDeposit = parseEther(
        "0.000555555555555555"
      );

      // Simulate another hour passing, post-deposit stop time
      await time.increase(3600);

      // Verify initial point balance before claim
      const initialInfo = await deposit.contract.getUserInfo(user2.address);
      expect(initialInfo.pointBalance).to.equal(parseEther("2"));

      // Perform claim and verify event emission
      await expect(deposit.contract.connect(user1).claim(user2.address))
        .to.emit(deposit.contract, "ClaimPoints")
        .withArgs(
          user2.address,
          parseEther("2") + additionalPointsFromLastDeposit
        );

      // Confirm point balance is reset to zero after claim
      const postClaimInfo = await deposit.contract.getUserInfo(user2.address);
      expect(postClaimInfo.pointBalance).to.equal(parseEther("0"));
    });

    it("Should reject when contract paused", async () => {
      await deposit.contract.setClaimManager(user1.address);
      await deposit.contract.stopDeposits();
      await time.increase(1);
      await deposit.contract.pause();
      await expect(
        deposit.contract.connect(user1).claim(user2.address)
      ).to.be.revertedWithCustomError(deposit.contract, "EnforcedPause");
    });
    it("Should reject when claim address is null", async () => {
      const currentTime = await time.latest();
      await deposit.contract.stopDeposits();
      await time.increase(3601);
      await expect(
        deposit.contract.claim(user1.address)
      ).to.be.revertedWithCustomError(deposit.contract, "ClaimManagerNotSet");
    });
    it("Should reject claim for null address", async () => {
      await deposit.contract.setClaimManager(user1.address);
      const currentTime = await time.latest();
      await deposit.contract.stopDeposits();
      await expect(
        deposit.contract.connect(user1).claim(ZeroAddress)
      ).to.be.revertedWithCustomError(deposit.contract, "ZeroAddress");
    });
    it("Should reject when not claim address", async () => {
      await deposit.contract.setClaimManager(user2.address);
      const currentTime = await time.latest();
      await deposit.contract.stopDeposits();
      await expect(
        deposit.contract.connect(user1).claim(user2.address)
      ).to.be.revertedWithCustomError(deposit.contract, "NotClaimManager");
    });
    it("Should reject when before deposit stop time", async () => {
      await deposit.contract.setClaimManager(user2.address);
      await expect(
        deposit.contract.connect(user2).claim(user2.address)
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "DepositStopTimeNotPassed"
      );
    });
  });
  describe("addWhitelistedToken", () => {
    it("Should reject token at zero address", async () => {
      await expect(
        deposit.contract.connect(owner).addWhitelistedToken(ZeroAddress)
      ).to.be.revertedWithCustomError(deposit.contract, "ZeroAddress");
    });
    it("Should reject addWhitelistedToken when not owner", async () => {
      await expect(
        deposit.contract
          .connect(user1)
          .addWhitelistedToken(nonWhitelistedToken.address)
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "OwnableUnauthorizedAccount"
      );
    });
    it("Should accept addWhitelistedToken when owner", async () => {
      await expect(
        deposit.contract
          .connect(owner)
          .addWhitelistedToken(nonWhitelistedToken.address)
      )
        .to.emit(deposit.contract, "WhitelistedTokenAdded")
        .withArgs(nonWhitelistedToken.address);
    });
  });
  describe("Points per hour", () => {
    it("Should handle simple points per hour increase with ERC20 Deposits", async () => {
      let info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerHour).to.equal(parseEther("0"));
      await addAllowance(token1, owner, deposit, parseEther("1"));
      await deposit.contract.deposit(token1.address, parseEther("1"));
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerHour).to.equal(parseEther("1"));
      await addAllowance(token2, owner, deposit, parseEther("1"));
      await deposit.contract.deposit(token2.address, parseEther("1"));
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerHour).to.equal(parseEther("2"));
    });
  });
  describe("calculatePoints and pointBalance", () => {
    it("Should correctly increase balance for ERC20 deposit", async () => {
      let info = await deposit.contract.getUserInfo(owner);
      expect(info.pointBalance).to.equal(parseEther("0"));
      await addAllowance(token1, owner, deposit, parseEther("1"));
      await deposit.contract.deposit(token1.address, parseEther("1"));
      await time.increase(3600);
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointBalance).to.equal(parseEther("0"));
      const calculatedPoints = await deposit.contract.calculatePoints(
        owner.address
      );
      expect(calculatedPoints).to.equal(parseEther("1"));
      await time.increase(3600);
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointBalance).to.equal(parseEther("0"));
      const calculatedPoints2 = await deposit.contract.calculatePoints(
        owner.address
      );
      expect(calculatedPoints2).to.equal(parseEther("2"));
    });
  });
  describe("pointBalance", () => {
    it("Should correctly increase points with a simple ERC20 deposit", async () => {
      let userInfo = await deposit.contract.getUserInfo(owner.address);
      expect(userInfo.pointBalance).to.equal(parseEther("0"));
      await addAllowance(token1, owner, deposit, parseEther("1"));
      await deposit.contract.deposit(token1.address, parseEther("1"));
      // Block time increases by 2h
      await time.increase(3600 * 2 - 2);
      await addAllowance(token1, owner, deposit, parseEther("1"));
      await deposit.contract.deposit(token1.address, parseEther("1"));
      userInfo = await deposit.contract.getUserInfo(owner.address);
      expect(userInfo.pointBalance).to.equal(parseEther("2"));
    });
    it("Should correctly increase points with an ERC20 deposit", async () => {
      let userInfo = await deposit.contract.getUserInfo(owner.address);
      expect(userInfo.pointBalance).to.equal(parseEther("0"));

      await addAllowance(token1, owner, deposit, parseEther("10"));

      // pointBalance should be 0 since no deposits have been made, pointsPerHour should be 2 now
      await deposit.contract.deposit(token1.address, parseEther("2"));

      userInfo = await deposit.contract.getUserInfo(owner.address);
      expect(userInfo.pointBalance).to.equal(parseEther("0"));
      expect(userInfo.pointsPerHour).to.equal(parseEther("2"));

      await time.increase(3599);

      // Block time increases by 1h again, points is now 2pph*1h + existing 0 point = 2 points
      await deposit.contract.deposit(token1.address, parseEther("2"));
      userInfo = await deposit.contract.getUserInfo(owner.address);
      expect(userInfo.pointBalance).to.equal(parseEther("2"));
    });
  });
});
