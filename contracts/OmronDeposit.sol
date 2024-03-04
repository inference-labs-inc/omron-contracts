// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
    mapping(address => bool) public acceptedDepositCurrencies;
    mapping(address => UserInfo) public userInfo;

    // Variables
    bool public withdrawalsEnabled;

    // Custom Errors
    error ZeroAddress();
    error CurrencyNotAccepted();
    error InsufficientAllowance();
    error InsufficientBalance();
    error TransferFailed();
    error WithdrawalsDisabled();

    // Events
    event Deposit(address from, address _tokenAddress, uint amount);
    event Withdrawal(address to, address _tokenAddress, uint amount);
    event EtherDeposit(address from, uint amount);
    event EtherWithdrawal(address to, uint amount);

    /**
     * @dev The constructor for the OmronDeposit contract.
     * @param _initialOwner The address of the initial owner of the contract.
     * @param _acceptedDepositCurrencies An array of addresses of tokens that are accepted by the contract.
     */
    constructor(
        address _initialOwner,
        address[] memory _acceptedDepositCurrencies
    ) Ownable(_initialOwner) {
        for (uint256 i = 0; i < _acceptedDepositCurrencies.length; i++) {
            address token = _acceptedDepositCurrencies[i];
            if (token == address(0)) {
                revert ZeroAddress();
            }
            acceptedDepositCurrencies[token] = true;
        }
    }

    // Owner only methods
    /**
     * @dev Add a new deposit token to the contract
     * @param _tokenAddress The address of the token to be added
     */
    function addDepositToken(address _tokenAddress) external onlyOwner {
        require(_tokenAddress != address(0), "OmronDeposit: zero address");
        acceptedDepositCurrencies[_tokenAddress] = true;
    }

    /**
     * @dev Set the withdrawals enabled state of the contract
     * @param _enabled The new state of the withdrawals enabled state
     */
    function setWithdrawalsEnabled(bool _enabled) external onlyOwner {
        withdrawalsEnabled = _enabled;
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

    // Public view methods

    /**
     * @notice A view method that returns the points per second for a user.
     * @param _userAddress The address of the user to check the points per second for.
     */
    function pointsPerSecond(
        address _userAddress
    ) public view returns (uint256) {
        UserInfo storage user = userInfo[_userAddress];
        return user.pointsPerSecond;
    }

    /**
     * @notice A view method that calculates the points earned by a user.
     * @param _userAddress The address of the user to calculate the points for.
     */
    function calculatePoints(
        address _userAddress
    ) public view returns (uint256) {
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
    ) public view returns (uint256) {
        UserInfo storage user = userInfo[_userAddress];
        return user.tokenBalances[_tokenAddress];
    }

    // Public methods

    /**
     * @dev Deposit a token into the contract
     * @param _tokenAddress The address of the token to be deposited
     * @param _amount The amount of the token to be deposited
     */
    function deposit(
        address _tokenAddress,
        uint _amount
    ) external nonReentrant whenNotPaused {
        if (acceptedDepositCurrencies[_tokenAddress] != true) {
            revert CurrencyNotAccepted();
        }
        IERC20 token = IERC20(_tokenAddress);

        bool sent = token.transferFrom(msg.sender, address(this), _amount);
        if (!sent) {
            revert TransferFailed();
        }
        updatePoints(msg.sender);
        UserInfo storage user = userInfo[msg.sender];
        user.pointsPerSecond += _amount;
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
        if (acceptedDepositCurrencies[_tokenAddress] != true) {
            revert CurrencyNotAccepted();
        }
        updatePoints(msg.sender);
        UserInfo storage user = userInfo[msg.sender];
        uint256 balance = user.tokenBalances[_tokenAddress];
        if (balance < _amount) {
            revert InsufficientBalance();
        }
        IERC20 token = IERC20(_tokenAddress);
        bool sent = token.transfer(msg.sender, _amount);
        if (!sent) {
            revert TransferFailed();
        }
        user.tokenBalances[_tokenAddress] -= _amount;
        user.pointsPerSecond -= _amount;
        emit Withdrawal(msg.sender, _tokenAddress, _amount);
    }

    /**
     * @dev The receive function for the contract. Allows users to deposit ether into the contract.
     */
    receive() external payable nonReentrant whenNotPaused {
        updatePoints(msg.sender);
        UserInfo storage user = userInfo[msg.sender];
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
        updatePoints(msg.sender);
        UserInfo storage user = userInfo[msg.sender];
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
     * @dev Update the points for a user
     * @param _userAddress The address of the user to update the points for
     */
    function updatePoints(address _userAddress) internal {
        UserInfo storage user = userInfo[_userAddress];
        if (user.lastUpdated != 0) {
            uint256 timeElapsed = block.timestamp - user.lastUpdated;
            uint256 pointsEarned = timeElapsed * user.pointsPerSecond;
            user.pointBalance += pointsEarned;
        }
        user.lastUpdated = block.timestamp;
    }
}
