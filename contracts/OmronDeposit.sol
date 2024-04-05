// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

using SafeERC20 for IERC20;

/**
 * @title OmronDeposit
 * @author Inference Labs
 * @custom:security-contact whitehat@inferencelabs.com
 * @notice A contract that allows users to deposit tokens and earn points based on the amount of time the tokens are held in the contract.
 * @dev Users can deposit any token that is accepted by the contract. The contract will track the amount of time the tokens are held in the contract and award points based on the amount of time the tokens are held.
 */
contract OmronDeposit is Ownable, ReentrancyGuard, Pausable {
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

    // Mappings

    /**
     * @notice A mapping of whitelisted tokens to a boolean indicating if the token is whitelisted
     */
    mapping(address tokenAddress => bool isWhitelisted)
        public whitelistedTokens;

    /**
     * @notice A mapping of user addresses to information about the user including points and token balances
     */
    mapping(address userAddress => UserInfo userInformation) public userInfo;

    // Variables

    /**
     * @notice The number of decimal places for points
     */
    uint8 public constant POINTS_DECIMALS = 18;

    /**
     * @notice An array of addresses of all whitelisted tokens
     */
    address[] public allWhitelistedTokens;

    /**
     * @notice The address of the contract which is allowed to claim points on behalf of users.
     */
    address public claimManager;

    /**
     * @notice The time at which claims become enabled and points no longer accrue for any deposits.
     */
    uint256 public depositStopTime;

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
     * Emitted when a new token is added to the whitelist
     * @param _tokenAddress The address of the token that was added to the whitelist
     */
    event WhitelistedTokenAdded(address indexed _tokenAddress);

    /**
     * Emitted when the claim manager contract is set
     * @param _claimManager The address of the new claim manager contract
     */
    event ClaimManagerSet(address indexed _claimManager);

    /**
     * Emitted when the deposit stop time is set
     * @param _depositStopTime The timestamp of the new deposit stop time
     */
    event DepositStopTimeSet(uint256 indexed _depositStopTime);

    /**
     * Emitted when tokens are withdrawn from the contract
     * @param _userAddress The address of the user that withdrawn the tokens
     * @param _withdrawnAmounts An array of the amounts of the tokens that were withdrawn
     */
    event WithdrawTokens(
        address indexed _userAddress,
        uint256[] _withdrawnAmounts
    );

    /**
     * @dev The constructor for the OmronDeposit contract.
     * @param _initialOwner The address of the initial owner of the contract.
     * @param _whitelistedTokens An array of addresses of tokens that are accepted by the contract.
     */
    constructor(
        address _initialOwner,
        address[] memory _whitelistedTokens
    ) Ownable(_initialOwner) {
        for (uint256 i; i < _whitelistedTokens.length; ) {
            address token = _whitelistedTokens[i];
            if (token == address(0)) {
                revert ZeroAddress();
            }
            whitelistedTokens[token] = true;
            allWhitelistedTokens.push(token);

            emit WhitelistedTokenAdded(token);
            unchecked {
                ++i;
            }
        }
    }

    // Owner only methods

    /**
     * @dev Add a new deposit token to the contract
     * @param _tokenAddress The address of the token to be added
     */
    function addWhitelistedToken(address _tokenAddress) external onlyOwner {
        if (_tokenAddress == address(0)) {
            revert ZeroAddress();
        }
        whitelistedTokens[_tokenAddress] = true;
        allWhitelistedTokens.push(_tokenAddress);
        emit WhitelistedTokenAdded(_tokenAddress);
    }

    /**
     * @dev Set the address of the contract which is allowed to claim points on behalf of users. Can be set to the null address to disable claims.
     * @param _newClaimManager The address of the contract which is allowed to claim points on behalf of users.
     */
    function setClaimManager(address _newClaimManager) external onlyOwner {
        if (_newClaimManager == address(0)) {
            revert ZeroAddress();
        }
        // Set the new claim manager
        claimManager = _newClaimManager;

        emit ClaimManagerSet(_newClaimManager);
    }

    /**
     * @notice Ends the deposit period
     * @dev This will:
     * 1. Set the deposit stop time to the current block time
     * 2. Emit the DepositStopTimeSet event
     * As a result:
     * Deposits will no longer be accepted
     * Claims will be enabled
     * Withdrawals will be enabled
     * Points accrual will no longer take place
     */
    function stopDeposits() external onlyOwner {
        if (depositStopTime != 0) {
            revert DepositStopTimeAlreadySet();
        }
        depositStopTime = block.timestamp;
        emit DepositStopTimeSet(block.timestamp);
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // Modifiers

    /**
     * @dev A modifier that checks if the claim manager contract address is set and the sender is the claim manager contract
     */
    modifier onlyClaimManager() {
        if (claimManager == address(0)) {
            revert ClaimManagerNotSet();
        }
        if (msg.sender != claimManager) {
            revert NotClaimManager();
        }
        _;
    }

    /**
     * @dev A modifier that checks whether the current time is after the deposit stop time.
     */
    modifier onlyAfterDepositStopTime() {
        if (depositStopTime == 0 || block.timestamp < depositStopTime) {
            revert DepositStopTimeNotPassed();
        }
        _;
    }

    /**
     * @dev A modifier that checkes whether the current time is before the deposit stop time.
     * Will proceed to execution if deposit stop time isn't set, or if it is set to a date after the current time.
     */
    modifier onlyBeforeDepositStopTime() {
        if (depositStopTime != 0 && block.timestamp >= depositStopTime) {
            revert DepositStopTimePassed();
        }
        _;
    }

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
        )
    {
        UserInfo storage user = userInfo[_userAddress];
        pointsPerHour = user.pointsPerHour;
        lastUpdated = user.lastUpdated;
        pointBalance = user.pointBalance;
    }

    /**
     * @notice A view method that returns the list of all whitelisted tokens.
     * @return _allWhitelistedTokens An array of addresses of all whitelisted tokens.
     */
    function getAllWhitelistedTokens()
        external
        view
        returns (address[] memory _allWhitelistedTokens)
    {
        _allWhitelistedTokens = allWhitelistedTokens;
    }

    /**
     * @notice A view method that calculates the points earned by a user.
     * @param _userAddress The address of the user to calculate the points for.
     * @return currentPointsBalance The total points earned by the user, including points earned from time elapsed since the last update.
     */
    function calculatePoints(
        address _userAddress
    ) external view returns (uint256 currentPointsBalance) {
        UserInfo storage user = userInfo[_userAddress];
        uint256 timeElapsed = block.timestamp - user.lastUpdated;
        uint256 pointsEarned = (timeElapsed *
            user.pointsPerHour *
            10 ** POINTS_DECIMALS) / (3600 * 10 ** POINTS_DECIMALS);
        currentPointsBalance = pointsEarned + user.pointBalance;
    }

    /**
     * @notice A view method that returns the token balance for a user.
     * @param _userAddress The address of the user to check the token balance for.
     * @param _tokenAddress The address of the token to check the balance for.
     * @return balance The token balance of the user for the specified token.
     */
    function tokenBalance(
        address _userAddress,
        address _tokenAddress
    ) external view returns (uint256 balance) {
        UserInfo storage user = userInfo[_userAddress];
        balance = user.tokenBalances[_tokenAddress];
    }

    // External methods

    /**
     * @dev Deposit a token into the contract
     * @param _tokenAddress The address of the token to be deposited
     * @param _amount The amount of the token to be deposited
     */
    function deposit(
        address _tokenAddress,
        uint256 _amount
    ) external nonReentrant whenNotPaused onlyBeforeDepositStopTime {
        if (_amount == 0) {
            revert ZeroAmount();
        }

        if (!whitelistedTokens[_tokenAddress]) {
            revert TokenNotWhitelisted();
        }

        IERC20 token = IERC20(_tokenAddress);

        UserInfo storage user = userInfo[msg.sender];

        _updatePoints(user);

        user.pointsPerHour += _amount;
        user.tokenBalances[_tokenAddress] += _amount;

        token.safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposit(msg.sender, _tokenAddress, _amount);
    }

    function withdrawTokens(
        address _userAddress
    )
        external
        nonReentrant
        whenNotPaused
        onlyClaimManager
        onlyAfterDepositStopTime
        returns (uint256[] memory withdrawnAmounts)
    {
        withdrawnAmounts = new uint256[](allWhitelistedTokens.length);

        for (uint256 i; i < allWhitelistedTokens.length; ) {
            UserInfo storage user = userInfo[_userAddress];
            uint256 userBalance = user.tokenBalances[allWhitelistedTokens[i]];

            if (userBalance == 0) {
                unchecked {
                    ++i;
                }
                continue;
            }

            withdrawnAmounts[i] = userBalance;

            user.tokenBalances[allWhitelistedTokens[i]] = 0;

            IERC20 token = IERC20(allWhitelistedTokens[i]);
            token.safeTransfer(claimManager, userBalance);
        }
        emit WithdrawTokens(_userAddress, withdrawnAmounts);
        return withdrawnAmounts;
    }

    /**
     * @dev Called by the claim manager to claim all points for the user
     * @param _userAddress The address of the user to claim for
     * @return pointsClaimed The number of points claimed by the user
     */
    function claim(
        address _userAddress
    )
        external
        nonReentrant
        whenNotPaused
        onlyClaimManager
        onlyAfterDepositStopTime
        returns (uint256 pointsClaimed)
    {
        if (_userAddress == address(0)) {
            revert ZeroAddress();
        }

        UserInfo storage user = userInfo[_userAddress];

        pointsClaimed = _claimPoints(user);

        emit ClaimPoints(_userAddress, pointsClaimed);
    }

    /**
     * @dev Claim points from the contract
     * @param _user The user to claim points for
     * @return pointsClaimed The number of points claimed by the user
     */
    function _claimPoints(
        UserInfo storage _user
    ) private returns (uint256 pointsClaimed) {
        _updatePoints(_user);

        // Return their current point balance, and set it to zero.
        pointsClaimed = _user.pointBalance;
        _user.pointBalance = 0;
        _user.pointsPerHour = 0;
    }

    // Internal functions

    /**
     * @dev Update points information for a user
     * @param _user The user to update the points for
     */
    function _updatePoints(UserInfo storage _user) private {
        if (_user.lastUpdated != 0) {
            uint256 timeElapsed = block.timestamp - _user.lastUpdated;
            // If the current time is after the depositStopTime and it is non-zero, then use it to determine time elapsed,
            // since no points are being accrued after deposit stop
            if (block.timestamp > depositStopTime && depositStopTime != 0) {
                timeElapsed = depositStopTime - _user.lastUpdated;
            }
            uint256 pointsEarned = (timeElapsed *
                _user.pointsPerHour *
                10 ** POINTS_DECIMALS) / (3600 * 10 ** POINTS_DECIMALS);
            _user.pointBalance += pointsEarned;
        }
        _user.lastUpdated = block.timestamp;
    }
}
