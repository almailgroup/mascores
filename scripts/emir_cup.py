"""Audited 2025/2026 Emir Cup fixtures; no network or database writes.

The resumption report specifies December 4–5 for the semifinal stage, not
which tie occupies each day. Keep that window in bracket notes, not fake dates.
"""
import json
from pathlib import Path

COMPETITION_ID = "df990a0e-4afc-41c9-beb3-a9fcac0ebd12"
SEASON = "2025/2026"
RESULT_SOURCE = "https://en.wikipedia.org/wiki/2025%E2%80%9326_Kuwait_Emir_Cup"
SCHEDULE_SOURCE = "https://www.aljarida.com/article/148518"
TEAMS = {
    "Kuwait": "539cc6fb-d79a-449b-be23-1271355bd727",
    "Arabi": "598d82e7-8002-4423-9468-d58ec371907c",
    "Fahaheel": "073cfa17-037f-4b8b-a79a-aeb5dbee9a40",
    "Jahra": "91915327-7b03-4ccf-b968-52a1dae28a9f",
    "Nasr": "2986f4c3-8906-483b-b021-dae5ddf46c2a",
    "Qadsia": "8d6cb3fe-6e3d-4cdc-af60-ea9de938d174",
    "Sahel": "e834859a-a97d-47b8-88cc-6e58d04060e7",
    "Salmiya": "4f941a6e-7ce2-416e-b293-7f010c901415",
    "Shabab": "bc2e4358-851e-4dc2-a8aa-ee755c6dd447",
    "Tadamon": "666d9085-19bc-476a-a70a-e778d088eb23",
    "Yarmouk": "05925c38-07ac-40a1-8fa8-e81c7298ee18",
    "Burgan": "4ba35c2a-39ee-4dce-94ca-72273c1a5311",
    "Kazma": "a7166bc6-b129-47bb-bc4e-e085b1a2dfcd",
    "Khaitan": "8e369144-5cb6-4beb-9949-3187473b81d4",
    "Sulaibikhat": "e62bea24-9251-4e69-b03b-b0f3fae6618f",
    "Sporty": "707810f5-70e9-4906-87e5-6288089afb79",
    "Jazeera": "5ef202eb-daf0-49a1-b6dd-3c63e40df5de",
    "Shamiya": "bc724b72-7774-45a7-8af4-1ad5a0b51e01",
}


def fixture(stage, number, date, home, away, score=None, status="ft", penalties=None):
    if home == away or home not in TEAMS or away not in TEAMS:
        raise ValueError("Unresolved or duplicate club identity")
    if status not in ("ft", "aet", "pen", "scheduled"):
        raise ValueError("Unsupported match status")
    if status != "scheduled" and (score is None or min(score) < 0):
        raise ValueError("Completed match needs verified scores")
    if status == "scheduled" and (score is not None or penalties is not None):
        raise ValueError("Never invent upcoming results")
    if status == "pen" and (penalties is None or score[0] != score[1] or penalties[0] == penalties[1]):
        raise ValueError("Penalty decision needs tied match and shootout winner")
    return dict(round=stage, stage_order=number, round_number=None, kickoff_date=date, kickoff_at=None,
                home_team_id=TEAMS[home], away_team_id=TEAMS[away], status=status,
                home_score=score[0] if score else None, away_score=score[1] if score else None,
                home_pen=penalties[0] if penalties else None, away_pen=penalties[1] if penalties else None,
                source_url=SCHEDULE_SOURCE if status == "scheduled" else RESULT_SOURCE)


def audit():
    fixtures = [
        fixture("Qualification round 1", 1, "2026-01-26", "Sporty", "Shamiya", (2, 1)),
        fixture("Qualification round 2", 2, "2026-01-31", "Jazeera", "Sporty", (5, 1), "aet"),
        fixture("Round of 16", 3, "2026-02-12", "Fahaheel", "Shabab", (3, 2)),
        fixture("Round of 16", 3, "2026-02-12", "Nasr", "Yarmouk", (3, 2)),
        fixture("Round of 16", 3, "2026-02-13", "Tadamon", "Jahra", (1, 0), "aet"),
        fixture("Round of 16", 3, "2026-02-13", "Kazma", "Khaitan", (1, 1), "pen", (1, 3)),
        fixture("Round of 16", 3, "2026-02-14", "Salmiya", "Sulaibikhat", (2, 1)),
        fixture("Round of 16", 3, "2026-02-15", "Kuwait", "Jazeera", (3, 2)),
        fixture("Round of 16", 3, "2026-02-15", "Arabi", "Sahel", (2, 0)),
        fixture("Round of 16", 3, "2026-02-27", "Qadsia", "Burgan", (2, 0)),
        fixture("Quarter-finals", 4, "2026-02-27", "Kuwait", "Nasr", (3, 0)),
        fixture("Quarter-finals", 4, "2026-11-25", "Salmiya", "Tadamon", status="scheduled"),
        fixture("Quarter-finals", 4, "2026-11-26", "Qadsia", "Fahaheel", status="scheduled"),
        fixture("Quarter-finals", 4, "2026-11-26", "Arabi", "Khaitan", status="scheduled"),
    ]
    return dict(competition_id=COMPETITION_ID, season=SEASON, checked_on="2026-10-25",
                sources=[RESULT_SOURCE, SCHEDULE_SOURCE], teams=TEAMS, fixtures=fixtures,
                unresolved_bracket=[
                    dict(round="Semi-finals", home_team_id=TEAMS["Kuwait"], away_placeholder="Winner of Al Qadsia / Al Fahaheel", kickoff_date=None, note="Semi-finals scheduled for 4–5 December 2026; individual tie date and kickoff time to be confirmed.", pairing_source=SCHEDULE_SOURCE),
                    dict(round="Semi-finals", home_placeholder="Winner of Al Salmiya / Al Tadamon", away_placeholder="Winner of Al Arabi / Khaitan", kickoff_date=None, note="Semi-finals scheduled for 4–5 December 2026; remaining quarter-final winners. Individual tie date and kickoff time to be confirmed.", pairing_basis="Remaining quarter-final winners; not explicitly paired in the schedule report."),
                    dict(round="Final", home_placeholder="Winner of Semi-final 1", away_placeholder="Winner of Semi-final 2", kickoff_date=None, note="Date and kickoff time to be confirmed."),
                ], limitations="No fabricated participants, final date, kickoff times, lineups or player statistics. Unresolved semifinals/final live in bracket only until their clubs are known. Historic scores include extra time; shootout score stored separately. All clubs reused; no profiles created.")


if __name__ == "__main__":
    Path("scripts/emir-cup-import.json").write_text(json.dumps(audit(), ensure_ascii=False, indent=2) + "\n")
    print("Validated 14 fixtures, 18 existing clubs and 3 unresolved bracket ties")