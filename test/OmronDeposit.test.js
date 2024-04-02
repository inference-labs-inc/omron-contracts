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
    it("Should revert with zeroaddress if any whitelisted token is zero address", async () => {
      await expect(
        deployContract("OmronDeposit", [owner.address, [ZeroAddress]])
      ).to.be.revertedWithCustomError(deposit.contract, "ZeroAddress");
    });
    it("Should emit events for each whitelisted token", async () => {
      const tokenAddresses = [...[...erc20Deployments].map((x) => x.address)];

      const txHash = deposit.hash;
      const tx = await ethers.provider.getTransaction(txHash);
      console.log(tx);
      const receipt = await ethers.provider.getTransactionReceipt(txHash);
      console.log(receipt);
      const events = receipt.logs.map((x) =>
        deposit.contract.interface.parseLog(x)
      );
      console.log(events);
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
    it("Should reject deposit when past exit start time", async () => {
      await deposit.contract.setExitEnabled(true);
      await deposit.contract.setClaimManager(user1.address);
      const currentTime = await time.latest();
      await deposit.contract.setExitStartTime(currentTime + 3600);
      await time.increase(3600);
      await expect(
        deposit.contract.connect(owner).deposit(token1.address, parseEther("1"))
      ).to.be.revertedWithCustomError(deposit.contract, "ExitStartTimePassed");
    });
    it("Should reject deposit when paused", async () => {
      await expect(deposit.contract.connect(owner).pause())
        .to.emit(deposit.contract, "Paused")
        .withArgs(owner.address);

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
  describe("setExitEnabled", () => {
    it("Should reject when not owner", async () => {
      await expect(
        deposit.contract.connect(user1).setExitEnabled(true)
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "OwnableUnauthorizedAccount"
      );
    });
    it("Should set claims enabled when owner", async () => {
      await expect(deposit.contract.connect(owner).setExitEnabled(true))
        .to.emit(deposit.contract, "ExitEnabled")
        .withArgs(true);
      const exitEnabled = await deposit.contract.exitEnabled();
      expect(exitEnabled).to.equal(true);
    });
  });
  describe("setClaimManager", () => {
    it("Should set claim wallet when owner", async () => {
      await expect(
        deposit.contract.connect(owner).setClaimManager(user2.address)
      )
        .to.emit(deposit.contract, "ClaimManagerSet")
        .withArgs(user2.address);
    });
    it("Should not set claim wallet provided zero address", async () => {
      await expect(
        deposit.contract.connect(owner).setClaimManager(ZeroAddress)
      ).to.be.revertedWithCustomError(deposit.contract, "ZeroAddress");
    });
    it("Should not set claim wallet when not owner", async () => {
      await expect(
        deposit.contract.connect(user1).setClaimManager(user2.address)
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("setExitStartTime", () => {
    it("Should prevent setting a new exit start time once one is selected", async () => {
      const currentTime = await time.latest();
      await deposit.contract.setExitStartTime(currentTime + 3605);
      await expect(
        deposit.contract.connect(owner).setExitStartTime(currentTime + 3605)
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "ExitStartTimeAlreadySet"
      );
    });
    it("Should prevent setting a new exit start time before the current time", async () => {
      const currentTime = await time.latest();
      await expect(
        deposit.contract.connect(owner).setExitStartTime(currentTime - 1)
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "ExitStartCannotBeRetroactive"
      );
    });
  });
  describe("exit", () => {
    it("Should correctly exit using mock claim contract", async () => {
      const mockClaimContract = await deployMockClaimContractFixture(
        deposit.address
      );
      await deposit.contract.setClaimManager(mockClaimContract.address);
      await deposit.contract.setExitEnabled(true);
      await token1.contract.transfer(user2.address, parseEther("1"));
      await addAllowance(token1, user2, deposit, parseEther("2"));
      await depositTokens(deposit, token1, parseEther("1"), user2);
      await deposit.contract.setExitStartTime((await time.latest()) + 3600);
      await time.increase(3600);
      await expect(mockClaimContract.contract.exit(user2.address))
        .to.emit(mockClaimContract.contract, "ClaimSuccess")
        .withArgs(user2.address, parseEther("1"));
      expect(await token1.contract.balanceOf(user2.address)).to.equal(
        parseEther("1")
      );
    });
    it("Should accept exit and reduce user's point balance to zero", async () => {
      await deposit.contract.setExitEnabled(true);
      await deposit.contract.setClaimManager(user1.address);
      const currentTime = await time.latest();
      await deposit.contract.setExitStartTime(currentTime + 3605);
      await token1.contract.transfer(user2.address, parseEther("2"));
      await addAllowance(token1, user2, deposit, parseEther("2"));
      await depositTokens(deposit, token1, parseEther("1"), user2);
      await time.increase(3599);
      await depositTokens(deposit, token1, parseEther("1"), user2);
      const initialInfo = await deposit.contract.getUserInfo(user2.address);
      expect(initialInfo.pointBalance).to.equal(parseEther("1"));
      await deposit.contract.connect(user1).exit(user2.address);
      const info = await deposit.contract.getUserInfo(user2.address);
      expect(info.pointBalance).to.equal(parseEther("0"));
    });
    it("Should correctly handle point accrual and exit process", async () => {
      await deposit.contract.setExitEnabled(true);
      await deposit.contract.setClaimManager(user1.address);

      // Transfer and allow tokens for deposit
      await token1.contract.transfer(user2.address, parseEther("2"));
      await addAllowance(token1, user2, deposit, parseEther("2"));

      // Initial deposit

      await depositTokens(deposit, token1, parseEther("1"), user2);
      const currentTime = await time.latest();
      // In two hours, the contract will switch to exit mode
      const exitStartTime = currentTime + 7201;

      // Set exit start time to 2 hours in the future
      await deposit.contract.setExitStartTime(exitStartTime);

      // Simulate nearly 2 hours passing
      await time.increase(exitStartTime - currentTime - 3);
      const nowTime = await time.latest();
      console.log(currentTime, nowTime, exitStartTime);

      // Make a last-second deposit
      await depositTokens(deposit, token1, parseEther("1"), user2);
      const additionalPointsFromLastDeposit = parseEther(
        "0.000555555555555555"
      );

      // Simulate another hour passing, post-exit start time
      await time.increase(3600);

      // Verify initial point balance before exit
      const initialInfo = await deposit.contract.getUserInfo(user2.address);
      expect(initialInfo.pointBalance).to.equal(parseEther("2"));

      // Perform exit and verify event emission
      await expect(deposit.contract.connect(user1).exit(user2.address))
        .to.emit(deposit.contract, "PointsClaimed")
        .withArgs(
          user2.address,
          parseEther("2") + additionalPointsFromLastDeposit,
          parseEther("0")
        );

      // Verify token balance remains unchanged after exit
      expect(await token1.contract.balanceOf(user2.address)).to.equal(
        parseEther("2")
      );

      // Confirm point balance is reset to zero after exit
      const postExitInfo = await deposit.contract.getUserInfo(user2.address);
      expect(postExitInfo.pointBalance).to.equal(parseEther("0"));
    });
    it("Should reject when exit disabled", async () => {
      await deposit.contract.setClaimManager(user1.address);
      await expect(
        deposit.contract.connect(user1).exit(user2.address)
      ).to.be.revertedWithCustomError(deposit.contract, "ExitDisabled");
    });
    it("Should reject when claim address is null", async () => {
      await deposit.contract.setExitEnabled(true);
      const currentTime = await time.latest();
      await deposit.contract.setExitStartTime(currentTime + 1);
      await expect(
        deposit.contract.exit(user1.address)
      ).to.be.revertedWithCustomError(deposit.contract, "ClaimManagerNotSet");
    });
    it("Should reject exit for null address", async () => {
      await deposit.contract.setExitEnabled(true);
      await deposit.contract.setClaimManager(user1.address);
      const currentTime = await time.latest();
      await deposit.contract.setExitStartTime(currentTime + 1);
      await expect(
        deposit.contract.connect(user1).exit(ZeroAddress)
      ).to.be.revertedWithCustomError(deposit.contract, "ZeroAddress");
    });
    it("Should reject when not claim address", async () => {
      await deposit.contract.setExitEnabled(true);
      await deposit.contract.setClaimManager(user2.address);
      const currentTime = await time.latest();
      await deposit.contract.setExitStartTime(currentTime + 1);
      await expect(
        deposit.contract.connect(user1).exit(user2.address)
      ).to.be.revertedWithCustomError(deposit.contract, "NotClaimManager");
    });
    it("Should reject when before exit time", async () => {
      await deposit.contract.setExitEnabled(true);
      await deposit.contract.setClaimManager(user2.address);
      const currentTime = await time.latest();
      await deposit.contract.setExitStartTime(currentTime + 3600);
      await expect(
        deposit.contract.connect(user2).exit(user2.address)
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "ExitStartTimeNotPassed"
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
