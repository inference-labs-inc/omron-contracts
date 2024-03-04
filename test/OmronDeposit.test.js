import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployDepositContractFixture } from "./helpers/fixtures.js";
import { addAllowance } from "./helpers/utils.js";

describe("OmronDeposit", () => {
  describe("deposit", () => {
    it("Should reject deposit with no allowance", async () => {
      const { contract, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1] = erc20Deployments;

      expect(
        contract.contract.deposit(token1.address, 1000)
      ).to.be.revertedWithCustomError(contract.contract, "TransferFailed");
    });
    it("Should reject deposit with empty balance", async () => {
      const [, user2] = await ethers.getSigners();
      const { contract, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );
      const [token1] = erc20Deployments;
      await addAllowance(token1, user2, contract, 1000);

      await expect(
        contract.contract.connect(user2).deposit(token1.address, 1000)
      ).to.be.revertedWithCustomError(
        token1.contract,
        "ERC20InsufficientBalance"
      );
    });
    it("Should accept valid deposit", async () => {
      const [owner] = await ethers.getSigners();
      const { contract, erc20Deployments } = await loadFixture(
        deployDepositContractFixture
      );

      const [token1] = erc20Deployments;
      await addAllowance(token1, owner, contract, 1000);

      await expect(contract.contract.deposit(token1.address, 1000))
        .to.emit(contract.contract, "Deposit")
        .withArgs(owner.address, token1.address, 1000);
    });
  });
});
