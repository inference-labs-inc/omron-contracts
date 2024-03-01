const hre = require("hardhat");
const signale = require("signale-logger");
const isEmpty = require("lodash/isEmpty");

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
    deployedContracts[contractName] = { contractAddress, transactionHash };
    return { contract, address: contractAddress };
  } catch (e) {
    contractDeploymentLogger.error(`Failed to deploy ${contractName}\n`, e);
    throw e;
  }
};

const logDeployedContracts = () => {
  console.table(deployedContracts);
};

module.exports = { deployContract, logDeployedContracts, deploymentLogger };
