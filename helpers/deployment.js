import hre from "hardhat";
import { isEmpty, uniqueId } from "lodash-es";
import signale from "signale-logger";

const deploymentLogger = signale.scope("Deployment");

let deployedContracts = {};
/**
 * Deploys a contract
 * @param {string} contractName The name of the contract to deploy
 * @param {any[]} [args] The arguments to pass to the contract constructor
 * @returns {Promise<{contract: ethers.Contract, address: string}>} A promise containing the contract and the contract address after deployment
 */
const deployContract = async (contractName, args) => {
  const contractDeploymentLogger = deploymentLogger.scope(
    "Deployment",
    contractName
  );
  try {
    contractDeploymentLogger.await();

    const contract = await hre.ethers.deployContract(
      contractName,
      ...(isEmpty(args) ? [] : [args])
    );
    const transactionHash = contract.deploymentTransaction().hash;
    contractDeploymentLogger.info("Transaction Hash:", transactionHash);
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    contractDeploymentLogger.complete(`Deployed to ${contractAddress}`);
    if (!isEmpty(deployedContracts[contractName])) {
      deployedContracts[contractName + " " + uniqueId()] = {
        contractAddress,
        transactionHash,
      };
    } else {
      deployedContracts[contractName] = { contractAddress, transactionHash };
    }
    return { contract, address: contractAddress };
  } catch (e) {
    contractDeploymentLogger.error(`Failed to deploy ${contractName}\n`, e);
    throw e;
  }
};

const logDeployedContracts = () => {
  console.table(deployedContracts);
};
export { deployContract, deploymentLogger, logDeployedContracts };
