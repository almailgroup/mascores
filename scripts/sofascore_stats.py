"""Parse public Sofascore page exports; never fetch or write the database."""
import re

LABELS = {
    "Ball possession": 0, "Total shots": 1, "Shots on target": 2,
    "Corner kicks": 3, "Offsides": 4, "Fouls": 5,
    "Yellow cards": 6, "Red cards": 7, "Saves": 8,
    "Passes": 9, "Pass accuracy": 10, "Tackles": 11,
    "Free kicks": 12, "Throw-ins": 13, "Goal kicks": 14,
}


def team_key(name):
    value = re.sub(r"\b(?:sc|fc|kuwait)\b", "", name.lower())
    value = re.sub(r"[^a-z]", "", value)
    return {"": "kuwait", "al": "kuwait", "alkuwait": "kuwait", "alsulaibikhat": "sulaibikhat",
            "tadhamon": "altadamon"}.get(value, value)


def parse_stats(markdown):
    """Accept explicit paired numbers only; reject impossible/sentinel values."""
    section = markdown.partition("Match overview\n\n")[2].partition("About the match")[0]
    rows, rejected = [], []
    if not section:
        return rows, rejected
    lines = [line.strip() for line in section.splitlines() if line.strip()]
    for i, label in enumerate(lines):
        if label not in LABELS or i == 0 or i + 1 >= len(lines):
            continue
        home, away = lines[i - 1], lines[i + 1]
        if not re.fullmatch(r"\d+(?:\.\d+)?%?", home) or not re.fullmatch(r"\d+(?:\.\d+)?%?", away):
            continue
        h, a = float(home.rstrip('%')), float(away.rstrip('%'))
        invalid = False
        if label in ("Ball possession", "Pass accuracy"):
            invalid = not (home.endswith('%') and away.endswith('%') and 0 <= h <= 100 and 0 <= a <= 100)
            if label == "Ball possession":
                invalid = invalid or abs(h + a - 100) > 1
        else:
            limit = {"Corner kicks": 40, "Red cards": 11, "Yellow cards": 30}.get(label, 1500)
            invalid = h > limit or a > limit or h != int(h) or a != int(a)
        if invalid:
            rejected.append({"label": label, "home": home, "away": away})
        else:
            rows.append({"label": label, "home": home, "away": away, "order": LABELS[label]})
    # Shots off target are intentionally not imported: competition aggregation
    # currently identifies all non-target 'shot' labels as total shots.
    # Do not invent Total shots by summing incomplete source components.
    return rows, rejected


def reconcile(markdown, fixtures):
    title = re.search(r"- # (.*?) vs (.*?) live score", markdown)
    round_match = re.search(r"Premier League, Round (\d+)", markdown)
    score = re.search(r"(\d+) \\- (\d+)\n\nFinished", markdown)
    if not title or not round_match or not score:
        return None
    h, a = map(team_key, title.groups())
    sh, sa = map(int, score.groups())
    candidates = []
    for fixture in fixtures:
        if fixture['status'] not in ('ft', 'aet', 'pen', 'awarded') or fixture['round_number'] != int(round_match.group(1)):
            continue
        fh, fa = team_key(fixture['home']), team_key(fixture['away'])
        if (fh, fa, fixture['home_score'], fixture['away_score']) == (h, a, sh, sa):
            candidates.append((fixture, False))
        elif (fh, fa, fixture['home_score'], fixture['away_score']) == (a, h, sa, sh):
            candidates.append((fixture, True))
    return candidates[0] if len(candidates) == 1 else None