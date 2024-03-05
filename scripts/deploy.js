import hre from "hardhat";
import {
  deployContract,
  deploymentLogger,
  logDeployedContracts,
} from "../helpers/deployment.js";

const tokens = {
  mainnet: {
    stETH: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
    wBETH: "0xa2E3356610840701BDf5611a53974510Ae27E2e1",
    ETHx: "0xA35b1B31Ce002FBF2058D22F30f95D405200A15b",
    sfrxETH: "0xac3E018457B222d93114458476f3E3416Abbe38F",
  },
  sepolia: {},
  localhost: {},
};

async function main() {
  deploymentLogger.time("Deployment Time");

  deploymentLogger[process.env.DRY_RUN ? "dry_run" : "start"](
    "Deploying contracts..."
  );
  const wallets = await hre.ethers.getSigners(10);
  // Deploy contracts here using deployContract
  let tokenAddresses = tokens[hre.network.name];
  if (hre.network.name === "localhost") {
    const erc20Deployments = [];
    for (let i = 0; i < 5; i++) {
      erc20Deployments[i] = await deployContract("tstETH", [
        ethers.parseEther("1000000"),
      ]);
    }
    tokenAddresses = erc20Deployments.map((d) => d.address);
  }

  await deployContract("OmronDeposit", [wallets[0].address, tokenAddresses]);
}
let wasError = false;
main()
  .then(() => {
    deploymentLogger.timeEnd("Deployment Time");
    deploymentLogger
      .scope("Deployment")
      [process.env.DRY_RUN ? "dry_run" : "start"](`All contracts deployed.`);
  })
  .catch((error) => {
    deploymentLogger.fatal("Deployments Failed\n", error);
    wasError = true;
  })
  .finally(() => {
    logDeployedContracts();
    process.exit(+wasError);
  });
