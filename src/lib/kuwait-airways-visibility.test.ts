import { describe, expect, it } from "vitest";
import { canViewKuwaitAirways } from "./kuwait-airways-visibility";

describe("Kuwait Airways account-only visibility", () => {
  const owner = { email: "mansouralmailscores@gmail.com", email_confirmed_at: "2026-11-15T00:00:00Z" };
  it("allows only the verified specified main-admin account", () => {
    expect(canViewKuwaitAirways(owner, true)).toBe(true);
    expect(canViewKuwaitAirways({ ...owner, email: "another@example.com" }, true)).toBe(false);
  });
  it("does not treat an email match as admin permission", () => {
    expect(canViewKuwaitAirways(owner, false)).toBe(false);
  });
  it("hides from guests and unverified accounts", () => {
    expect(canViewKuwaitAirways(null, false)).toBe(false);
    expect(canViewKuwaitAirways({ email: owner.email }, true)).toBe(false);
  });
});