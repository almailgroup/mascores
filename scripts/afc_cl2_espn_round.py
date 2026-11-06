"""Build SQL to fill completed AFC Champions League Two fixtures from ESPN match sheets.

Usage: python3 scripts/afc_cl2_espn_round.py matches.json > /tmp/out.sql
matches.json: [{"id": <db match id>, "gid": <espn event id>, "home_team_id", "away_team_id",
                "players": {team_id: [[player_id, name], ...]}}]
Reuses identities from scripts/afc-champions-two-import.json (source athlete IDs), then exact
normalized names within the club squad; otherwise creates a new player profile.
Ratings are independent event-based estimates, never copied from the source.
"""
import json, sys, uuid, unicodedata, re, urllib.request, collections

PRIOR = json.load(open("scripts/afc-champions-two-import.json"))
SRC2PID = {l["source_player_id"]: l["player_id"] for l in PRIOR["lineups"] if l.get("source_player_id")}
for p in PRIOR["new_players"]:
    SRC2PID.setdefault(p["source_id"], p["id"])

def summary(gid):
    import os, time
    path = f"/tmp/espn-cache/{gid}.json"
    if os.path.exists(path):
        return json.load(open(path))
    os.makedirs("/tmp/espn-cache", exist_ok=True)
    time.sleep(1.5)
    data = _fetch(gid)
    json.dump(data, open(path, "w"))
    return data

def _fetch(gid):
    return json.load(urllib.request.urlopen(urllib.request.Request(f"https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event={gid}", headers={"User-Agent": "curl/8"})))

def build_posmap():
    pm = {}
    lu = collections.defaultdict(dict)
    for l in PRIOR["lineups"]:
        lu[l["match_id"]][l["source_player_id"]] = l["position_code"]
    for m in PRIOR["matches"]:
        s = summary(m["source_url"].split("/")[-1])
        for r in s["rosters"]:
            for p in r["roster"]:
                c = lu[m["id"]].get(p["athlete"]["id"])
                if p.get("starter") and c:
                    pm[(r.get("formation"), p.get("formationPlace"))] = c
    return pm

def norm(n):
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]", "", n.replace("al-", "al"))

def q(v):
    if v is None: return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def clock(e):
    d = e["clock"]["displayValue"].replace("'", "")
    if "+" in d:
        a, b = d.split("+"); return int(a), int(b)
    return int(d or 0), None

STATS = [("possessionPct", "Possession", "%"), ("totalShots", "Total shots", ""), ("shotsOnTarget", "Shots on target", ""),
         ("wonCorners", "Corner kicks", ""), ("foulsCommitted", "Fouls", ""), ("offsides", "Offsides", ""),
         ("yellowCards", "Yellow cards", ""), ("redCards", "Red cards", ""), ("saves", "Saves", ""),
         ("accuratePasses", "Accurate passes", ""), ("totalPasses", "Total passes", ""), ("blockedShots", "Blocked shots", ""),
         ("totalTackles", "Tackles", ""), ("totalClearance", "Clearances", "")]

