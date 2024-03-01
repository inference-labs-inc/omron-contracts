require("@nomicfoundation/hardhat-toolbox");
require("hardhat-tracer");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  namedAccounts: {
    deployer: 0,
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 4_000,
      },
    },
  },
};
