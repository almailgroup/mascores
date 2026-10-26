"""Build an auditable, idempotent import from Sportscorner's public youth feeds.

No network or database writes are performed by this script. SQL output is reviewed
and applied through the managed data tool. Original source data stays in /tmp.
"""
import argparse
import json
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

LEAGUES = {
    17: "e9d566e0-03fc-41ef-bed0-445b2a873a01",
    19: "8afcb9a7-0547-467f-839a-ab60a55ea67d",
}
# Explicit identities, never fuzzy-match a youth club to its senior match side.
PARENTS = {
    "العربي": "598d82e7-8002-4423-9468-d58ec371907c",
    "الفحيحيل": "073cfa17-037f-4b8b-a79a-aeb5dbee9a40",
    "الجهراء": "91915327-7b03-4ccf-b968-52a1dae28a9f",
    "النصر": "2986f4c3-8906-483b-b021-dae5ddf46c2a",
    "القادسية": "8d6cb3fe-6e3d-4cdc-af60-ea9de938d174",
    "الساحل": "e834859a-a97d-47b8-88cc-6e58d04060e7",
    "السالمية": "4f941a6e-7ce2-416e-b293-7f010c901415",
    "الشباب": "bc2e4358-851e-4dc2-a8aa-ee755c6dd447",
    "التضامن": "666d9085-19bc-476a-a70a-e778d088eb23",
    "اليرموك": "05925c38-07ac-40a1-8fa8-e81c7298ee18",
    "برقان": "4ba35c2a-39ee-4dce-94ca-72273c1a5311",
    "كاظمة": "a7166bc6-b129-47bb-bc4e-e085b1a2dfcd",
    "خيطان": "8e369144-5cb6-4beb-9949-3187473b81d4",
    "الكويت": "539cc6fb-d79a-449b-be23-1271355bd727",
    "سبورتي": "707810f5-70e9-4906-87e5-6288089afb79",
    "الصليبيخات": "e62bea24-9251-4e69-b03b-b0f3fae6618f",
}
VENUES = {
    "استاد جابر الفرعي (1)": ("Jaber Training Stadium 1", "4dbaf34f-85a4-4dcc-b9e0-b9edc241243a"),
    "الصداقة والسلام": ("Al Sadaqua Walsalam Stadium", "5d845fe5-afdd-49af-b8ff-238b5cd3e1d9"),
    "ثامر": ("Thamir Stadium", "f3bf5946-8b9a-45b3-9f45-ffb7d32c619a"),
    "صباح السالم": ("Sabah Al Salem Stadium", "5d317957-0820-4724-95ab-6a3a754d1ae4"),
    "علي صباح السالم": ("Ali Sabah Al Salem", "bf0ed1bf-7308-4491-ab17-fa1676b0321f"),
    "محمد الحمد": ("Mohammed Al Hamad Stadium", "8d3e0456-d0ba-4267-9944-824046998885"),
    "ناصر العصيمي": ("Nasser Al Ossami Stadium", "7d7965a5-9ae6-4a3b-bcc7-9f7ed75cd46e"),
    "نايف الدبوس": ("Nayef Al Dabbous Stadium", "4f719217-97f9-466a-8ce1-8665716c41f0"),
    "التضامن": ("Al Tadamon Ground", None),
    "الساحل": ("Al Sahel Ground", None),
    "الشباب": ("Al Shabab Ground", None),
}
GROUND_NAMES = {"الساحل": "Al Sahel", "السالمية": "Al Salmiya", "القادسية": "Al Qadsia", "الكويت": "Kuwait SC", "النصر": "Al Nasr", "اليرموك": "Al Yarmouk", "خيطان": "Khaitan", "كاظمة": "Kazma"}


def venue_of(raw):
    if not raw:
        return None, None
    raw = raw.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")).strip()
    if raw.endswith("2"):
        club = raw[:-1].strip()
        return f"{GROUND_NAMES[club]} Ground 2", None
    return VENUES[raw]


