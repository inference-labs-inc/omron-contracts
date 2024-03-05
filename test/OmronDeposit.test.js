import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployDepositContractFixture } from "./helpers/fixtures.js";
import { addAllowance } from "./helpers/utils.js";
describe("OmronDeposit", () => {
  let owner, user1, user2;
  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });
  describe("pause", () => {
    it("Should reject pause when not owner", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      await expect(
        deposit.contract.connect(user1).pause()
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "OwnableUnauthorizedAccount"
      );
    });
    it("Should reject pause when already paused", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      await deposit.contract.connect(owner).pause();
      await expect(
        deposit.contract.connect(owner).pause()
      ).to.be.revertedWithCustomError(deposit.contract, "EnforcedPause");
    });
    it("Should accept pause when not paused", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      await expect(deposit.contract.connect(owner).pause())
        .to.emit(deposit.contract, "Paused")
        .withArgs(owner.address);
    });
  });
  describe("unpause", () => {
    it("Should reject unpause when not owner", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      await expect(
        deposit.contract.connect(user1).unpause()
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "OwnableUnauthorizedAccount"
      );
    });
    it("Should reject unpause when not paused", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      await expect(
        deposit.contract.connect(owner).unpause()
      ).to.be.revertedWithCustomError(deposit.contract, "ExpectedPause");
    });
    it("Should accept unpause when paused", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);

      await deposit.contract.connect(owner).pause();
      await expect(deposit.contract.connect(owner).unpause())
        .to.emit(deposit.contract, "Unpaused")

        .withArgs(owner.address);
    });
  });
  describe("setWithdrawalsEnabled", () => {
    it("Should reject setWithdrawalsEnabled when not owner", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      await expect(
        deposit.contract.connect(user1).setWithdrawalsEnabled(true)
      ).to.be.revertedWithCustomError(
        deposit.contract,
        "OwnableUnauthorizedAccount"
      );
    });
    it("Should accept setWithdrawalsEnabled when owner", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      await expect(deposit.contract.connect(owner).setWithdrawalsEnabled(true))
        .to.emit(deposit.contract, "WithdrawalsEnabled")
        .withArgs(true);
    });
  });
  describe("receive", () => {
    it("Should reject deposit when paused", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      await expect(deposit.contract.connect(owner).pause())
        .to.emit(deposit.contract, "Paused")
        .withArgs(owner.address);

      await expect(
        user1.sendTransaction({ to: deposit.address, value: 1000 })
      ).to.be.revertedWithCustomError(deposit.contract, "EnforcedPause");
    });
    it("Should accept valid deposit", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      await expect(user1.sendTransaction({ to: deposit.address, value: 1000 }))
        .to.emit(deposit.contract, "EtherDeposit")
        .withArgs(user1.address, 1000);
    });
  });
  describe("withdrawEther", () => {
    it("Should reject withdraw when paused", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      await expect(deposit.contract.connect(owner).pause())
        .to.emit(deposit.contract, "Paused")
        .withArgs(owner.address);

      await expect(
        deposit.contract.connect(user1).withdrawEther(1000)
      ).to.be.revertedWithCustomError(deposit.contract, "EnforcedPause");
    });
    it("Should reject withdraw with no balance", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      await deposit.contract.setWithdrawalsEnabled(true);
      await expect(
        deposit.contract.connect(user1).withdrawEther(1000)
      ).to.be.revertedWithCustomError(deposit.contract, "InsufficientBalance");
    });
    it("Should reject withdraw when withdrawals disabled", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);

      await expect(
        deposit.contract.connect(owner).withdrawEther(1000)
      ).to.be.revertedWithCustomError(deposit.contract, "WithdrawalsDisabled");
    });
  });
  describe("withdraw", () => {
    it("Should reject withdraw when paused", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1] = erc20Deployments;
      await expect(deposit.contract.connect(owner).pause())
        .to.emit(deposit.contract, "Paused")
        .withArgs(owner.address);

      await expect(
        deposit.contract.connect(user1).withdraw(token1.address, 1000)
      ).to.be.revertedWithCustomError(deposit.contract, "EnforcedPause");
    });
    it("Should reject withdraw with no balance", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1] = erc20Deployments;
      await deposit.contract.setWithdrawalsEnabled(true);
      await expect(
        deposit.contract.connect(user1).withdraw(token1.address, 1000)
      ).to.be.revertedWithCustomError(deposit.contract, "InsufficientBalance");
    });
    it("Should reject withdraw when withdrawals disabled", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1] = erc20Deployments;
      await addAllowance(token1, owner, deposit, 1000);
      await expect(
        deposit.contract.connect(owner).withdraw(token1.address, 1000)
      ).to.be.revertedWithCustomError(deposit.contract, "WithdrawalsDisabled");
    });
  });
  describe("deposit", () => {
    it("Should reject deposit when paused", async () => {
      const {
        deposit,
        erc20Deployments: [token1],
      } = await loadFixture(deployDepositContractFixture);
      await expect(deposit.contract.connect(owner).pause())
        .to.emit(deposit.contract, "Paused")
        .withArgs(owner.address);

      await expect(
        deposit.contract.connect(user1).deposit(token1.address, 1000)
      ).to.be.revertedWithCustomError(deposit.contract, "EnforcedPause");
    });
    it("Should reject deposit with no allowance", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1] = erc20Deployments;

      expect(
        deposit.contract.deposit(token1.address, 1000)
      ).to.be.revertedWithCustomError(deposit.contract, "TransferFailed");
    });
    it("Should reject deposit with empty balance", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1] = erc20Deployments;
      await addAllowance(token1, user2, deposit, 1000);

      await expect(
        deposit.contract.connect(user2).deposit(token1.address, 1000)
      ).to.be.revertedWithCustomError(
        token1.contract,
        "ERC20InsufficientBalance"
      );
    });
    it("Should accept valid deposit", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );

      const [token1] = erc20Deployments;
      await addAllowance(token1, owner, deposit, 1000);

      await expect(deposit.contract.deposit(token1.address, 1000))
        .to.emit(deposit.contract, "Deposit")
        .withArgs(owner.address, token1.address, 1000);
    });
    it("Should reject deposit of non-whitelisted token", async () => {
      const { deposit, nonWhitelistedToken } = await loadFixture(
        deployDepositContractFixture
      );

      await addAllowance(nonWhitelistedToken, owner, deposit, 1000);
      await expect(
        deposit.contract
          .connect(owner)
          .deposit(nonWhitelistedToken.address, 1000)
      ).to.be.revertedWithCustomError(deposit.contract, "TokenNotWhitelisted");
    });
  });
  describe("withdraw", () => {
    it("Should reject withdraw when paused", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1] = erc20Deployments;
      await expect(deposit.contract.connect(owner).pause())
        .to.emit(deposit.contract, "Paused")
        .withArgs(owner.address);
      await expect(
        deposit.contract.connect(user1).withdraw(token1.address, 1000)
      ).to.be.revertedWithCustomError(deposit.contract, "EnforcedPause");
    });
    it("Should reject withdraw with no balance", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1] = erc20Deployments;
      await deposit.contract.setWithdrawalsEnabled(true);
      await expect(
        deposit.contract.connect(user1).withdraw(token1.address, 1000)
      ).to.be.revertedWithCustomError(deposit.contract, "InsufficientBalance");
    });
    it("Should reject withdraw when withdrawals disabled", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1] = erc20Deployments;
      await addAllowance(token1, owner, deposit, 1000);
      await expect(
        deposit.contract.connect(owner).withdraw(token1.address, 1000)
      ).to.be.revertedWithCustomError(deposit.contract, "WithdrawalsDisabled");
    });
    it("Should accept valid withdraw", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      await deposit.contract.setWithdrawalsEnabled(true);
      const [token1] = erc20Deployments;
      await addAllowance(token1, owner, deposit, 1000);
      await deposit.contract.deposit(token1.address, 1000);
      await expect(deposit.contract.withdraw(token1.address, 1000))
        .to.emit(deposit.contract, "Withdrawal")
        .withArgs(owner.address, token1.address, 1000);
    });
  });
  describe("addWhitelistedToken", () => {
    it("Should reject addWhitelistedToken when not owner", async () => {
      const { deposit, nonWhitelistedToken } = await loadFixture(
        deployDepositContractFixture
      );
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
      const { deposit, nonWhitelistedToken } = await loadFixture(
        deployDepositContractFixture
      );
      await expect(
        deposit.contract
          .connect(owner)
          .addWhitelistedToken(nonWhitelistedToken.address)
      )
        .to.emit(deposit.contract, "WhitelistedTokenAdded")
        .withArgs(nonWhitelistedToken.address);
    });
  });
  describe("Points System", () => {
    it("Should handle simple points per second increase with ERC20 Deposits", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1, token2] = erc20Deployments;
      let info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(0);
      await addAllowance(token1, owner, deposit, 1000);
      await deposit.contract.deposit(token1.address, 1000);
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(1000);
      await addAllowance(token2, owner, deposit, 1000);
      await deposit.contract.deposit(token2.address, 1000);
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(2000);
    });
    it("Should handle simple points per second increase with ETH Deposits", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      let info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(0);
      await owner.sendTransaction({ to: deposit.address, value: 1000 });
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(1000);
      await owner.sendTransaction({ to: deposit.address, value: 1000 });
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(2000);
    });
    it("Should handle simple points per second increase with ETH & ERC20 Deposits", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1, token2] = erc20Deployments;
      let info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(0);
      await addAllowance(token1, owner, deposit, 1000);
      await deposit.contract.deposit(token1.address, 1000);
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(1000);
      await owner.sendTransaction({ to: deposit.address, value: 1000 });
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(2000);
    });
    it("Should handle points per second mutations with ETH deposits and withdrawals", async () => {
      const { deposit } = await loadFixture(deployDepositContractFixture);
      let info = await deposit.contract.getUserInfo(owner);
      await deposit.contract.setWithdrawalsEnabled(true);
      expect(info.pointsPerSecond).to.equal(0);
      await owner.sendTransaction({ to: deposit.address, value: 1000 });
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(1000);
      await deposit.contract.withdrawEther(1000);
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(0);
    });
    it("Should handle points per second mutations with ERC20 deposits and withdrawals", async () => {
      const { deposit, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1, token2] = erc20Deployments;
      await deposit.contract.setWithdrawalsEnabled(true);
      let info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(0);
      await addAllowance(token1, owner, deposit, 1000);
      await deposit.contract.deposit(token1.address, 1000);
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(1000);
      await deposit.contract.withdraw(token1.address, 1000);
      info = await deposit.contract.getUserInfo(owner);
      expect(info.pointsPerSecond).to.equal(0);
    });
  });
});
