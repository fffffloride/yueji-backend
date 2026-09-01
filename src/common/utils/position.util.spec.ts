import { moveIdToPosition } from "./position.util";

describe("moveIdToPosition", () => {
  it("移动到首尾并拒绝越界位置", () => {
    expect(moveIdToPosition(["a", "b", "c"], "c", 1)).toEqual(["c", "a", "b"]);
    expect(moveIdToPosition(["a", "b", "c"], "a", 3)).toEqual(["b", "c", "a"]);
    expect(() => moveIdToPosition(["a"], "a", 2)).toThrow("目标位置必须在 1-1 之间");
  });
});
