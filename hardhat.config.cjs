require("@nomicfoundation/hardhat-toolbox");
require("hardhat-tracer");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    sepolia: {
      url: "https://sepolia.infura.io/v3/c7fda47531884d49aa5878876dbbabf3",
      accounts: [process.env.SEPOLIA_PRIVATE_KEY],
    },
    mainnet: {
      url: "https://mainnet.infura.io/v3/c7fda47531884d49aa5878876dbbabf3",
      //accounts: [process.env.MAINNET_PRIVATE_KEY],
    },
  },
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
