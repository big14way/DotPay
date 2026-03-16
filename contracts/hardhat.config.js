require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");
require("hardhat-contract-sizer");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const passetHubConfig = {
  polkavm: true,
  url: "https://testnet-passet-hub-eth-rpc.polkadot.io",
  chainId: 420420422,
  gas: "auto",
  gasPrice: "auto",
  timeout: 120000
};

if (PRIVATE_KEY && PRIVATE_KEY.replace(/^0x/, "").length === 64) {
  passetHubConfig.accounts = [`0x${PRIVATE_KEY.replace(/^0x/, "")}`];
}

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: false
    }
  },

  resolc: {
    version: "0.3.0",
    compilerSource: "npm",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },

  networks: {
    hardhat: {},
    passetHub: passetHubConfig
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD"
  },

  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    disambiguatePaths: false
  }
};
