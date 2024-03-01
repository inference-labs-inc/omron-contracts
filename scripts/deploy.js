const hre = require("hardhat");
const {
  deployContract,
  logDeployedContracts,
  deploymentLogger,
} = require("../helpers/deployment");

async function main() {
  deploymentLogger.time("Deployment Time");
  deploymentLogger.start("Deploying contracts...");
  const wallets = await hre.ethers.getSigners(10);
  // Deploy contracts here using deployContract
}
let wasError = false;
main()
  .then(() => {
    deploymentLogger.timeEnd("Deployment Time");
    deploymentLogger.scope("Deployment").complete(`All contracts deployed.`);
  })
  .catch((error) => {
    deploymentLogger.fatal("Deployments Failed\n", error);
    wasError = true;
  })
  .finally(() => {
    logDeployedContracts();
    process.exit(+wasError);
  });
