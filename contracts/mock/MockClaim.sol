// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import {IOmronDeposit} from "../interfaces/IOmronDeposit.sol";

/**
 * @title MockClaim
 * @author Inference Labs
 * @notice MockClaim is a mock claim contract implementation for claiming points and withdrawing tokens from the OmronDeposit contract.
 */
contract MockClaim {
    IOmronDeposit depositContract;

    event ClaimSuccess(
        address indexed _addressToClaimFor,
        uint256 _pointsReturned
    );

    constructor(address _deposit) {
        depositContract = IOmronDeposit(_deposit);
    }

    function exit(address _addressToClaimFor) external {
        uint256 pointsClaimed = depositContract.exit(_addressToClaimFor);
        emit ClaimSuccess(_addressToClaimFor, pointsClaimed);
    }
}