def normalize_fixture(raw, age):
    if raw["seasonName"] != "2026/2027" or raw.get("isHidden") or raw.get("isDraft"):
        raise ValueError("Unexpected season or unpublished fixture")
    state = {"Finished": "ft", "Scheduled": "scheduled"}[raw["status"]]
    home = PARENTS[raw["homeTeamName"].strip()]
    away = PARENTS[raw["awayTeamName"].strip()]
    if home == away:
        raise ValueError("Both sides resolved to one club")
    hs, aws = raw.get("homeScore"), raw.get("awayScore")
    if state == "ft" and (not isinstance(hs, int) or not isinstance(aws, int) or min(hs, aws) < 0):
        raise ValueError("Finished fixture lacks a valid score")
    date = datetime.fromisoformat(raw["matchDate"].replace("Z", "+00:00"))
    venue, venue_id = venue_of(raw.get("venueName"))
    return {
        "source_id": raw["id"], "competition_id": LEAGUES[age], "age": age,
        "round_number": raw["matchday"], "home_parent": home, "away_parent": away,
        "kickoff_at": None if raw.get("kickoffTimeUnknown") else raw["matchDate"],
        "kickoff_date": date.astimezone(ZoneInfo("Asia/Kuwait")).date().isoformat(),
        "status": state, "home_score": hs if state == "ft" else None,
        "away_score": aws if state == "ft" else None, "venue": venue, "venue_id": venue_id,
        "source_url": f"https://www.sportscornerkw.com/matches/{raw['id']}",
    }


def build_audit(root):
    fixtures, clubs, standings = [], [], []
    for age in (17, 19):
        path = root / (f"u{age}-raw-fixtures.json" if age == 19 else f"u{age}-fixtures.json")
        rows = json.loads(path.read_text())
        fixtures.extend(normalize_fixture(row, age) for row in rows)
        for team in json.loads((root / f"u{age}-teams.json").read_text()):
            clubs.append({"age": age, "competition_id": LEAGUES[age], "parent_team_id": PARENTS[team["name"].strip()], "source_id": team["teamId"], "name_ar": f"{team['name'].strip()} تحت {age} سنة"})
        standings.append({"age": age, "entries": json.loads((root / f"u{age}-standings.json").read_text())["entries"]})
    keys = [(f["age"], f["round_number"], f["home_parent"], f["away_parent"]) for f in fixtures]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate fixture identity")
    return {"source": "sportscornerkw.com", "season": "2026/2027", "checked_on": "2026-10-25", "scope": "All published source fixtures: U17 rounds 1–15; U19 rounds 1–6. No source lineups, scorers, assists, discipline or ratings available in league statistics.", "clubs": clubs, "fixtures": fixtures, "source_standings": standings}


def fixture_sql(fixtures):
    payload = json.dumps(fixtures, ensure_ascii=False, separators=(",", ":"))
    return f"""WITH source AS (
 SELECT * FROM jsonb_to_recordset($data${payload}$data$::jsonb) AS s(source_id int, competition_id uuid, age int, round_number int, home_parent uuid, away_parent uuid, kickoff_at timestamptz, kickoff_date date, status text, home_score int, away_score int, venue text, venue_id uuid, source_url text)
), resolved AS (
 SELECT s.*, h.id home_id, a.id away_id FROM source s
 JOIN teams h ON h.parent_team_id=s.home_parent AND h.age_group='U'||s.age
 JOIN teams a ON a.parent_team_id=s.away_parent AND a.age_group='U'||s.age
)
INSERT INTO matches(competition_id,season,round,round_number,home_team_id,away_team_id,kickoff_at,kickoff_date,status,home_score,away_score,venue,venue_id,result_only,alerts_muted)
SELECT competition_id,'2026/2027','Round '||round_number,round_number,home_id,away_id,kickoff_at,kickoff_date,status,home_score,away_score,venue,venue_id,true,false FROM resolved r
WHERE NOT EXISTS (SELECT 1 FROM matches m WHERE m.competition_id=r.competition_id AND m.season='2026/2027' AND coalesce(m.round_number,substring(m.round from '[0-9]+')::int)=r.round_number AND ((m.home_team_id=r.home_id AND m.away_team_id=r.away_id) OR (m.home_team_id=r.away_id AND m.away_team_id=r.home_id)));
"""


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--sql-dir", type=Path, required=True)
    args = parser.parse_args()
    audit = build_audit(args.source)
    args.audit.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n")
    args.sql_dir.mkdir(parents=True, exist_ok=True)
    for age in (17, 19):
        (args.sql_dir / f"u{age}.sql").write_text(fixture_sql([f for f in audit["fixtures"] if f["age"] == age]))
    print(f"Validated {len(audit['fixtures'])} fixtures and {len(audit['clubs'])} youth identities")