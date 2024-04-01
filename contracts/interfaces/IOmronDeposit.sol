// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

/**
 * @title Interface for OmronDeposit Contract
 * @notice This interface outlines the functions and events for the OmronDeposit contract, which allows users to deposit tokens and earn points.
 * @custom:security-contact whitehat@inferencelabs.com
 */
interface IOmronDeposit {
    /**
     * @notice Struct to store user information including token balances and points
     * @dev UserInfo struct contains mappings for token balances and variables for point tracking
     */
    struct UserInfo {
        mapping(address tokenAddress => uint256 balanceAmount) tokenBalances; // Mapping of token addresses to their respective balances for a user
        uint256 pointBalance; // Total points balance of the user
        uint256 pointsPerSecond; // Rate at which the user earns points per second
        uint256 lastUpdated; // Timestamp of the last update to user's points
    }

    /**
     * @notice Deposits a specified amount of a token into the contract
     * @param _tokenAddress The address of the token to deposit
     * @param _amount The amount of the token to deposit
     */
    function deposit(address _tokenAddress, uint256 _amount) external;

    /**
     * @notice Withdraws a specified amount of a token from the contract
     * @param _tokenAddress The address of the token to withdraw
     * @param _amount The amount of the token to withdraw
     */
    function withdraw(address _tokenAddress, uint256 _amount) external;

    /**
     * @notice Withdraws a specified amount of Ether from the contract
     * @param _amount The amount of Ether to withdraw
     */
    function withdrawEther(uint256 _amount) external;

    /**
     * @notice Adds a token to the list of whitelisted tokens
     * @param _tokenAddress The address of the token to whitelist
     */
    function addWhitelistedToken(address _tokenAddress) external;

    /**
     * @notice Enables or disables withdrawals from the contract
     * @param _enabled Boolean indicating whether withdrawals should be enabled
     */
    function setWithdrawalsEnabled(bool _enabled) external;

    /**
     * @notice Pauses the contract, disabling deposits
     */
    function pause() external;

    /**
     * @notice Unpauses the contract, enabling deposits
     */
    function unpause() external;

    /**
     * @notice Returns a list of all whitelisted tokens
     * @return _allWhitelistedTokens An array of addresses of whitelisted tokens
     */
    function getAllWhitelistedTokens()
        external
        view
        returns (address[] memory _allWhitelistedTokens);

    /**
     * @notice Calculates the total points earned by a user
     * @param _userAddress The address of the user
     * @return currentPointsBalance The total points earned by the user
     */
    function calculatePoints(
        address _userAddress
    ) external view returns (uint256 currentPointsBalance);

    /**
     * @notice Returns the token balance of a user for a specific token
     * @param _userAddress The address of the user
     * @param _tokenAddress The address of the token
     * @return balance The token balance of the user
     */
    function tokenBalance(
        address _userAddress,
        address _tokenAddress
    ) external view returns (uint256 balance);

    /**
     * @notice Returns detailed user information including points per second, last updated timestamp, and point balance
     * @param _userAddress The address of the user
     * @return pointsPerSecond The rate at which the user earns points per second
     * @return lastUpdated The timestamp of the last update to user's points
     * @return pointBalance The total points balance of the user
     */
    function getUserInfo(
        address _userAddress
    )
        external
        view
        returns (
            uint256 pointsPerSecond,
            uint256 lastUpdated,
            uint256 pointBalance
        );

    // Events
    /**
     * @dev Emitted when a user deposits ERC20 tokens into the contract
     * @param from The address of the user that deposited the tokens
     * @param tokenAddress The address of the token that was deposited
     * @param amount The amount of the token that was deposited
     */
    event Deposit(
        address indexed from,
        address indexed tokenAddress,
        uint256 amount
    );

    /**
     * @dev Emitted when a user withdraws ERC20 tokens from the contract
     * @param to The address of the user that withdrew the tokens
     * @param tokenAddress The address of the token that was withdrawn
     * @param amount The amount of the token that was withdrawn
     */
    event Withdrawal(
        address indexed to,
        address indexed tokenAddress,
        uint256 amount
    );

    /**
     * @dev Emitted when a user deposits Ether into the contract
     * @param from The address of the user that deposited the Ether
     * @param amount The amount of Ether that was deposited
     */
    event EtherDeposit(address indexed from, uint256 amount);

    /**
     * @dev Emitted when a user withdraws Ether from the contract
     * @param to The address of the user that withdrew the Ether
     * @param amount The amount of Ether that was withdrawn
     */
    event EtherWithdrawal(address indexed to, uint256 amount);

    /**
     * @dev Emitted when the withdrawals enabled state is changed
     * @param _enabled The new state of withdrawals enabled
     */
    event WithdrawalsEnabled(bool indexed _enabled);

    /**
     * @dev Emitted when a new token is added to the whitelist
     * @param _tokenAddress The address of the token that was whitelisted
     */
    event WhitelistedTokenAdded(address indexed _tokenAddress);
}
