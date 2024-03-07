// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20Min} from "./interfaces/IERC20Min.sol";

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
        uint256 pointsPerSecond;
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

    // Custom Errors
    error ZeroAddress();
    error TokenNotWhitelisted();
    error InsufficientBalance();
    error TransferFailed();
    error WithdrawalsDisabled();

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
     * Emitted when a user deposits ether into the contract
     * @param from The address of the user that deposited the ether
     * @param amount The amount of ether that was deposited
     */
    event EtherDeposit(address indexed from, uint256 amount);

    /**
     * Emitted when a user withdraws ether from the contract
     * @param to The address of the user that withdrew the ether
     * @param amount The amount of ether that was withdrawn
     */
    event EtherWithdrawal(address indexed to, uint amount);

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
     * @dev The constructor for the OmronDeposit contract.
     * @param _initialOwner The address of the initial owner of the contract.
     * @param _whitelistedTokens An array of addresses of tokens that are accepted by the contract.
     */
    constructor(
        address _initialOwner,
        address[] memory _whitelistedTokens
    ) Ownable(_initialOwner) {
        uint256 length = _whitelistedTokens.length;
        for (uint256 i; i < length; ++i) {
            address token = _whitelistedTokens[i];
            if (token == address(0)) {
                revert ZeroAddress();
            }
            whitelistedTokens[token] = true;
            allWhitelistedTokens.push(token);
            emit WhitelistedTokenAdded(token);
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

    // External view methods

    /**
     * @notice A view method that returns point information about the provided address
     * @param _userAddress The address of the user to check the point information for.
     * @return pointsPerSecond The number of points earned per second by the user.
     * @return lastUpdated The timestamp of the last time the user's points were updated.
     * @return pointBalance The total number of points earned by the user.
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
        )
    {
        UserInfo storage user = userInfo[_userAddress];
        pointsPerSecond = user.pointsPerSecond;
        lastUpdated = user.lastUpdated;
        pointBalance = user.pointBalance;
    }

    /**
     * @notice A view method that returns the list of all whitelisted tokens.
     * @return An array of addresses of all whitelisted tokens.
     */
    function getAllWhitelistedTokens()
        external
        view
        returns (address[] memory)
    {
        return allWhitelistedTokens;
    }

    /**
     * @notice A view method that calculates the points earned by a user.
     * @param _userAddress The address of the user to calculate the points for.
     */
    function calculatePoints(
        address _userAddress
    ) external view returns (uint256) {
        UserInfo storage user = userInfo[_userAddress];
        uint256 timeElapsed = block.timestamp - user.lastUpdated;
        return timeElapsed * user.pointsPerSecond + user.pointBalance;
    }

    /**
     * @notice A view method that returns the token balance for a user.
     * @param _userAddress The address of the user to check the token balance for.
     * @param _tokenAddress The address of the token to check the balance for.
     */
    function tokenBalance(
        address _userAddress,
        address _tokenAddress
    ) external view returns (uint256) {
        UserInfo storage user = userInfo[_userAddress];
        return user.tokenBalances[_tokenAddress];
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
        if (!whitelistedTokens[_tokenAddress]) {
            revert TokenNotWhitelisted();
        }

        IERC20Min token = IERC20Min(_tokenAddress);

        bool sent = token.transferFrom(msg.sender, address(this), _amount);
        if (!sent) {
            revert TransferFailed();
        }

        UserInfo storage user = userInfo[msg.sender];

        _updatePoints(user);

        user.pointsPerSecond += _adjustAmountToPoints(
            _amount,
            token.decimals()
        );
        user.tokenBalances[_tokenAddress] += _amount;

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
        if (!whitelistedTokens[_tokenAddress]) {
            revert TokenNotWhitelisted();
        }

        UserInfo storage user = userInfo[msg.sender];

        uint256 balance = user.tokenBalances[_tokenAddress];
        if (balance < _amount) {
            revert InsufficientBalance();
        }

        IERC20Min token = IERC20Min(_tokenAddress);

        _updatePoints(user);
        user.tokenBalances[_tokenAddress] -= _amount;
        user.pointsPerSecond -= _adjustAmountToPoints(
            _amount,
            token.decimals()
        );

        bool sent = token.transfer(msg.sender, _amount);
        if (!sent) {
            revert TransferFailed();
        }

        emit Withdrawal(msg.sender, _tokenAddress, _amount);
    }

    /**
     * @dev The receive function for the contract. Allows users to deposit ether into the contract.
     */
    receive() external payable nonReentrant whenNotPaused {
        UserInfo storage user = userInfo[msg.sender];

        _updatePoints(user);

        user.pointsPerSecond += msg.value;
        user.tokenBalances[address(0)] += msg.value;

        emit EtherDeposit(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw ether from the contract
     * @param _amount The amount of ether to be withdrawn
     */
    function withdrawEther(
        uint256 _amount
    ) external nonReentrant whenWithdrawalsEnabled {
        UserInfo storage user = userInfo[msg.sender];

        uint256 balance = user.tokenBalances[address(0)];
        if (balance < _amount) {
            revert InsufficientBalance();
        }

        _updatePoints(user);
        user.tokenBalances[address(0)] -= _amount;
        user.pointsPerSecond -= _amount;

        (bool sent, ) = msg.sender.call{value: _amount}("");
        if (!sent) {
            revert TransferFailed();
        }

        emit EtherWithdrawal(msg.sender, _amount);
    }

    // Internal functions

    /**
     * @dev Update points information for a user
     * @param _user The user to update the points for
     */
    function _updatePoints(UserInfo storage _user) private {
        if (_user.lastUpdated != 0) {
            uint256 timeElapsed = block.timestamp - _user.lastUpdated;
            uint256 pointsEarned = timeElapsed * _user.pointsPerSecond;
            _user.pointBalance += pointsEarned;
        }
        _user.lastUpdated = block.timestamp;
    }

    /**
     * Adjust the amount to a points value, based on the token's decimals and the points decimals
     * @param _amount The amount to adjust
     * @param tokenDecimals The number of decimals of the token
     */
    function _adjustAmountToPoints(
        uint256 _amount,
        uint8 tokenDecimals
    ) private pure returns (uint256) {
        if (tokenDecimals == POINTS_DECIMALS) {
            return _amount;
        } else if (tokenDecimals < POINTS_DECIMALS) {
            return _amount * (10 ** (POINTS_DECIMALS - tokenDecimals));
        } else {
            // Precision loss is acceptable
            return _amount / (10 ** (tokenDecimals - POINTS_DECIMALS));
        }
    }
}
