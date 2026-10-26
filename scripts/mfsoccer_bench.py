"""Reproduce mfsoccer's displayed reserves, not official match-day sheets.

Inputs are downloaded separately. This module neither fetches nor writes a database.
"""
from datetime import datetime, timedelta, timezone


FANTASY_CLUBS = dict(zip(
    ["QAD", "KUW", "ARB", "KAZ", "SAL", "NSR", "SHB", "JAH", "FAH", "SAH", "TDM", "SLB"],
    ["القادسية", "الكويت", "العربي", "كاظمة", "السالمية", "النصر", "الشباب", "الجهراء", "الفحيحيل", "الساحل", "التضامن", "الصليبخات"],
))


def name_key(name):
    return " ".join((name or "").replace("ـ", "").split())


def displayed_bench(source, match, club, fantasy, now):
    """Apply source participation, match abs/pres, and recent fantasy exclusions."""
    played = {x["p"] for x in source["lineups"] if x.get("club") == club
              and x.get("r") == match["round"] and x.get("comp", "الدوري") == match.get("comp", "الدوري") and x.get("p")}
    for sub in source["subs"]:
        if sub.get("club") == club and sub.get("r") == match["round"] and sub.get("comp", "الدوري") == match.get("comp", "الدوري"):
            played.update(n for n in [sub.get("in"), sub.get("out")] if n)
    absent = {name_key(x.get("p")) for x in match.get("abs", []) if x.get("c") == club}
    present = {name_key(x.get("p")) for x in match.get("pres", []) if x.get("c") == club}
    # Historical import covers completed matches only. Source times are Kuwait local.
    kickoff = datetime.fromisoformat(match["date"] + "T" + (match.get("time") or "23:59")).replace(tzinfo=timezone(timedelta(hours=3)))
    recent = now - kickoff < timedelta(days=3)
    unavailable = {name_key(p.get("name")) for p in fantasy.get("players", {}).get("list", [])
                   if FANTASY_CLUBS.get(p.get("club")) == club and p.get("status") in {"i", "s", "n", "d"}}
    return [p for p in source["squads"].get(club, []) if p["n"] not in played
            and name_key(p["n"]) not in absent
            and (not recent or name_key(p["n"]) in present or name_key(p["n"]) not in unavailable)]