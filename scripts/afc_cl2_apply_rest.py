"""Apply SQL produced by afc_cl2_espn_round.py through the REST API (service role, sandbox only).
Usage: python3 scripts/afc_cl2_apply_rest.py /tmp/out.sql"""
import json, os, re, sys, urllib.request, urllib.error
from datetime import datetime, timedelta

URL = os.environ["SUPABASE_URL"] + "/rest/v1/"
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json", "Prefer": "return=minimal"}

def req(method, path, body=None, extra=None):
    h = dict(H); h.update(extra or {})
    r = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp: return resp.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path[:80]} -> {e.code} {e.read()[:500]}")

def v(x):
    x = x.strip()
    if x == "null": return None
    if x.startswith("'"): return x[1:-1].replace("''", "'")
    if x in ("true", "false"): return x == "true"
    return float(x) if "." in x else int(x)

def vals(st): return [v(t) for t in re.findall(r"'(?:[^']|'')*'|[^,]+", st)]

P, L, E, S, R, M = [], [], [], [], [], {}
for st in re.split(r";\s*\n|;\s+(?=delete|insert|update)", open(sys.argv[1]).read()):
    st = st.strip()
    if st.startswith("insert into players"):
        a = vals(re.search(r"values \((.*)\) on conflict", st).group(1))
        P.append(dict(zip(["id", "team_id", "name", "position", "shirt_number"], a)))
    elif st.startswith("insert into match_lineups"):
        L.append(dict(zip(["match_id", "team_id", "player_id", "is_starting", "shirt_number", "position_code"], vals(re.search(r"values \((.*)\)$", st).group(1)))))
    elif st.startswith("insert into match_events"):
        cols = re.search(r"match_events \((.*?)\)", st).group(1).split(", ")
        d = dict(zip(cols, vals(re.search(r"values \((.*)\)$", st).group(1))))
        d.setdefault("assist_player_id", None); d.setdefault("sub_out_player_id", None); E.append(d)
    elif st.startswith("insert into match_stats"):
        S.append(dict(zip(["match_id", "label", "home_value", "away_value", "sort_order"], vals(re.search(r"values \((.*)\)$", st).group(1)))))
    elif st.startswith("insert into player_ratings"):
        a = vals(re.search(r"select (.*) from matches", st).group(1)); R.append({"player_id": a[0], "match_id": a[1], "rating": a[3]})
    elif st.startswith("update matches set home_score"):
        mid = re.search(r"where id='([^']+)'", st).group(1)
        g = lambda k: (re.search(k + r"=('(?:[^']|'')*'|[^,\s]+)", st) or [None, "null"])[1]
        ko = re.search(r"coalesce\('([^']+)'::timestamptz, kickoff_at\)", st)
        base = ko.group(1) if ko else re.search(r"coalesce\(completed_at, '([^']+)'", st).group(1)
        M[mid] = {"hs": int(g("home_score")), "as": int(g("away_score")), "ko": base, "setko": bool(ko),
                  "hf": v(g("home_formation")), "af": v(g("away_formation")), "mode": v(g("lineup_mode"))}

comp = {}
for mid in M:
    comp[mid] = json.loads(req("GET", f"matches?id=eq.{mid}&select=competition_id,completed_at", extra={"Prefer": ""}))[0]
    req("PATCH", f"matches?id=eq.{mid}", {"alerts_muted": True})
if P:
    req("POST", "players?on_conflict=id", P, {"Prefer": "resolution=ignore-duplicates,return=minimal"})
full = [m for m, x in M.items() if x["mode"] is not None]
if full:
    for t in ("match_events", "match_lineups", "match_stats", "player_ratings"):
        req("DELETE", f"{t}?match_id=in.({','.join(full)})")
for t, rows in (("match_lineups", L), ("match_events", E), ("match_stats", S)):
    if rows: req("POST", t, rows)
for r in R: r["competition_id"] = comp[r["match_id"]]["competition_id"]
if R: req("POST", "player_ratings", R)
for mid, m in M.items():
    ko = datetime.fromisoformat(m["ko"].replace("Z", "+00:00"))
    body = {"home_score": m["hs"], "away_score": m["as"], "status": "ft", "period": None, "timer_running": False, "live_minute": None}
    if not comp[mid]["completed_at"]: body["completed_at"] = (ko + timedelta(minutes=115)).isoformat()
    if m["setko"]: body["kickoff_at"] = ko.isoformat()
    if m["mode"] is not None:
        body.update({"home_formation": m["hf"], "away_formation": m["af"], "lineups_published": True, "lineup_mode": m["mode"]})
    req("PATCH", f"matches?id=eq.{mid}", body)
    req("PATCH", f"matches?id=eq.{mid}", {"alerts_muted": False})
print("applied", len(M), "matches", len(P), "players", len(L), "lineups", len(E), "events", len(S), "stats", len(R), "ratings")
