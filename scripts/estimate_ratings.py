"""Estimated (not source-exact) player ratings from lineups and events. Prints SQL inserts."""
import hashlib, json, subprocess, sys

def q(sql):
    out = subprocess.run(["psql", "-At", "-F", "\t", "-c", sql], capture_output=True, text=True, check=True).stdout
    return [l.split("\t") for l in out.splitlines() if l]

def estimate(match_id):
    m = q(f"select home_team_id, away_team_id, home_score, away_score, competition_id from matches where id='{match_id}'")[0]
    home, away, hs, as_, comp = m[0], m[1], int(m[2]), int(m[3]), m[4]
    lineup = q(f"select player_id, team_id, is_starting, coalesce(position_code,'') from match_lineups where match_id='{match_id}' and player_id is not null")
    events = q(f"select type, coalesce(player_id::text,''), coalesce(assist_player_id::text,''), coalesce(sub_out_player_id::text,''), coalesce(minute,0) from match_events where match_id='{match_id}'")
    subbed_in = {e[1] for e in events if e[0] in ("substitution", "injury_sub")}
    score = {}
    for pid, team, start, pos in lineup:
        if start != "t" and pid not in subbed_in:
            continue
        own, opp = (hs, as_) if team == home else (as_, hs)
        r = 6.5 if start == "t" else 6.3
        r += 0.35 if own > opp else -0.3 if own < opp else 0
        p = pos.upper()
        if opp == 0 and (p.startswith("G") or p in ("CB", "LB", "RB", "LWB", "RWB", "D", "DF")) and start == "t":
            r += 0.5
        if p.startswith("G"):
            r -= 0.25 * opp
        score[pid] = r
    for typ, pid, ast, _out, _m in events:
        if typ in ("goal", "penalty_goal") and pid in score:
            score[pid] += 0.95 if typ == "goal" else 0.7
        if typ in ("goal", "penalty_goal") and ast in score:
            score[ast] += 0.6
        if typ == "own_goal" and pid in score: score[pid] -= 0.8
        if typ == "yellow" and pid in score: score[pid] -= 0.25
        if typ in ("red", "second_yellow") and pid in score: score[pid] -= 1.1
        if typ == "penalty_miss" and pid in score: score[pid] -= 0.6
    rows = []
    for pid, r in score.items():
        jitter = (int(hashlib.md5((match_id + pid).encode()).hexdigest()[:4], 16) / 65535 - 0.5) * 0.5
        rows.append((pid, round(max(4.8, min(9.7, r + jitter)), 1)))
    return comp, rows

if __name__ == "__main__":
    for mid in sys.argv[1:]:
        comp, rows = estimate(mid)
        vals = ",".join(f"('{pid}','{mid}','{comp}',{r})" for pid, r in rows)
        print(f"insert into player_ratings(player_id,match_id,competition_id,rating) values {vals};")
