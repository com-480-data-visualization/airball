#!/usr/bin/env python3
"""Render the Milestone 3 process book markdown to a PDF.

This is intentionally small and local to the repo: it supports the subset of
Markdown used in reports/Milestone 3/process_book.md, including headings,
paragraphs, bullet/numbered lists, simple tables, links, and inline emphasis.
"""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "reports" / "Milestone 3" / "process_book.md"
DEFAULT_OUTPUT = ROOT / "reports" / "Milestone 3" / "process_book.pdf"


def inline_markdown(text: str) -> str:
    """Convert the report's inline Markdown to ReportLab paragraph markup."""
    placeholders: dict[str, str] = {}

    def stash(match: re.Match[str]) -> str:
        key = f"@@LINK{len(placeholders)}@@"
        label = html.escape(match.group(1), quote=False)
        url = html.escape(match.group(2), quote=True)
        placeholders[key] = f'<link href="{url}"><u>{label}</u></link>'
        return key

    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", stash, text)
    text = html.escape(text, quote=False)
    text = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", text)
    text = text.replace("→", "&#8594;").replace("≥", "&#8805;")
    for key, value in placeholders.items():
        text = text.replace(key, value)
    return text


def build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "AirballTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=28,
            textColor=colors.HexColor("#111827"),
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "AirballSubtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#4b5563"),
            alignment=TA_CENTER,
            spaceAfter=14,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=22,
            textColor=colors.HexColor("#111827"),
            spaceBefore=16,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#1f2937"),
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=13.5,
            textColor=colors.HexColor("#1f2937"),
            alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#6b7280"),
            alignment=TA_CENTER,
            spaceBefore=8,
        ),
        "cell": ParagraphStyle(
            "Cell",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.7,
            leading=10,
            textColor=colors.HexColor("#1f2937"),
        ),
        "cell_header": ParagraphStyle(
            "CellHeader",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.8,
            leading=10,
            textColor=colors.white,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=13.5,
            leftIndent=10,
            textColor=colors.HexColor("#1f2937"),
        ),
    }


def is_table(lines: list[str], i: int) -> bool:
    return (
        i + 1 < len(lines)
        and lines[i].strip().startswith("|")
        and lines[i + 1].strip().startswith("|")
        and re.fullmatch(r"[\s|:\-]+", lines[i + 1].strip()) is not None
    )


def parse_table(lines: list[str], i: int, styles) -> tuple[Table, int]:
    rows: list[list[str]] = []
    while i < len(lines) and lines[i].strip().startswith("|"):
        raw = lines[i].strip()
        rows.append([c.strip() for c in raw.strip("|").split("|")])
        i += 1

    rows = [rows[0], *rows[2:]]
    data = []
    for r_idx, row in enumerate(rows):
        style = styles["cell_header"] if r_idx == 0 else styles["cell"]
        data.append([Paragraph(inline_markdown(cell or " "), style) for cell in row])

    col_count = max(len(row) for row in rows)
    if col_count == 2:
        widths = [4.0 * cm, 11.5 * cm]
    elif col_count == 5:
        widths = [4.1 * cm, 2.85 * cm, 2.85 * cm, 2.85 * cm, 2.85 * cm]
    else:
        widths = [15.5 * cm / col_count] * col_count

    table = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d1d5db")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table, i


def collect_list(lines: list[str], i: int, styles) -> tuple[ListFlowable, int]:
    items = []
    ordered = bool(re.match(r"\s*\d+\.\s+", lines[i]))
    pattern = r"\s*\d+\.\s+(.*)" if ordered else r"\s*-\s+(.*)"

    while i < len(lines):
        match = re.match(pattern, lines[i])
        if not match:
            break
        para = Paragraph(inline_markdown(match.group(1).strip()), styles["bullet"])
        items.append(ListItem(para, leftIndent=12))
        i += 1

    return (
        ListFlowable(
            items,
            bulletType="1" if ordered else "bullet",
            leftIndent=18,
            bulletFontSize=7,
            bulletOffsetY=1,
        ),
        i,
    )


def build_story(markdown: str):
    styles = build_styles()
    lines = markdown.splitlines()
    story = []
    i = 0
    paragraph: list[str] = []

    def flush_paragraph():
        if paragraph:
            story.append(Paragraph(inline_markdown(" ".join(paragraph)), styles["body"]))
            paragraph.clear()

    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()

        if not stripped:
            flush_paragraph()
            i += 1
            continue

        if stripped == "---":
            flush_paragraph()
            story.append(Spacer(1, 8))
            i += 1
            continue

        if stripped.startswith("# "):
            flush_paragraph()
            story.append(Paragraph(inline_markdown(stripped[2:]), styles["title"]))
            i += 1
            continue

        if stripped.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(inline_markdown(stripped[4:]), styles["h2"]))
            i += 1
            continue

        if stripped.startswith("## "):
            flush_paragraph()
            if story:
                story.append(Spacer(1, 3))
            story.append(Paragraph(inline_markdown(stripped[3:]), styles["h1"]))
            i += 1
            continue

        if is_table(lines, i):
            flush_paragraph()
            table, i = parse_table(lines, i, styles)
            story.append(table)
            story.append(Spacer(1, 8))
            continue

        if re.match(r"\s*(-|\d+\.)\s+", line):
            flush_paragraph()
            list_flowable, i = collect_list(lines, i, styles)
            story.append(list_flowable)
            story.append(Spacer(1, 5))
            continue

        if stripped.startswith("*") and stripped.endswith("*") and "Process book" in stripped:
            flush_paragraph()
            story.append(Paragraph(inline_markdown(stripped), styles["small"]))
            i += 1
            continue

        if stripped.startswith("**COM-480") or stripped.startswith("Elias Mir") or stripped.startswith("[Live project"):
            flush_paragraph()
            story.append(Paragraph(inline_markdown(stripped), styles["subtitle"]))
            i += 1
            continue

        paragraph.append(stripped)
        i += 1

    flush_paragraph()
    return story


def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#6b7280"))
    canvas.drawString(doc.leftMargin, 1.0 * cm, "Airball - Process Book - Milestone 3")
    canvas.drawRightString(A4[0] - doc.rightMargin, 1.0 * cm, str(doc.page))
    canvas.restoreState()


def render(input_path: Path, output_path: Path) -> None:
    markdown = input_path.read_text(encoding="utf-8")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=1.6 * cm,
        rightMargin=1.6 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.6 * cm,
        title="Airball - Process Book",
        author="Elias Mir, Michael Freeman, Yassine Mamlouk, Aziz Laadhar",
    )
    story = build_story(markdown)
    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    render(args.input, args.output)
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
