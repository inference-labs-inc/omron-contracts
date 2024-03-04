import { expect } from "chai";

const addAllowance = async (token, holder, spender, amount) => {
  await expect(
    token.contract.connect(holder).approve(spender.address, amount)
  ).to.emit(token.contract, "Approval");
  const allowance = await token.contract.allowance(
    holder.address,
    spender.address
  );
  expect(allowance).to.equal(amount);
};

export { addAllowance };