def main():
    jobs = json.load(open(sys.argv[1]))
    posmap = build_posmap()
    out, audit = ["begin;"], []
    for j in jobs:
        s = summary(j["gid"])
        comp = s["header"]["competitions"][0]
        if comp["status"]["type"]["name"] != "STATUS_FULL_TIME":
            audit.append(f"skip {j['id']} not final"); continue
        side = {}; score = {}; form = {}
        for c in comp["competitors"]:
            t = j["home_team_id"] if c["homeAway"] == "home" else j["away_team_id"]
            side[c["team"]["id"]] = t; score[c["homeAway"]] = int(c["score"])
        mid = j["id"]
        squad = {t: {norm(n): pid for pid, n in j["players"].get(t, [])} for t in (j["home_team_id"], j["away_team_id"])}
        ath = {}
        played = set(); starters = set()
        out.append(f"update matches set alerts_muted=true where id={q(mid)};")
        out.append(f"delete from match_events where match_id={q(mid)}; delete from match_lineups where match_id={q(mid)}; delete from match_stats where match_id={q(mid)}; delete from player_ratings where match_id={q(mid)};")
        for r in s["rosters"]:
            t = side[r["team"]["id"]]; f = r.get("formation"); form[t] = f
            for p in r["roster"]:
                a = p["athlete"]; sid = a["id"]; nm = a["displayName"]
                pid = SRC2PID.get(sid) or squad[t].get(norm(nm))
                if not pid:
                    pid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"espn-athlete-{sid}"))
                    pos = (p.get("position") or {}).get("displayName")
                    out.append(f"insert into players (id, team_id, name, position, shirt_number) values ({q(pid)},{q(t)},{q(nm)},{q(pos)},{q(int(p['jersey']) if p.get('jersey','').isdigit() else None)}) on conflict (id) do nothing;")
                    audit.append(f"new player {nm} ({sid}) team {t}")
                SRC2PID[sid] = pid; ath[sid] = (pid, t)
                code = posmap.get((f, p.get("formationPlace"))) if p.get("starter") else None
                if p.get("starter") and not code: audit.append(f"no position map {f} {p.get('formationPlace')}")
                if p.get("starter"): starters.add(pid); played.add(pid)
                if p.get("subbedIn"): played.add(pid)
                out.append(f"insert into match_lineups (match_id, team_id, player_id, is_starting, shirt_number, position_code) values ({q(mid)},{q(t)},{q(pid)},{q(bool(p.get('starter')))},{q(int(p['jersey']) if p.get('jersey','').isdigit() else None)},{q(code)});")
        pts = collections.Counter()
        for e in s.get("keyEvents", []):
            ty = e["type"]["type"]; txt = e.get("text", "")
            parts = [ath.get(x["athlete"]["id"], (None, None))[0] for x in e.get("participants", [])]
            t = side.get((e.get("team") or {}).get("id"))
            mn, ex = clock(e)
            if e.get("shootout"): continue
            if ty == "substitution":
                kind, p1, other = "substitution", parts[0] if parts else None, parts[1] if len(parts) > 1 else None
                out.append(f"insert into match_events (match_id, team_id, type, minute, extra, player_id, sub_out_player_id) values ({q(mid)},{q(t)},'substitution',{mn},{q(ex)},{q(p1)},{q(other)});"); continue
            if ty == "yellow-card": kind = "yellow"
            elif ty in ("red-card", "yellow-red-card") or "Red Card" in txt: kind = "red"
            elif "own" in ty or "Own Goal" in txt: kind = "own_goal"
            elif e.get("scoringPlay") and "enalty" in (ty + txt): kind = "penalty_goal"
            elif e.get("scoringPlay") or ty == "goal": kind = "goal"
            elif "enalty" in ty and ("miss" in ty or "saved" in ty): kind = "penalty_miss"
            else:
                audit.append(f"ignored event {ty} {txt[:60]}"); continue
            p1 = parts[0] if parts else None; ast = parts[1] if kind == "goal" and len(parts) > 1 else None
            out.append(f"insert into match_events (match_id, team_id, type, minute, extra, player_id, assist_player_id) values ({q(mid)},{q(t)},{q(kind)},{mn},{q(ex)},{q(p1)},{q(ast)});")
            if p1:
                pts[p1] += {"goal": 1.0, "penalty_goal": 0.8, "own_goal": -0.8, "yellow": -0.3, "red": -1.2, "penalty_miss": -0.7}[kind]
            if ast: pts[ast] += 0.6
        bt = {}
        for c in s["boxscore"]["teams"]:
            bt[side[c["team"]["id"]]] = {x["name"]: x["displayValue"] for x in c["statistics"]}
        h, a = bt.get(j["home_team_id"], {}), bt.get(j["away_team_id"], {})
        for i, (k, label, suf) in enumerate(STATS):
            if k in h and k in a and h[k] != "" and a[k] != "":
                out.append(f"insert into match_stats (match_id, label, home_value, away_value, sort_order) values ({q(mid)},{q(label)},{q(h[k]+suf)},{q(a[k]+suf)},{i});")
        hs, as_ = score["home"], score["away"]
        res = {j["home_team_id"]: hs - as_, j["away_team_id"]: as_ - hs}
        conceded = {j["home_team_id"]: as_, j["away_team_id"]: hs}
        for sid, (pid, t) in ath.items():
            if pid not in played: continue
            r = (6.6 if pid in starters else 6.3) + pts[pid] + (0.3 if res[t] > 0 else -0.2 if res[t] < 0 else 0)
            if conceded[t] == 0 and pid in starters: r += 0.3
            r -= 0.1 * max(conceded[t] - 1, 0)
            r = round(min(9.6, max(4.5, r)), 1)
            out.append(f"insert into player_ratings (player_id, match_id, competition_id, rating) select {q(pid)},{q(mid)},competition_id,{r} from matches where id={q(mid)};")
        ko = comp.get("date")
        out.append(f"update matches set home_score={hs}, away_score={as_}, status='ft', period=null, timer_running=false, live_minute=null, kickoff_at=coalesce({q(ko)}::timestamptz, kickoff_at), completed_at=coalesce(completed_at, {q(ko)}::timestamptz + interval '115 minutes'), home_formation={q(form.get(j['home_team_id']))}, away_formation={q(form.get(j['away_team_id']))}, lineups_published=true, lineup_mode='formation' where id={q(mid)};")
        out.append(f"update matches set alerts_muted=false where id={q(mid)};")
    out.append("commit;")
    print("\n".join(out))
    print("\n".join(audit), file=sys.stderr)

if __name__ == "__main__":
    main()
