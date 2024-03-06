// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20Min} from "./interfaces/IERC20Min.sol";

/**
 * @title OmronDeposit
 * @author Inference Labs
 * @notice A contract that allows users to deposit tokens and earn points based on the amount of time the tokens are held in the contract.
 * @dev Users can deposit any token that is accepted by the contract. The contract will track the amount of time the tokens are held in the contract and award points based on the amount of time the tokens are held.
 */
contract OmronDeposit is Ownable, ReentrancyGuard, Pausable {
    // Structs
    struct UserInfo {
        mapping(address => uint256) tokenBalances;
        uint256 pointBalance;
        uint256 pointsPerSecond;
        uint256 lastUpdated;
    }

    // Mappings
    mapping(address => bool) public whitelistedTokens;
    mapping(address => UserInfo) public userInfo;

    // Variables
    bool public withdrawalsEnabled;
    uint8 public constant pointsDecimals = 18;
    address[] public allWhitelistedTokens;

    // Custom Errors
    error ZeroAddress();
    error TokenNotWhitelisted();
    error InsufficientAllowance();
    error InsufficientBalance();
    error TransferFailed();
    error WithdrawalsDisabled();

    // Events
    event Deposit(
        address indexed from,
        address indexed _tokenAddress,
        uint256 amount
    );
    event Withdrawal(
        address indexed to,
        address indexed _tokenAddress,
        uint256 amount
    );
    event EtherDeposit(address indexed from, uint256 amount);
    event EtherWithdrawal(address indexed to, uint amount);
    event WithdrawalsEnabled(bool _enabled);
    event WhitelistedTokenAdded(address _tokenAddress);

    /**
     * @dev The constructor for the OmronDeposit contract.
     * @param _initialOwner The address of the initial owner of the contract.
     * @param _whitelistedTokens An array of addresses of tokens that are accepted by the contract.
     */
    constructor(
        address _initialOwner,
        address[] memory _whitelistedTokens
    ) Ownable(_initialOwner) {
        for (uint256 i = 0; i < _whitelistedTokens.length; i++) {
            address token = _whitelistedTokens[i];
            if (token == address(0)) {
                revert ZeroAddress();
            }
            whitelistedTokens[token] = true;
            allWhitelistedTokens.push(token);
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

    // Modiifiers

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
        return (user.pointsPerSecond, user.lastUpdated, user.pointBalance);
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
        uint _amount
    ) external nonReentrant whenNotPaused {
        if (whitelistedTokens[_tokenAddress] != true) {
            revert TokenNotWhitelisted();
        }

        IERC20Min token = IERC20Min(_tokenAddress);
        bool sent = token.transferFrom(msg.sender, address(this), _amount);
        if (!sent) {
            revert TransferFailed();
        }
        UserInfo storage user = userInfo[msg.sender];
        _updatePoints(user);

        user.pointsPerSecond += _adjustAmountTo18Decimals(
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
        uint _amount
    ) external nonReentrant whenNotPaused whenWithdrawalsEnabled {
        if (whitelistedTokens[_tokenAddress] != true) {
            revert TokenNotWhitelisted();
        }
        UserInfo storage user = userInfo[msg.sender];
        _updatePoints(user);

        uint256 balance = user.tokenBalances[_tokenAddress];
        if (balance < _amount) {
            revert InsufficientBalance();
        }
        IERC20Min token = IERC20Min(_tokenAddress);
        bool sent = token.transfer(msg.sender, _amount);
        if (!sent) {
            revert TransferFailed();
        }
        user.tokenBalances[_tokenAddress] -= _amount;
        user.pointsPerSecond -= _adjustAmountTo18Decimals(
            _amount,
            token.decimals()
        );
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
        uint _amount
    ) external nonReentrant whenNotPaused whenWithdrawalsEnabled {
        UserInfo storage user = userInfo[msg.sender];
        _updatePoints(user);

        uint256 balance = user.tokenBalances[address(0)];
        if (balance < _amount) {
            revert InsufficientBalance();
        }
        payable(msg.sender).transfer(_amount);
        user.tokenBalances[address(0)] -= _amount;
        user.pointsPerSecond -= _amount;
        emit EtherWithdrawal(msg.sender, _amount);
    }

    // Internal functions

    /**
     * @dev Update points information for a user
     * @param _user The user to update the points for
     */
    function _updatePoints(UserInfo storage _user) internal {
        if (_user.lastUpdated != 0) {
            uint256 timeElapsed = block.timestamp - _user.lastUpdated;
            uint256 pointsEarned = timeElapsed * _user.pointsPerSecond;
            _user.pointBalance += pointsEarned;
        }
        _user.lastUpdated = block.timestamp;
    }

    /**
     * Adjust the amount to 18 decimals
     * @param _amount The amount to adjust
     * @param tokenDecimals The number of decimals of the token
     */
    function _adjustAmountTo18Decimals(
        uint256 _amount,
        uint8 tokenDecimals
    ) internal pure returns (uint256) {
        if (tokenDecimals == 18) {
            return _amount;
        } else if (tokenDecimals < 18) {
            return _amount * (10 ** (18 - tokenDecimals));
        } else {
            // Precision loss is acceptable
            return _amount / (10 ** (tokenDecimals - 18));
        }
    }
}
