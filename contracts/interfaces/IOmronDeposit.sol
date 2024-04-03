// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

/**
 * @title Interface for OmronDeposit Contract
 * @notice This interface outlines the functions and events for the OmronDeposit contract, which allows users to deposit tokens and earn points.
 * @custom:security-contact whitehat@inferencelabs.com
 */
interface IOmronDeposit {
    // Structs

    /**
     * @notice A struct that holds information about a user's points and token balances
     */
    struct UserInfo {
        mapping(address tokenAddress => uint256 balanceAmount) tokenBalances;
        uint256 pointBalance;
        uint256 pointsPerHour;
        uint256 lastUpdated;
    }

    // Custom Errors
    error ZeroAddress();
    error TokenNotWhitelisted();
    error ClaimDisabled();
    error ZeroAmount();
    error NotClaimManager();
    error ClaimManagerNotSet();
    error DepositStopCannotBeRetroactive();
    error DepositStopTimeAlreadySet();
    error DepositStopTimeNotPassed();
    error DepositStopTimePassed();
    error ApprovalFailed();

    // Events

    /**
     * Emitted when a user deposits ERC20 tokens into the contract
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
     * Emitted when a user claims their points via the claim contract
     * @param user The address of the user that claimed
     * @param pointsClaimed The number of points the user claimed
     */
    event ClaimPoints(address indexed user, uint256 pointsClaimed);

    /**
     * Emitted when the claim enabled state of the contract is changed
     * @param _enabled The new state of claim enabled
     */
    event ClaimEnabled(bool indexed _enabled);

    /**
     * Emitted when a new token is added to the whitelist
     * @param _tokenAddress The address of the token that was added to the whitelist
     */
    event WhitelistedTokenAdded(address indexed _tokenAddress);

    /**
     * Emitted when the claim manager contract is set
     * @param _claimManager The address of the new claim manager contract
     */
    event ClaimManagerSet(address indexed _claimManager);

    // Owner only methods

    /**
     * @dev Add a new deposit token to the contract
     * @param _tokenAddress The address of the token to be added
     */
    function addWhitelistedToken(address _tokenAddress) external;

    /**
     * @dev Set the claim enabled state of the contract
     * @param _enabled The new state of claim enabled
     */
    function setClaimEnabled(bool _enabled) external;

    /**
     * @dev Set the address of the contract which is allowed to claim points on behalf of users. Can be set to the null address to disable claims.
     * @param _newClaimManager The address of the contract which is allowed to claim points on behalf of users.
     */
    function setClaimManager(address _newClaimManager) external;

    /**
     * @dev Set the timestamp of the end of the points accrual period. Points will no longer accrue for any deposits beyond this timestamp.
     * @param _newDepositStopTime The timestamp of the end of the points accrual period.
     */
    function setDepositStopTime(uint256 _newDepositStopTime) external;

    /**
     * @dev Pause the contract
     */
    function pause() external;

    /**
     * @dev Unpause the contract
     */
    function unpause() external;

    // External view methods

    /**
     * @notice A view method that returns point information about the provided address
     * @param _userAddress The address of the user to check the point information for.
     * @return pointsPerHour The number of points earned per hour by the user.
     * @return lastUpdated The timestamp of the last time the user's points were updated.
     * @return pointBalance The total number of points earned by the user.
     */
    function getUserInfo(
        address _userAddress
    )
        external
        view
        returns (
            uint256 pointsPerHour,
            uint256 lastUpdated,
            uint256 pointBalance
        );

    /**
     * @notice A view method that returns the list of all whitelisted tokens.
     * @return _allWhitelistedTokens An array of addresses of all whitelisted tokens.
     */
    function getAllWhitelistedTokens()
        external
        view
        returns (address[] memory _allWhitelistedTokens);

    /**
     * @notice A view method that calculates the points earned by a user.
     * @param _userAddress The address of the user to calculate the points for.
     * @return currentPointsBalance The total points earned by the user, including points earned from time elapsed since the last update.
     */
    function calculatePoints(
        address _userAddress
    ) external view returns (uint256 currentPointsBalance);

    /**
     * @notice A view method that returns the token balance for a user.
     * @param _userAddress The address of the user to check the token balance for.
     * @param _tokenAddress The address of the token to check the balance for.
     * @return balance The token balance of the user for the specified token.
     */
    function tokenBalance(
        address _userAddress,
        address _tokenAddress
    ) external view returns (uint256 balance);

    // External methods

    /**
     * @dev Deposit a token into the contract
     * @param _tokenAddress The address of the token to be deposited
     * @param _amount The amount of the token to be deposited
     */
    function deposit(address _tokenAddress, uint256 _amount) external;

    /**
     * @dev Called by the claim manager to claim all points for the user
     * @param _userAddress The address of the user to claim for
     * @return pointsClaimed The number of points claimed by the user
     */
    function claim(
        address _userAddress
    ) external returns (uint256 pointsClaimed);
}
