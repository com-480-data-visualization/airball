# 🏀 Airball — 78 Years of Basketball, One Story

**An interactive data story about the NBA's structural transformation, 1946–2026.**

[**▶ Live site**](https://com-480-data-visualization.github.io/airball/website/index.html) · [Process book](./reports/Milestone%203/process_book.pdf) · [Screencast script](./reports/Milestone%203/screencast_script.md)

COM-480 Data Visualization Project · EPFL · Spring 2026

| Student | SCIPER |
| --- | --- |
| Elias Mir | 341277 |
| Michael Freeman | 313215 |
| Yassine Mamlouk | 327081 |
| Aziz Laadhar | 315196 |

---

## What this is

Most fans see the NBA through box scores and highlight reels — they never see the macro-level patterns that have reshaped the game. **Airball** is a four-act scrollytelling experience that makes those structural shifts visible:

1. **Act I — The Revolution.** The 3-point shot's journey from gimmick to system, 1980–2026.
2. **Act II — Era Explorer.** Every player-season as a bubble. Drag through 45 seasons of NBA history.
3. **Act III — Player vs Player.** Era-normalized radar comparisons — Jordan vs Jokic, fairly.
4. **Act IV — Dynasties.** Six franchises that defined modern basketball, with championship markers.

**Target audience:** sports enthusiasts and data-curious readers — no analytics background required.

---

## Technical setup

The site is a static SPA. No build step, no framework, no bundler. Just open `website/index.html`.

### Stack

| Layer | Tool |
| --- | --- |
| Visualization | **D3.js v7** (all four acts) |
| Styling | Hand-written CSS (custom properties, CSS grid, media queries) |
| Data prep | **pandas** + **numpy** (Python, one-shot script) |
| Hosting | GitHub Pages |

### Run locally

```bash
git clone https://github.com/com-480-data-visualization/airball.git
cd airball

# Serve the static site (any HTTP server works)
python3 -m http.server 8000
# → open http://localhost:8000/website/
```

That's it. The pre-computed JSON data lives in `js/` and is committed to the repo.

### Regenerate the data (optional)

If you want to re-run the data pipeline from raw CSVs:

```bash
# 1. Download the source dataset from Kaggle
#    https://www.kaggle.com/datasets/sumitrodatta/nba-aba-baa-stats
#    Place all CSV files inside a `data/` folder at the repo root.
#    If `data/` is absent, the script falls back to the committed `archive/` folder.

# 2. Install Python deps
pip install pandas numpy

# 3. Run the extraction script
python3 scripts/extract_data.py
# → writes fresh JSON to js/
```

The script cleans the data (NBA only, dedup mid-season trades, filter low-minutes players), merges per-game with advanced stats, computes percentile-normalized career stats for Act III, and emits one compact JSON per act.

---

## Repo structure

```
airball/
├── index.html              # GitHub Pages root → redirects to /website/
├── README.md
├── website/
│   ├── index.html          # SPA shell with four acts
│   ├── main.js             # D3 charts + lazy-loaded data
│   └── styles.css          # All styles incl. responsive + a11y
├── js/                     # Pre-computed JSON, one per act
│   ├── act1_revolution.json
│   ├── act2_bubbles.json
│   ├── act3_players.json
│   └── act4_dynasties.json
├── scripts/
│   └── extract_data.py     # Raw CSV → JSON pipeline
└── reports/                # Milestone deliverables (PDFs)
    ├── Milestone 1/
    ├── Milestone 2/
    └── Milestone 3/        # Process book + screencast (M3)
```

---

## Intended usage

- **Casual reading.** Click through the four acts in order. Each one stands alone.
- **Exploration.** Act II is the sandbox: hit Play to watch the league morph from 1982 → 2026; search any player by name to highlight them; positions are colour-coded.
- **Comparison.** In Act III, type any two players. Toggle Normalized ↔ Raw to switch between cross-era percentile and absolute career averages.
- **Storytelling.** Act IV lets you toggle dynasties on/off. Gold diamonds (◆) mark championship-winning seasons.

The site is fully responsive (down to ~360px wide) and respects `prefers-reduced-motion`.

---

## Data

**Primary source.** [NBA / ABA / BAA Stats](https://www.kaggle.com/datasets/sumitrodatta/nba-aba-baa-stats) on Kaggle — itself scraped from [Basketball-Reference](https://www.basketball-reference.com). Covers 1946–2026 across player per-game, advanced metrics, team summaries, and shooting splits.

**Pre-processing.** NBA-only filter; mid-season trade dedup (keep `TOT` / `2TM` aggregate rows); ≥10 games and ≥10 mpg threshold; per-game ⨝ advanced on `(season, player_id)`; weighted-mean career aggregation; percentile normalization at the 5th–95th range.

**Limitations.** Three-point data starts in 1979–80, shot-distance data in 1996–97. Salary data not currently used.

---

## Acknowledgements & related work

- Kirk Goldsberry, *SprawlBall* (2019) — inspiration for the mid-range decline narrative.
- [FiveThirtyEight RAPTOR](https://fivethirtyeight.com/) — reference for era-normalized player ratings.
- [Basketball-Reference.com](https://www.basketball-reference.com) — the canonical source for all of this.

---

## Milestones

| | Date | Weight | Deliverable |
| --- | --- | --- | --- |
| M1 | 2026-03-20 | 10% | [Project proposal (PDF)](./reports/Milestone%201/Milestone%201%20(Airball).pdf) |
| M2 | 2026-04-17 | 10% | [Prototype + sketches (PDF)](./reports/Milestone%202/Milestone%202%20(Airball).pdf) |
| M3 | 2026-05-28 | 80% | This repo + process book + screencast |
