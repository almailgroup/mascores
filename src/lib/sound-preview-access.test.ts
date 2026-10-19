import { describe, expect, it } from "vitest";
import { canPreviewNotificationSounds } from "./sound-preview-access";

describe("notification sound preview visibility", () => {
  it("shows previews only for the requested owner account", () => {
    expect(canPreviewNotificationSounds("mansouralmailscores@gmail.com", true)).toBe(true);
    expect(canPreviewNotificationSounds("11061@dbs.edu.kw", true)).toBe(false);
    expect(canPreviewNotificationSounds("school@example.com", false)).toBe(false);
    expect(canPreviewNotificationSounds(undefined, false)).toBe(false);
    expect(canPreviewNotificationSounds("mansouralmailscores@gmail.com", false)).toBe(false);
  });
});