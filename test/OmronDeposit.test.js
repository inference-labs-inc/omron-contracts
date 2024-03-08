import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, parseEther, parseUnits } from "ethers";
import { deployContract } from "../helpers/deployment.js";
import { deployDepositContractFixture } from "./helpers/fixtures.js";
import { addAllowance } from "./helpers/utils.js";

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
    token6decimals,
    token20decimals,
    brokenERC20;
  beforeEach(async () => {
    ({
      deposit,
      erc20Deployments,
      nonWhitelistedToken,
      token6decimals,
      token20decimals,
      brokenERC20,
    } = await loadFixture(deployDepositContractFixture));
    [token1, token2] = erc20Deployments;
  });
  describe("constructor", () => {
    it("Should revert with zeroaddress if any whitelisted token is zero address", async () => {
      await expect(
        deployContract("OmronDeposit", [owner.address, [ZeroAddress]])
      ).to.be.revertedWithCustomError(deposit.contract, "ZeroAddress");
    });
    it("Should emit events for each whitelisted token", async () => {
      const tokenAddresses = [
        ...[...erc20Deployments].map((x) => x.address),
        token6decimals.address,
        token20decimals.address,
      ];

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
        token6decimals.address,
        token20decimals.address,
      ]);
    });
  });
  describe("getAllWhitelistedTokens", () => {
    it("Should return all whitelisted tokens", async () => {
      const whitelistedTokens =
        await deposit.contract.getAllWhitelistedTokens();
      expect([...whitelistedTokens]).to.have.members([
        ...erc20Deployments.map((x) => x.address),
        token6decimals.address,
        token20decimals.address,
      ]);
    });
    it("Should get updated whitelisted tokens after adding a new token", async () => {
      await deposit.contract.addWhitelistedToken(nonWhitelistedToken.address);
      const whitelistedTokens =
        await deposit.contract.getAllWhitelistedTokens();

      expect([...whitelistedTokens]).to.have.members([
        ...erc20Deployments.map((x) => x.address),
        nonWhitelistedToken.address,
        token6decimals.address,
        token20decimals.address,
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
  describe("setWithdrawalsEnabled", () => {
    it("Should reject setWithdrawalsEnabled when not owner", async () => {
      await expect(
        deposit.contract.connect(user1).setWithdrawalsEnabled(true)
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "OwnableUnauthorizedAccount"
      );
    });
    it("Should accept setWithdrawalsEnabled when owner", async () => {
      await expect(deposit.contract.connect(owner).setWithdrawalsEnabled(true))
        .to.emit(deposit.contract, "WithdrawalsEnabled")
        .withArgs(true);
    });
  });
  describe("withdraw", () => {
    it("Should reject withdraw when transferFrom is falsy", async () => {
      await addAllowance(brokenERC20, owner, deposit, parseEther("1"));
      await deposit.contract.addWhitelistedToken(brokenERC20.address);
      await deposit.contract.setWithdrawalsEnabled(true);
      await brokenERC20.contract.setTransfersEnabled(true);
      await deposit.contract.deposit(brokenERC20.address, parseEther("1"));
      await brokenERC20.contract.setTransfersEnabled(false);
      await expect(
        deposit.contract.withdraw(brokenERC20.address, parseEther("1"))
      ).to.be.revertedWithCustomError(deposit.contract, "TransferFailed");
    });
    it("Should accept withdraw when paused", async () => {
      await deposit.contract.setWithdrawalsEnabled(true);
      await token1.contract.transfer(user1.address, parseEther("1"));
      await addAllowance(token1, user1, deposit, parseEther("1"));
      await deposit.contract
        .connect(user1)
        .deposit(token1.address, parseEther("1"));
      await expect(deposit.contract.pause())
        .to.emit(deposit.contract, "Paused")
        .withArgs(owner.address);

      await expect(
        deposit.contract
          .connect(user1)
          .withdraw(token1.address, parseEther("1"))
      )
        .to.emit(deposit.contract, "Withdrawal")
        .withArgs(user1.address, token1.address, parseEther("1"));
    });
    it("Should reject withdraw with no balance", async () => {
      await deposit.contract.setWithdrawalsEnabled(true);
      await expect(
        deposit.contract
          .connect(user1)
          .withdraw(token1.address, parseEther("1"))
      ).to.be.revertedWithCustomError(deposit.contract, "InsufficientBalance");
    });
    it("Should reject withdraw when withdrawals disabled", async () => {
      await addAllowance(token1, owner, deposit, parseEther("1"));
      await expect(
        deposit.contract
          .connect(owner)
          .withdraw(token1.address, parseEther("1"))
      ).to.be.revertedWithCustomError(deposit.contract, "WithdrawalsDisabled");
    });
    it("Should reject non-whitelisted token", async () => {
      await deposit.contract.setWithdrawalsEnabled(true);
      await expect(
        deposit.contract
          .connect(owner)
          .withdraw(nonWhitelistedToken.address, parseEther("1"))
      ).to.be.revertedWithCustomError(deposit.contract, "TokenNotWhitelisted");
    });

    it("Should accept valid withdraw", async () => {
      await deposit.contract.setWithdrawalsEnabled(true);
      await addAllowance(token1, owner, deposit, parseEther("1"));
      await deposit.contract.deposit(token1.address, parseEther("1"));
      await expect(deposit.contract.withdraw(token1.address, parseEther("1")))
        .to.emit(deposit.contract, "Withdrawal")
        .withArgs(owner.address, token1.address, parseEther("1"));
    });
  });
  describe("deposit", () => {
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
      ).to.be.revertedWithCustomError(deposit.contract, "TransferFailed");
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

    it("Should handle points per hour with deposits and withdrawals", async () => {
      await deposit.contract.setWithdrawalsEnabled(true);
      let info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerHour).to.equal(parseEther("0"));
      await addAllowance(token1, owner, deposit, parseEther("1"));
      await deposit.contract.deposit(token1.address, parseEther("1"));
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerHour).to.equal(parseEther("1"));
      await deposit.contract.withdraw(token1.address, parseEther("1"));
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerHour).to.equal(parseEther("0"));
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
    it("Should correctly handle fractional points with ERC20", async () => {
      let info = await deposit.contract.getUserInfo(owner);
      expect(info.pointBalance).to.equal(parseEther("0"));
      await addAllowance(token6decimals, owner, deposit, parseEther("0.5"));
      await deposit.contract.deposit(
        token6decimals.address,
        parseUnits("0.5", 6)
      );
      await time.increase(3600);
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointBalance).to.equal(parseEther("0"));
      const calculatedPoints = await deposit.contract.calculatePoints(
        owner.address
      );
      expect(calculatedPoints).to.equal(parseEther("0.5"));
      await time.increase(3600);
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointBalance).to.equal(parseEther("0"));
      const calculatedPoints2 = await deposit.contract.calculatePoints(
        owner.address
      );
      expect(calculatedPoints2).to.equal(parseEther("1"));
    });
    it("Should correctly handle fractional points with 20 decimal ERC20", async () => {
      let info = await deposit.contract.getUserInfo(owner);
      expect(info.pointBalance).to.equal(parseEther("0"));
      await addAllowance(
        token20decimals,
        owner,
        deposit,
        parseUnits("0.5", 20)
      );
      await deposit.contract.deposit(
        token20decimals.address,
        parseUnits("0.5", 20)
      );
      await time.increase(3600);
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointBalance).to.equal(parseEther("0"));
      const calculatedPoints = await deposit.contract.calculatePoints(
        owner.address
      );
      expect(calculatedPoints).to.equal(parseEther("0.5"));

      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointBalance).to.equal(parseEther("0"));
      await time.increase(3600);
      const calculatedPoints2 = await deposit.contract.calculatePoints(
        owner.address
      );
      expect(calculatedPoints2).to.equal(parseEther("1"));
    });
    it("Should correctly handle fractional points with 6 decimal ERC20", async () => {
      let info = await deposit.contract.getUserInfo(owner);
      expect(info.pointBalance).to.equal(parseEther("0"));
      await addAllowance(token6decimals, owner, deposit, parseUnits("0.5", 6));
      await deposit.contract.deposit(
        token6decimals.address,
        parseUnits("0.5", 6)
      );
      await time.increase(3600);
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointBalance).to.equal(parseEther("0"));
      const calculatedPoints = await deposit.contract.calculatePoints(
        owner.address
      );
      expect(calculatedPoints).to.equal(parseEther("0.5"));

      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointBalance).to.equal(parseEther("0"));
      await time.increase(3600);
      const calculatedPoints2 = await deposit.contract.calculatePoints(
        owner.address
      );
      expect(calculatedPoints2).to.equal(parseEther("1"));
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
    it("Should handle mixed deposits and withdrawals", async () => {
      let userInfo = await deposit.contract.getUserInfo(owner.address);
      await deposit.contract.setWithdrawalsEnabled(true);
      expect(userInfo.pointBalance).to.equal(parseEther("0"));
      await addAllowance(token1, owner, deposit, parseEther("10"));
      await deposit.contract.deposit(token1.address, parseEther("1")); // Balance should be 0, Points per hour should be 1
      userInfo = await deposit.contract.getUserInfo(owner.address);
      expect(userInfo.pointBalance).to.equal(parseEther("0"));
      expect(userInfo.pointsPerHour).to.equal(parseEther("1"));
      await time.increase(3599);
      await deposit.contract.withdraw(token1.address, parseEther("1")); // Balance should be 1x1 = 1, Points per hour should be 1

      userInfo = await deposit.contract.getUserInfo(owner.address);
      expect(userInfo.pointBalance).to.equal(parseEther("1"));
      expect(userInfo.pointsPerHour).to.equal(parseEther("0"));
      await time.increase(3600);

      await deposit.contract.deposit(token1.address, parseEther("0.000000005")); // Balance should be 0.000000005x1 = 0.000000005 + 1 = 1.000000005, Points per hour should be 0.000000005
      userInfo = await deposit.contract.getUserInfo(owner.address);
      expect(userInfo.pointBalance).to.equal(parseEther("1"));
      expect(userInfo.pointsPerHour).to.equal(parseEther("0.000000005"));
      await time.increase(3599);
      await deposit.contract.withdraw(
        token1.address,
        parseEther("0.000000005")
      ); // Balance should be 0, Points per hour should be 0
      userInfo = await deposit.contract.getUserInfo(owner.address);
      expect(userInfo.pointBalance).to.equal(parseEther("1.000000005"));
      expect(userInfo.pointsPerHour).to.equal(parseEther("0"));
    });
  });
});
