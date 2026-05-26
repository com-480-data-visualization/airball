import pandas as pd
import numpy as np
import json
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, "data")
if not os.path.isdir(DATA_DIR):
    DATA_DIR = os.path.join(ROOT_DIR, "archive")
OUT_DIR  = os.path.join(ROOT_DIR, "js")
os.makedirs(OUT_DIR, exist_ok=True)

def save_json(obj, filename):
    path = os.path.join(OUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  ✓ {filename} saved ({os.path.getsize(path)//1024} KB)")

print("Loading CSV files...")
per_game = pd.read_csv(f"{DATA_DIR}/Player Per Game.csv")
advanced = pd.read_csv(f"{DATA_DIR}/Advanced.csv")
teams    = pd.read_csv(f"{DATA_DIR}/Team Summaries.csv")
teams_pg = pd.read_csv(f"{DATA_DIR}/Team Stats Per Game.csv")
print(f"  per_game: {len(per_game):,} rows | advanced: {len(advanced):,} | teams: {len(teams):,}")

print("\nCleaning data...")

# Keep NBA only (exclude ABA and BAA historical leagues)
per_game = per_game[per_game["lg"] == "NBA"].copy()
advanced = advanced[advanced["lg"] == "NBA"].copy()
teams    = teams[teams["lg"] == "NBA"].copy()
teams_pg = teams_pg[teams_pg["lg"] == "NBA"].copy()

# Remove mid-season trade duplicates. Basketball-Reference aggregate rows can be
# labelled "TOT" or "2TM"/"3TM"; keep that season-total row and drop individual
# team rows for the same player-season.
def dedup_trades(df):
    df = df.copy()
    df["_is_total_row"] = df["team"].astype(str).str.fullmatch(r"TOT|\d+TM")
    has_total = df[df["_is_total_row"]][["season", "player_id"]].drop_duplicates()
    has_total["_keep_total"] = True
    df = df.merge(has_total, on=["season", "player_id"], how="left")
    df = df[~((df["_keep_total"] == True) & ~df["_is_total_row"])]
    df = df.drop(columns=["_keep_total", "_is_total_row"])
    return df

per_game = dedup_trades(per_game)
advanced = dedup_trades(advanced)

# Quality filter: at least 10 games played and 10 minutes per game
per_game = per_game[(per_game["g"] >= 10) & (per_game["mp_per_game"] >= 10)]
advanced = advanced[(advanced["g"] >= 10) & (advanced["mp"] / advanced["g"] >= 10)]

print(f"  After cleaning — per_game: {len(per_game):,} | advanced: {len(advanced):,}")

# Merge per-game and advanced stats on season + player_id
players = per_game.merge(
    advanced[["season", "player_id", "per", "ts_percent", "usg_percent",
              "vorp", "bpm", "obpm", "dbpm", "ws", "ws_48"]],
    on=["season", "player_id"],
    how="left",
    suffixes=("", "_adv")
)
# ts_percent exists in both files — prefer the advanced version when available
if "ts_percent_adv" in players.columns:
    players["ts_percent"] = players["ts_percent_adv"].fillna(players["ts_percent"])
    players.drop(columns=["ts_percent_adv"], inplace=True)


# ═══════════════════════════════════════════════════════════════════════════════
# ACT 1 — The 3-Point Revolution
# Data: average 3PA per team per season + pace + TS%
# ═══════════════════════════════════════════════════════════════════════════════
print("\nACT 1 — 3-point revolution...")

# Aggregate by season: average across all teams (one value per season)
act1_teams = (
    teams_pg[teams_pg["season"] >= 1980]
    .groupby("season")
    .agg(x3pa_per_game=("x3pa_per_game", "mean"))
    .reset_index()
)

act1_pace = (
    teams[teams["season"] >= 1980]
    .groupby("season")
    .agg(pace=("pace", "mean"), ts_percent=("ts_percent", "mean"))
    .reset_index()
)

act1 = act1_teams.merge(act1_pace, on="season")
act1 = act1.round(2)

# Key narrative annotations — the turning points of the 3-point story
annotations = [
    {"season": 1980, "label": "3-point line adopted"},
    {"season": 1995, "label": "Arc shortened temporarily"},
    {"season": 1997, "label": "Arc restored to original distance"},
    {"season": 2012, "label": "Analytics revolution (Morey)"},
    {"season": 2016, "label": "Warriors make 3s a system"},
    {"season": 2024, "label": "35+ attempts/game new normal"},
]

act1_json = {
    "seasons":     act1["season"].tolist(),
    "x3pa":        act1["x3pa_per_game"].tolist(),
    "pace":        act1["pace"].tolist(),
    "ts":          (act1["ts_percent"] * 100).round(1).tolist(),
    "annotations": annotations
}

save_json(act1_json, "act1_revolution.json")


# ═══════════════════════════════════════════════════════════════════════════════
# ACT 2 — Era Explorer (Bubble Chart)
# Data: top players per season with Usage Rate, TS%, MPG, position
# ═══════════════════════════════════════════════════════════════════════════════
print("\nACT 2 — Era Explorer...")

act2_cols = ["season", "player", "pos", "g", "mp_per_game",
             "pts_per_game", "usg_percent", "ts_percent", "vorp", "bpm"]

act2 = players[act2_cols].copy()
act2 = act2.dropna(subset=["usg_percent", "ts_percent"])

# Simplify position: keep only the primary position (e.g. "PG-SG" -> "PG")
act2["pos"] = act2["pos"].str.split("-").str[0]
act2 = act2[act2["pos"].isin(["PG", "SG", "SF", "PF", "C"])]

# Keep top 30 players per season ranked by minutes played
act2 = (act2.sort_values("mp_per_game", ascending=False)
            .groupby("season")
            .head(30)
            .reset_index(drop=True))

# Round all values for clean JSON output
act2["ts_percent"]   = (act2["ts_percent"] * 100).round(1)
act2["usg_percent"]  = act2["usg_percent"].round(1)
act2["mp_per_game"]  = act2["mp_per_game"].round(1)
act2["pts_per_game"] = act2["pts_per_game"].round(1)
act2["vorp"]         = act2["vorp"].round(2)
act2["bpm"]          = act2["bpm"].round(2)

# Output as a dict keyed by season for fast lookup in JS
act2_json = {}
for season, group in act2.groupby("season"):
    act2_json[int(season)] = group.drop(columns="season").to_dict(orient="records")

save_json(act2_json, "act2_bubbles.json")


# ═══════════════════════════════════════════════════════════════════════════════
# ACT 3 — Player Comparison (Radar Chart)
# Data: normalized career stats for all searchable players
# ═══════════════════════════════════════════════════════════════════════════════
print("\nACT 3 — Player comparison...")

RADAR_METRICS = ["pts_per_game", "trb_per_game", "ast_per_game",
                 "ts_percent", "ws_48", "bpm", "vorp", "per"]

# Aggregate career stats per player using games-played weighted average
career = players.copy()
career = career.dropna(subset=RADAR_METRICS)

def weighted_mean(group, col, weight_col="g"):
    w = group[weight_col]
    return (group[col] * w).sum() / w.sum()

career_agg = {}
for player_id, grp in career.groupby("player_id"):
    name = grp["player"].iloc[0]
    pos  = grp["pos"].iloc[0].split("-")[0]
    seasons_played = sorted(grp["season"].tolist())
    stats = {}
    for m in RADAR_METRICS:
        stats[m] = round(weighted_mean(grp, m), 2)
    stats["ts_percent"] = round(stats["ts_percent"] * 100, 1)
    career_agg[player_id] = {
        "name":    name,
        "pos":     pos,
        "seasons": seasons_played,
        "stats":   stats
    }

# Normalize each metric to 0-100 using the 5th-95th percentile range
# so outliers don't skew the radar chart
all_stats = {m: [v["stats"][m] for v in career_agg.values()] for m in RADAR_METRICS}
stat_min  = {m: np.percentile(all_stats[m], 5)  for m in RADAR_METRICS}
stat_max  = {m: np.percentile(all_stats[m], 95) for m in RADAR_METRICS}

for pid in career_agg:
    normalized = {}
    for m in RADAR_METRICS:
        raw = career_agg[pid]["stats"][m]
        mn, mx = stat_min[m], stat_max[m]
        normalized[m] = round(min(100, max(0, (raw - mn) / (mx - mn) * 100)), 1)
    career_agg[pid]["normalized"] = normalized

# Only keep players with at least 3 seasons of data
career_agg = {pid: v for pid, v in career_agg.items() if len(v["seasons"]) >= 3}

# Flat search list for the player search input in the UI
search_list = [
    {"id": pid, "name": v["name"], "pos": v["pos"],
     "seasons": f"{v['seasons'][0]}-{v['seasons'][-1]}"}
    for pid, v in career_agg.items()
]
search_list.sort(key=lambda x: x["name"])

act3_json = {
    "players": career_agg,
    "search":  search_list,
    "metrics": RADAR_METRICS,
    "labels":  ["PTS", "REB", "AST", "TS%", "WS/48", "BPM", "VORP", "PER"]
}

save_json(act3_json, "act3_players.json")


# ═══════════════════════════════════════════════════════════════════════════════
# ACT 4 — Dynasties
# Data: win% per season for the 6 greatest franchises in NBA history
# ═══════════════════════════════════════════════════════════════════════════════
print("\nACT 4 — Dynasties...")

teams["win_pct"] = (teams["w"] / (teams["w"] + teams["l"])).round(3)

# The 6 dynasty franchises and their short names
dynasty_map = {
    "Chicago Bulls":         "Bulls",
    "Los Angeles Lakers":    "Lakers",
    "San Antonio Spurs":     "Spurs",
    "Miami Heat":            "Heat",
    "Golden State Warriors": "Warriors",
    "Boston Celtics":        "Celtics",
}

# Colors chosen to be visually distinct and match the site's palette
dynasty_colors = {
    "Bulls":    "#e8621a",   # orange 
    "Lakers":   "#ab47bc",   # purple
    "Spurs":    "#4fc3f7",   # light blue
    "Heat":     "#ef5350",   # red
    "Warriors": "#1d6fe8",   # dark blue 
    "Celtics":  "#66bb6a",   # green
}

act4_json = {}
for full_name, short in dynasty_map.items():
    df = (teams[(teams["team"] == full_name) & (teams["season"] >= 1990)]
          .sort_values("season"))
    act4_json[short] = {
        "color":   dynasty_colors[short],
        "seasons": df["season"].tolist(),
        "wins":    df["win_pct"].tolist(),
    }
    peak_season = df.loc[df["win_pct"].idxmax(), "season"]
    peak_pct    = df["win_pct"].max()
    print(f"  {short}: {len(df)} seasons · peak {peak_pct:.1%} in {peak_season}")

save_json(act4_json, "act4_dynasties.json")


# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
print("\nDone! JSON files generated in js/:")
for f in sorted(os.listdir(OUT_DIR)):
    if f.endswith(".json"):
        size = os.path.getsize(os.path.join(OUT_DIR, f)) // 1024
        print(f"   {f} ({size} KB)")
print("\nNext step: open website/index.html in your browser.")
