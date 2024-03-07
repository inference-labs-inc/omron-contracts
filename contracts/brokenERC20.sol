// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BrokenERC20 is ERC20 {
    bool public _transfersEnabled;

    constructor(uint256 initialSupply) ERC20("Broken ERC20", "brokenERC20") {
        _mint(msg.sender, initialSupply);
    }

    function setTransfersEnabled(bool _enabled_) public {
        _transfersEnabled = _enabled_;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        return
            _transfersEnabled && super.transferFrom(sender, recipient, amount);
    }

    function transfer(
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        return _transfersEnabled && super.transfer(recipient, amount);
    }
}
