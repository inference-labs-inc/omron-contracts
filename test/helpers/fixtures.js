import random from "lodash-es/random.js";
import { deployContract } from "../../helpers/deployment.js";

const deployDepositContractFixture = async (numberOfERC20 = 5) => {
  const [owner] = await ethers.getSigners();
  const erc20Deployments = Array(numberOfERC20);
  for (let i = 0; i < numberOfERC20; i++) {
    erc20Deployments[i] = await deployContract("tstETH", [
      random(1000, 10000000),
    ]);
  }

  const contract = await deployContract("OmronDeposit", [
    owner.address,
    erc20Deployments.map((deployment) => deployment.address),
  ]);
  return {
    contract,
    erc20Deployments,
  };
};

export { deployDepositContractFixture };
