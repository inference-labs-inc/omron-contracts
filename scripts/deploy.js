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
  sepolia: {
    stETH: "0x8b78223e2FD9FEa8D30F1A6E36D7A1dEfab28c5e",
    wBETH: "0x316E35C4cf00fbb52022434942A1FE396C787500",
    ETHx: "0x4a0853d9e0d34Be4fE7BD8d7D8088aD2caA3AFEf",
    sfrxETH: "0x54Ef507CE3bB70a2FD615D40572D356345444220",
  },
  localhost: {},
};

async function main() {
  deploymentLogger.time("Deployment Time");

  deploymentLogger[process.env.DRY_RUN ? "dry_run" : "start"](
    "Deploying contracts..."
  );
  const wallets = await hre.ethers.getSigners(10);
  // Deploy contracts here using deployContract
  let tokenAddresses = Object.values(tokens[hre.network.name]);
  if (hre.network.name === "localhost") {
    const erc20Deployments = [];
    for (let i = 0; i < 5; i++) {
      erc20Deployments[i] = await deployContract("tstETH", [
        ethers.parseEther("1000000"),
        18,
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
