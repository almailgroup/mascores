import { describe, it, expect } from "vitest";
import { speakersAt } from "./recording-player";
const m = [{ t: 0, ids: [] }, { t: 2, ids: ["a"] }, { t: 5, ids: [] }, { t: 9, ids: ["b"] }];
describe("speakersAt", () => {
  it("shows who is talking at that second", () => { expect(speakersAt(m, 3)).toEqual(["a"]); expect(speakersAt(m, 10)).toEqual(["b"]); });
  it("keeps the speaker through a short pause, then clears", () => { expect(speakersAt(m, 5.5)).toEqual(["a"]); expect(speakersAt(m, 7)).toEqual([]); });
});

import { SPEEDS } from "./recording-player";
import { test as speedTest, expect as speedExpect } from "vitest";
speedTest("recordings offer 0.5x, 1x, 1.5x, 2x and 3x speeds", () => {
  speedExpect([...SPEEDS]).toEqual([0.5, 1, 1.5, 2, 3]);
});
