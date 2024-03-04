# Omron Smart Contracts

EVM contracts for the Omron network.

## Overview

This project consists of one contract, listed below.

- `OmronDeposit.sol`: A contract allowing deposits of both native and LST ERC-20 tokens for accrual of points.

### Dependencies

- NodeJS (18)

### Install

```console
pnpm install
```

### Deploy to Localhost

```console
pnpm dev
```

### Run Unit Tests

```console
pnpm test
```

### Run Debug on Unit Tests

This is for advanced SC debugging. It will get very loud very quick, be prepared for an onslaught of logs. This uses [`hardhat-tracer`] to fully trace SC calls.

```console
pnpm test:debug
```

### Deploy

```console
pnpm deploy
```

[`hardhat-tracer`]: https://github.com/zemse/hardhat-tracer "Hardhat Tracer GitHub Repo"
