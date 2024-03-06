import { deployContract } from "../../helpers/deployment.js";

const deployDepositContractFixture = async (numberOfERC20 = 5) => {
  const [owner] = await ethers.getSigners();
  const erc20Deployments = Array(numberOfERC20);
  for (let i = 0; i < numberOfERC20; i++) {
    erc20Deployments[i] = await deployContract("tstETH", [
      ethers.parseEther("1000000"),
      18,
    ]);
  }

  const nonWhitelistedToken = await deployContract("tstETH", [
    ethers.parseEther("1000000"),
    18,
  ]);
  const token6decimals = await deployContract("tstETH", [
    ethers.parseEther("1000000"),
    6,
  ]);
  const token20decimals = await deployContract("tstETH", [
    ethers.parseEther("1000000"),
    20,
  ]);

  const contract = await deployContract("OmronDeposit", [
    owner.address,
    erc20Deployments
      .map((deployment) => deployment.address)
      .concat([token6decimals.address, token20decimals.address]),
  ]);

  return {
    deposit: contract,
    erc20Deployments,
    nonWhitelistedToken,
    token6decimals,
    token20decimals,
  };
};

export { deployDepositContractFixture };
