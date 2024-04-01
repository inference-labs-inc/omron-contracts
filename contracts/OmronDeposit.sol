// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
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
     * @notice A boolean that indicates if withdrawals are enabled
     */
    bool public withdrawalsEnabled;

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
    address public claimWallet;

    /**
     * @notice A boolean that indicates if claims are enabled
     */
    bool public claimsEnabled;

    // Custom Errors
    error ZeroAddress();
    error TokenNotWhitelisted();
    error InsufficientBalance();
    error WithdrawalsDisabled();
    error ZeroAmount();
    error NotClaimWallet();
    error NoClaimablePoints();
    error ClaimWalletNotSet();
    error ClaimsDisabled();

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
     * Emitted when a user withdraws ERC20 tokens from the contract
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
     * Emitted when the withdrawals enabled state of the contract is changed
     * @param _enabled The new state of withdrawals enabled
     */
    event WithdrawalsEnabled(bool indexed _enabled);

    /**
     * Emitted when a new token is added to the whitelist
     * @param _tokenAddress The address of the token that was added to the whitelist
     */
    event WhitelistedTokenAdded(address indexed _tokenAddress);

    /**
     * Emitted when points are claimed by a user
     * @param user The address of the user that claimed the points
     * @param amountClaimed The amount of points claimed by the user
     * @param newPointBalance The new point balance of the user after the points are claimed
     */
    event PointsClaimed(
        address indexed user,
        uint256 amountClaimed,
        uint256 newPointBalance
    );

    /**
     * Emitted when the claims enabled state of the contract is changed
     * @param _enabled The new state of claims enabled
     */
    event ClaimsEnabled(bool indexed _enabled);

    /**
     * Emitted when the claim wallet is set
     * @param _claimWallet The address of the new claim wallet
     */
    event ClaimWalletSet(address indexed _claimWallet);

    /**
     * @dev The constructor for the OmronDeposit contract.
     * @param _initialOwner The address of the initial owner of the contract.
     * @param _whitelistedTokens An array of addresses of tokens that are accepted by the contract.
     */
    constructor(
        address _initialOwner,
        address[] memory _whitelistedTokens
    ) Ownable(_initialOwner) {
        uint256 length = _whitelistedTokens.length;
        for (uint256 i; i < length; ) {
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
     * @dev Set the withdrawals enabled state of the contract
     * @param _enabled The new state of withdrawals enabled
     */
    function setWithdrawalsEnabled(bool _enabled) external onlyOwner {
        withdrawalsEnabled = _enabled;
        emit WithdrawalsEnabled(_enabled);
    }

    /**
     * @dev Set the claims enabled state of the contract
     * @param _enabled The new state of claims enabled
     */
    function setClaimsEnabled(bool _enabled) external onlyOwner {
        claimsEnabled = _enabled;
        emit ClaimsEnabled(_enabled);
    }

    /**
     * @dev Set the address of the contract which is allowed to claim points on behalf of users. Can be set to the null address to disable claims.
     * @param _claimWallet The address of the contract which is allowed to claim points on behalf of users.
     */
    function setClaimWallet(address _claimWallet) external onlyOwner {
        if (_claimWallet == address(0)) {
            revert ZeroAddress();
        }
        claimWallet = _claimWallet;
        emit ClaimWalletSet(_claimWallet);
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
     * A@dev modifier that checks if withdrawals are enabled
     */
    modifier whenWithdrawalsEnabled() {
        if (!withdrawalsEnabled) {
            revert WithdrawalsDisabled();
        }
        _;
    }

    /**
     * @dev A modifier that checks if the claim wallet is set and the sender is the claim wallet
     */
    modifier onlyClaimWallet() {
        if (claimWallet == address(0)) {
            revert ClaimWalletNotSet();
        }
        if (msg.sender != claimWallet) {
            revert NotClaimWallet();
        }
        _;
    }

    /**
     * @dev A modifier that checks if claims are enabled
     */
    modifier whenClaimsEnabled() {
        if (!claimsEnabled) {
            revert ClaimsDisabled();
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
    ) external nonReentrant whenNotPaused {
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

    /**
     * @dev Withdraw a token from the contract
     * @param _tokenAddress The address of the token to be withdrawn
     * @param _amount The amount of the token to be withdrawn
     */
    function withdraw(
        address _tokenAddress,
        uint256 _amount
    ) external nonReentrant whenWithdrawalsEnabled {
        if (_amount == 0) {
            revert ZeroAmount();
        }

        if (!whitelistedTokens[_tokenAddress]) {
            revert TokenNotWhitelisted();
        }

        UserInfo storage user = userInfo[msg.sender];

        uint256 balance = user.tokenBalances[_tokenAddress];
        if (balance < _amount) {
            revert InsufficientBalance();
        }

        IERC20 token = IERC20(_tokenAddress);

        _updatePoints(user);
        user.tokenBalances[_tokenAddress] -= _amount;
        user.pointsPerHour -= _amount;

        token.safeTransfer(msg.sender, _amount);

        emit Withdrawal(msg.sender, _tokenAddress, _amount);
    }

    /**
     * @dev Claim points from the contract
     * @param _user The address of the user to claim points for
     * @return claimAmount The amount of points claimed by the user
     */
    function claim(
        address _user
    )
        public
        nonReentrant
        whenClaimsEnabled
        onlyClaimWallet
        returns (uint256 claimAmount)
    {
        if (_user == address(0)) {
            revert ZeroAddress();
        }

        UserInfo storage user = userInfo[_user];

        // Check if the user has any points to claim. If not then revert.
        if (user.pointBalance == 0) {
            revert NoClaimablePoints();
        }

        _updatePoints(user);

        // Return their current point balance, and set it to zero.
        claimAmount = user.pointBalance;
        user.pointBalance = 0;

        emit PointsClaimed(_user, claimAmount, user.pointBalance);
    }

    function exit() external nonReentrant whenWithdrawalsEnabled {
        UserInfo storage user = userInfo[msg.sender];
        _updatePoints(user);

        for (uint256 i; i < allWhitelistedTokens.length; ) {
            IERC20 token = IERC20(allWhitelistedTokens[i]);
            if (user.tokenBalances[allWhitelistedTokens[i]] > 0) {
                token.safeTransfer(
                    msg.sender,
                    user.tokenBalances[allWhitelistedTokens[i]]
                );
                user.tokenBalances[allWhitelistedTokens[i]] = 0;
            }
        }

        user.pointsPerHour = 0;
    }

    function claimAndExit() external {
        claim(msg.sender);
        exit();
    }

    // Internal functions

    /**
     * @dev Update points information for a user
     * @param _user The user to update the points for
     */
    function _updatePoints(UserInfo storage _user) private {
        if (_user.lastUpdated != 0) {
            uint256 timeElapsed = block.timestamp - _user.lastUpdated;
            uint256 pointsEarned = (timeElapsed *
                _user.pointsPerHour *
                10 ** POINTS_DECIMALS) / (3600 * 10 ** POINTS_DECIMALS);
            _user.pointBalance += pointsEarned;
        }
        _user.lastUpdated = block.timestamp;
    }
}
