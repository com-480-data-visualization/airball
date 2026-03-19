# Project of Data Visualization (COM-480)

| Student's name | SCIPER |
| -------------- | ------ |
| Elias Mir | 341277 |
| Michael Freeman | 313215 |
| Yassine Mamlouk | 327081 |
| Aziz Laadhar | 315196 |

[Milestone 1](#milestone-1) • [Milestone 2](#milestone-2) • [Milestone 3](#milestone-3)

## Milestone 1 (20th March, 5pm)

**10% of the final grade**

This is a preliminary milestone to let you set up goals for your final project and assess the feasibility of your ideas.
Please, fill the following sections about your project.

*(max. 2000 characters per section)*

### Dataset

Our primary source is the **NBA Stats dataset on Kaggle** ([sumitrodatta/nba-aba-baa-stats](https://www.kaggle.com/datasets/sumitrodatta/nba-aba-baa-stats)), compiled from [Basketball-Reference.com](https://www.basketball-reference.com). It covers every player and team season from 1946 to 2024 across several CSV files: per-game stats, advanced metrics (PER, VORP, BPM, Win Shares, True Shooting%, Usage Rate), team summaries, shooting splits (from ~1997), and award data. Two supplementary datasets extend the analysis: (1) a **salary dataset** (Kaggle/HoopsHype, 1990–2024) for payroll efficiency analysis, and (2) **draft data** from Basketball-Reference for career arc exploration.

**Data quality:** Basketball-Reference is the industry gold standard used by researchers and journalists alike. Missing values are limited to statistics not tracked in early seasons (three-point data before 1979–80; shot-distance data before ~1997). Salary data requires extra care due to inconsistent name formats across sources.

**Pre-processing required:** normalize player names for cross-file joins; drop duplicate rows for mid-season trades, keeping the `TOT` aggregate; filter players with fewer than 10 games or 10 min/game; inflation-adjust salaries; build a franchise-continuity map (e.g. SEA → OKC, NJN → BKN) for consistent team-level analysis. Overall the dataset is clean, well-structured, and well-suited for a visualization-focused project.

### Problematic

The NBA has been radically transformed by analytics over the past two decades: the three-point explosion, the collapse of the mid-range shot, the rise of pace-and-space offenses, and a supermax salary era have reshaped every aspect of the game. Yet most fans consume the NBA through box scores and highlight reels, never seeing the macro-level patterns that drive these changes.

**Our goal** is to make these structural shifts visible, interactive, and accessible to a broad audience — from data-savvy analysts to casual fans curious how today's NBA compares to the Jordan or Shaq era. We organize the story around four questions:

1. *How has play style evolved?* — tracing the three-point revolution and the death of the mid-range shot.
2. *Who were the most efficient players of each era?* — using advanced metrics to enable fair cross-generation comparison.
3. *Does payroll buy wins?* — mapping salary allocation against team performance and championship outcomes.
4. *How predictable is the draft?* — identifying which draft positions reliably produce stars.

**Target audience:** sports enthusiasts and data-curious readers requiring no analytics background, with a secondary audience of researchers wanting exploratory tools.

### Exploratory Data Analysis

The cleaned dataset contains **14,924 player-seasons** spanning 1977–2026, covering 2,760 unique players across an average of 27.6 teams per season. Pre-processing steps applied: normalized player names for cross-file joins; removed mid-season trade duplicates, keeping only the `TOT` aggregate row; filtered to players with ≥10 games and ≥10 minutes per game; merged per-game and advanced metric CSVs on `player_id` and `season`.

**Per-Era League Averages**

| Era | 3PA/game | Pace | Avg TS% | Avg PTS/g |
| ----- | -------- | ----- | ------- | --------- |
| 1980s | 3.5 | 101.5 | 52.9% | 11.1 |
| 1990s | 11.5 | 93.8 | 52.5% | 10.4 |
| 2000s | 15.7 | 91.4 | 52.0% | 9.8 |
| 2010s | 23.1 | 94.5 | 53.6% | 9.9 |
| 2020s | 34.6 | 99.1 | 56.8% | 10.9 |

Three-point attempts grew **10×** from the 1980s to the 2020s, accelerating sharply after 2012 as analytics departments quantified the shot's efficiency advantage. Pace slowed dramatically through the 1990s–2000s (historic low of 91.4) before rebounding in the modern era. True Shooting% climbed steadily from 52.9% to 56.8%, reflecting the shift toward high-value shots. Null values were minimal: 19 missing entries in `ts_percent`, `vorp`, and `per` (early seasons), and 240 in `usg_percent` (pre-1982, before reliable play-by-play tracking). Team-level VORP correlates with win percentage at r > 0.7 (p < 0.001), confirming advanced metrics as meaningful cross-era proxies.

### Related work

**Existing work on this data:**
- Kirk Goldsberry, *SprawlBall* (2019): static shot-chart graphics showing the mid-range decline; we extend this concept interactively.
- [Basketball-Reference.com](https://www.basketball-reference.com): offers static tables but no cross-era interactive comparison.
- [FiveThirtyEight RAPTOR](https://fivethirtyeight.com/features/this-lakers-season-was-a-trainwreck-and-theres-no-easy-way-to-get-back-on-track/): advanced player ratings with static, non-exploratory presentation.

**Originality:** no existing tool combines animated league-wide trend narratives, an era-normalized player comparison tool, and interactive payroll-efficiency analysis in one cohesive experience. We combine scrollytelling narrative structure with open-ended Gapminder-style exploration, applied to a domain with a very wide potential audience.

## Milestone 2 (17th April, 5pm)

**10% of the final grade**


## Milestone 3 (29th May, 5pm)

**80% of the final grade**


## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone

