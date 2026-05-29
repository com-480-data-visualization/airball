#!/usr/bin/env python3
"""Build a compact real shot-location heatmap from NBA shotdetail files.

The raw source files contain one row per NBA field-goal attempt with LOC_X/LOC_Y.
This script downloads the yearly regular-season shotdetail archives from
https://github.com/shufinskiy/nba_data, bins shots into a fixed half-court grid,
and writes a small static JSON file for the D3 site.
"""

from __future__ import annotations

import csv
import io
import json
import lzma
import os
import subprocess
import tarfile
from collections import defaultdict
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT_DIR / "js"
CACHE_DIR = Path(os.environ.get("AIRBALL_SHOT_CACHE", "/tmp/airball_shotdetail_cache"))

SOURCE_URL = "https://raw.githubusercontent.com/shufinskiy/nba_data/main/datasets/shotdetail_{year}.tar.xz"
# Keep the committed JSON compact: one real shot-location heatmap for each
# narrative milestone. Display seasons are source year + 1.
SOURCE_YEARS = (1996, 2011, 2015, 2025)  # 1997, 2012, 2016, 2026.

X_DOMAIN = (-250, 250)
Y_DOMAIN = (-52, 423)
X_BINS = 30
Y_BINS = 28


def download_if_needed(year: int) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"shotdetail_{year}.tar.xz"
    if path.exists() and path.stat().st_size > 0:
        return path

    url = SOURCE_URL.format(year=year)
    print(f"  downloading shotdetail_{year}.tar.xz", flush=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    subprocess.run([
        "curl",
        "-L",
        "--fail",
        "--silent",
        "--show-error",
        "--max-time",
        "120",
        "-o",
        str(tmp_path),
        url,
    ], check=True)
    tmp_path.replace(path)
    return path


def iter_shots(path: Path, year: int):
    member = f"shotdetail_{year}.csv"
    with lzma.open(path, "rb") as compressed:
        data = compressed.read()
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:") as tar:
        extracted = tar.extractfile(member)
        if extracted is None:
            raise FileNotFoundError(f"{member} missing from {path}")
        text = io.TextIOWrapper(extracted, encoding="utf-8", newline="")
        yield from csv.DictReader(text)


def bin_index(value: float, domain: tuple[int, int], bins: int) -> int | None:
    lo, hi = domain
    if value < lo or value > hi:
        return None
    idx = int((value - lo) / (hi - lo) * bins)
    return min(bins - 1, max(0, idx))


def build_year(year: int) -> dict:
    path = download_if_needed(year)
    cells: dict[tuple[int, int], list[int]] = defaultdict(lambda: [0, 0])
    shots = makes = threes = midrange = rim = 0

    for row in iter_shots(path, year):
        if row.get("SHOT_ATTEMPTED_FLAG") != "1":
            continue
        try:
            x = float(row["LOC_X"])
            y = float(row["LOC_Y"])
            made = int(float(row["SHOT_MADE_FLAG"]))
        except (KeyError, TypeError, ValueError):
            continue

        bx = bin_index(x, X_DOMAIN, X_BINS)
        by = bin_index(y, Y_DOMAIN, Y_BINS)
        if bx is None or by is None:
            continue

        shots += 1
        makes += made
        if row.get("SHOT_TYPE", "").startswith("3PT"):
            threes += 1
        if row.get("SHOT_ZONE_BASIC") == "Mid-Range":
            midrange += 1
        if row.get("SHOT_ZONE_BASIC") == "Restricted Area":
            rim += 1
        cells[(bx, by)][0] += 1
        cells[(bx, by)][1] += made

    cell_rows = []
    for (bx, by), (attempts, made_count) in sorted(cells.items(), key=lambda item: (item[0][1], item[0][0])):
        cell_rows.append({
            "x": bx,
            "y": by,
            "a": attempts,
            "m": made_count,
            "d": round((attempts / shots) * 10000, 2) if shots else 0,
            "fg": round((made_count / attempts) * 100, 1) if attempts else 0,
        })

    display_season = year + 1
    return {
        "sourceSeason": year,
        "season": display_season,
        "shots": shots,
        "makes": makes,
        "fg": round((makes / shots) * 100, 1) if shots else 0,
        "threeShare": round((threes / shots) * 100, 1) if shots else 0,
        "midrangeShare": round((midrange / shots) * 100, 1) if shots else 0,
        "rimShare": round((rim / shots) * 100, 1) if shots else 0,
        "cells": cell_rows,
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    by_season = {}
    max_density = 0
    max_attempts = 0
    total_shots = 0

    print("Building real shot-location heatmap...", flush=True)
    for year in SOURCE_YEARS:
        season = build_year(year)
        key = str(season["season"])
        by_season[key] = season
        total_shots += season["shots"]
        for cell in season["cells"]:
            max_density = max(max_density, cell["d"])
            max_attempts = max(max_attempts, cell["a"])
        print(f"  {key}: {season['shots']:,} shots · {len(season['cells'])} occupied bins", flush=True)

    seasons = sorted(int(s) for s in by_season)
    output = {
        "seasons": seasons,
        "grid": {
            "xDomain": list(X_DOMAIN),
            "yDomain": list(Y_DOMAIN),
            "xBins": X_BINS,
            "yBins": Y_BINS,
        },
        "bySeason": by_season,
        "summary": {
            "startSeason": seasons[0],
            "endSeason": seasons[-1],
            "totalShots": total_shots,
            "maxDensity": round(max_density, 2),
            "maxCellAttempts": max_attempts,
            "source": "shufinskiy/nba_data shotdetail regular-season files",
            "sourceUrl": "https://github.com/shufinskiy/nba_data",
            "license": "Apache-2.0",
            "coordinateSource": "NBA Stats shotchartdetail LOC_X/LOC_Y",
        },
    }

    path = OUT_DIR / "act1_real_heatmap.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Saved {path} ({path.stat().st_size // 1024} KB)", flush=True)


if __name__ == "__main__":
    main()
