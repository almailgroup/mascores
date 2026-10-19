import { describe, it, expect } from "vitest";
import { speakersAt } from "./recording-player";
const m = [{ t: 0, ids: [] }, { t: 2, ids: ["a"] }, { t: 5, ids: [] }, { t: 9, ids: ["b"] }];
describe("speakersAt", () => {
  it("shows who is talking at that second", () => { expect(speakersAt(m, 3)).toEqual(["a"]); expect(speakersAt(m, 10)).toEqual(["b"]); });
  it("keeps the speaker through a short pause, then clears", () => { expect(speakersAt(m, 5.5)).toEqual(["a"]); expect(speakersAt(m, 7)).toEqual([]); });
});
