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
        address indexed _tokenAddress,
        uint amount
    );
    event Withdrawal(
        address indexed to,
        address indexed _tokenAddress,
        uint amount
    );
    event EtherDeposit(address indexed from, uint amount);
    event EtherWithdrawal(address indexed to, uint amount);

    // Functions
    function addDepositToken(address _tokenAddress) external;

    function setWithdrawalsEnabled(bool _enabled) external;

    function pointsPerSecond(
        address _userAddress
    ) external view returns (uint256);

    function calculatePoints(
        address _userAddress
    ) external view returns (uint256);

    function tokenBalance(
        address _userAddress,
        address _tokenAddress
    ) external view returns (uint256);

    function deposit(address _tokenAddress, uint _amount) external;

    function withdraw(address _tokenAddress, uint _amount) external;

    function withdrawEther(uint _amount) external;
}
