// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title Interface for OmronDeposit Contract
 * @dev Interface for the OmronDeposit contract, defining the essential functions and events for interacting with the OmronDeposit system.
 */
interface IOmronDeposit {
    /**
     * @dev Struct to store user information including token balances, point balance, points per second, and last updated timestamp.
     */
    struct UserInfo {
        mapping(address => uint256) tokenBalances; // Mapping of token addresses to their respective balances for a user.
        uint256 pointBalance; // The total points balance of the user.
        uint256 pointsPerSecond; // The rate at which the user earns points per second.
        uint256 lastUpdated; // The last timestamp when the user's points were updated.
    }

    /**
     * @dev Emitted when a deposit is made.
     * @param from The address making the deposit.
     * @param tokenAddress The address of the token being deposited.
     * @param amount The amount of tokens deposited.
     */
    event Deposit(
        address indexed from,
        address indexed tokenAddress,
        uint256 amount
    );

    /**
     * @dev Emitted when a withdrawal is made.
     * @param to The address making the withdrawal.
     * @param tokenAddress The address of the token being withdrawn.
     * @param amount The amount of tokens withdrawn.
     */
    event Withdrawal(
        address indexed to,
        address indexed tokenAddress,
        uint256 amount
    );

    /**
     * @dev Emitted when an Ether deposit is made.
     * @param from The address making the deposit.
     * @param amount The amount of Ether deposited.
     */
    event EtherDeposit(address indexed from, uint256 amount);

    /**
     * @dev Emitted when an Ether withdrawal is made.
     * @param to The address making the withdrawal.
     * @param amount The amount of Ether withdrawn.
     */
    event EtherWithdrawal(address indexed to, uint256 amount);

    /**
     * @dev Emitted when withdrawals are enabled or disabled.
     * @param enabled Boolean indicating the new state of withdrawals.
     */
    event WithdrawalsEnabled(bool enabled);

    /**
     * @dev Emitted when a new token is added to the whitelist.
     * @param tokenAddress The address of the token being whitelisted.
     */
    event WhitelistedTokenAdded(address tokenAddress);

    /**
     * @dev Adds a new token to the whitelist.
     * @param tokenAddress The address of the token to be whitelisted.
     */
    function addWhitelistedToken(address tokenAddress) external;

    /**
     * @dev Enables or disables withdrawals.
     * @param enabled Boolean indicating the desired state of withdrawals.
     */
    function setWithdrawalsEnabled(bool enabled) external;

    /**
     * @dev Retrieves user information.
     * @param userAddress The address of the user.
     * @return pointsPerSecond The rate at which the user earns points per second.
     * @return lastUpdated The last timestamp when the user's points were updated.
     * @return pointBalance The total points balance of the user.
     */
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

    /**
     * @dev Retrieves all whitelisted tokens.
     * @return An array of addresses of all whitelisted tokens.
     */
    function getAllWhitelistedTokens() external view returns (address[] memory);

    /**
     * @dev Calculates the total points earned by a user.
     * @param userAddress The address of the user.
     * @return The total points earned by the user.
     */
    function calculatePoints(
        address userAddress
    ) external view returns (uint256);

    /**
     * @dev Retrieves the token balance for a user.
     * @param userAddress The address of the user.
     * @param tokenAddress The address of the token.
     * @return The balance of the specified token for the user.
     */
    function tokenBalance(
        address userAddress,
        address tokenAddress
    ) external view returns (uint256);

    /**
     * @dev Deposits tokens into the system.
     * @param tokenAddress The address of the token to deposit.
     * @param amount The amount of tokens to deposit.
     */
    function deposit(address tokenAddress, uint256 amount) external;

    /**
     * @dev Withdraws tokens from the system.
     * @param tokenAddress The address of the token to withdraw.
     * @param amount The amount of tokens to withdraw.
     */
    function withdraw(address tokenAddress, uint256 amount) external;

    /**
     * @dev Withdraws Ether from the system.
     * @param amount The amount of Ether to withdraw.
     */
    function withdrawEther(uint256 amount) external;
}
