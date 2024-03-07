// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOmronDeposit {
    // Structs
    struct UserInfo {
        mapping(address => uint256) tokenBalances;
        uint256 pointBalance;
        uint256 pointsPerSecond;
        uint256 lastUpdated;
    }

    // Events
    event Deposit(
        address indexed from,
        address indexed tokenAddress,
        uint256 amount
    );
    event Withdrawal(
        address indexed to,
        address indexed tokenAddress,
        uint256 amount
    );
    event EtherDeposit(address indexed from, uint256 amount);
    event EtherWithdrawal(address indexed to, uint256 amount);
    event WithdrawalsEnabled(bool enabled);
    event WhitelistedTokenAdded(address tokenAddress);

    // Functions
    function addWhitelistedToken(address tokenAddress) external;

    function setWithdrawalsEnabled(bool enabled) external;

    function getUserInfo(
        address userAddress
    )
        external
        view
        returns (
            uint256 pointsPerSecond,
            uint256 lastUpdated,
            uint256 pointBalance
        );

    function getAllWhitelistedTokens() external view returns (address[] memory);

    function calculatePoints(
        address userAddress
    ) external view returns (uint256);

    function tokenBalance(
        address userAddress,
        address tokenAddress
    ) external view returns (uint256);

    function deposit(address tokenAddress, uint256 amount) external;

    function withdraw(address tokenAddress, uint256 amount) external;

    function withdrawEther(uint256 amount) external;
}
