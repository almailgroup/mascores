import { describe, expect, it } from "vitest";
import { grantTeam, isSelectedGrant } from "./grant-selection";

describe("managed access reconciliation", () => {
  it("site-wide access has one null club target", () => { expect(grantTeam("all", "club-a")).toBeNull(); });
  it("changing club removes old club access rather than retaining both", () => { expect(isSelectedGrant({ scope: "rabta", team_id: "old-club" }, ["rabta"], "new-club")).toBe(false); });
  it("keeps the requested club access", () => { expect(isSelectedGrant({ scope: "club_news", team_id: "new-club" }, ["club_news"], "new-club")).toBe(true); });
});