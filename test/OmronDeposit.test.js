import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployDepositContractFixture } from "./helpers/fixtures.js";
import { addAllowance } from "./helpers/utils.js";

describe("OmronDeposit", () => {
  let owner, user1, user2;
  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });
  describe("depositETH", () => {
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
});
