"""Write private, rerunnable practice insights without changing recommendations."""

import hashlib
import json
from dataclasses import asdict, dataclass
from html import escape
from math import ceil
from pathlib import Path

from club_picker.practice import (
    MIN_SHOTS,
    WINDOW_DATES,
    ClubInsights,
    Comparison,
    GapMap,
    Summary,
    club_insights,
    gap_maps,
)
from club_picker.practice_data import DISTANCES, practice_shots
from club_picker.trackman import object_value

LABELS = {
    "carry_m": "Carry",
    "total_m": "Reported total",
    "carry_side_m": "Landing side",
    "total_side_m": "Finishing side",
}


@dataclass(frozen=True)
class PracticeReport:
    """Versioned private artifact with frozen support rules and input fingerprint."""

    version: int
    input_sha256: str
    shots: int
    duplicates: int
    clubs: int
    dates: int
    flagged: int
    undated: int
    unknown_intent: int
    display_unit: str
    min_shots_per_date: int
    window_dates: int
    groups: list[ClubInsights]
    gap_maps: list[GapMap]


def _table(headers: list[str], rows: list[list[str]]) -> str:
    return (
        '<div class="scroll"><table><thead><tr>'
        + "".join(f"<th>{escape(h)}</th>" for h in headers)
        + "</tr></thead><tbody>"
        + "".join(
            "<tr>" + "".join(f"<td>{escape(v)}</td>" for v in row) + "</tr>"
            for row in rows
        )
        + "</tbody></table></div>"
    )


def _context(context: dict[str, str]) -> str:
    return " · ".join(f"{k.replace('_', ' ')}: {v}" for k, v in context.items())


def _number(value: float | None, metric: str, unit: str) -> str:
    if value is None:
        return "Unavailable"
    return f"{value / (0.9144 if unit == 'yd' and metric in DISTANCES else 1):.1f}"


def _window(s: Summary | None) -> str:
    return (
        "No supported window"
        if s is None
        else f"{', '.join(s.dates)} ({s.shots} shots)"
    )


def _comparison(c: Comparison, metric: str, unit: str) -> str:
    if not c.prior or not c.recent:
        return f'<p class="muted">History only: {c.eligible_dates} eligible dates. Need six dates with at least five measured usable shots each for a 3 vs 3 comparison.</p>'
    a, b = c.prior, c.recent
    rows = [
        [
            "Signed median" if "side" in metric else "Median",
            _number(a.median, metric, unit),
            _number(b.median, metric, unit),
            _number(c.median_change, metric, unit),
        ],
        [
            "Middle 80% width",
            _number(a.spread, metric, unit),
            _number(b.spread, metric, unit),
            _number(c.spread_change, metric, unit),
        ],
    ]
    if "side" in metric:
        rows.append(
            [
                "Median absolute miss",
                _number(a.absolute_miss, metric, unit),
                _number(b.absolute_miss, metric, unit),
                _number(c.absolute_miss_change, metric, unit),
            ]
        )
    result = (
        f"<p><b>Earlier:</b> {escape(_window(a))}<br><b>Recent:</b> {escape(_window(b))}</p>"
        + _table(
            [f"Measurement ({unit})", "Earlier", "Recent", "Recent minus earlier"], rows
        )
    )
    if (
        c.short_threshold is not None
        and c.prior_short is not None
        and c.recent_short is not None
    ):
        result += f"<p>Below earlier usual carry range: <b>{c.prior_short:.1%} → {c.recent_short:.1%}</b>. Both periods use the earlier P10 of {_number(c.short_threshold, metric, unit)} {unit}, with equal weight per date. This is an observed short-tail rate, not a mishit label or future-shot probability.</p>"
    return result


def _history(c: Comparison, metric: str, unit: str) -> str:
    if not c.history:
        return '<p class="muted">No dated usable measurements.</p>'
    values = c.history
    lo = min(s.low for s in values)
    hi = max(s.high for s in values)
    extent = max(1, hi - lo)
    marks = ""
    for i, s in enumerate(values):
        x = 40 + 640 * i / max(1, len(values) - 1)

        def y(v: float) -> float:
            return 165 - 130 * (v - lo) / extent

        tone = "#87978c" if s.eligible else "#a6aaa0"
        if c.prior and s.day in c.prior.dates:
            tone = "#99758e"
        if c.recent and s.day in c.recent.dates:
            tone = "#52734d"
        title = escape(
            f"{s.day}: median {_number(s.median, metric, unit)} {unit}; {s.shots} shots"
            + ("" if s.eligible else "; sparse date, excluded from comparison")
        )
        marks += f'<g><title>{title}</title><line x1="{x}" x2="{x}" y1="{y(s.low)}" y2="{y(s.high)}" stroke="{tone}" stroke-width="5" opacity=".3"/><circle cx="{x}" cy="{y(s.median)}" r="4" fill="{tone}"/></g>'
    # Ordinal spacing deliberately avoids inventing observations between dates.
    chart = f'<svg viewBox="0 0 720 195" role="img" aria-label="Session medians and observed ranges, equally spaced practice dates"><text x="4" y="16">{escape(_number(hi, metric, unit))} {unit}</text>{marks}<text x="4" y="188">{escape(_number(lo, metric, unit))} {unit}</text></svg>'
    rows = [
        [
            s.day,
            str(s.shots),
            _number(s.median, metric, unit),
            f"{_number(s.low, metric, unit)} to {_number(s.high, metric, unit)}",
            "Eligible" if s.eligible else "Sparse: history only",
        ]
        for s in values
    ]
    legend = (
        '<p class="muted">Dots: per-date medians. Bars: observed P10 to P90. Earlier window: rose; recent window: green; other history: grey-green; sparse dates: grey.</p>'
        if c.prior
        else '<p class="muted">Dots: per-date medians. Bars: observed P10 to P90. Sparse dates are grey.</p>'
    )
    return (
        legend
        + chart
        + _table(
            ["Practice date", "Shots", f"Median ({unit})", "P10 to P90", "Support"],
            rows,
        )
    )


def _gap_view(g: GapMap, unit: str) -> str:
    bands = [c.summary for c in g.clubs if c.summary]
    step = 50 * (0.9144 if unit == "yd" else 1)
    extent = max(step, ceil(max((s.high for s in bands), default=1) / step) * step)
    marks = ""
    for i, c in enumerate(g.clubs):
        y = 24 + 32 * i
        marks += f'<text x="4" y="{y + 4}">{escape(c.label)}</text>'
        if c.summary:
            s = c.summary

            def x(v: float) -> float:
                return 130 + 430 * v / extent

            marks += f'<line x1="{x(s.low)}" x2="{x(s.high)}" y1="{y}" y2="{y}" stroke="#b5c8a5" stroke-width="10"/><circle cx="{x(s.median)}" cy="{y}" r="5" fill="#52734d"/><text x="580" y="{y + 4}">{_number(s.median, "carry_m", unit)} {unit}</text>'
        else:
            marks += f'<text x="130" y="{y + 4}" fill="#647064">No supported dates in this window</text>'
    baseline = len(g.clubs) * 32 + 12
    for index in range(round(extent / step) + 1):
        tick = index * step
        tx = 130 + 430 * tick / extent
        marks += f'<line x1="{tx}" x2="{tx}" y1="10" y2="{baseline}" stroke="#e1e5d9" opacity=".5"/><text x="{tx}" y="{baseline + 22}" text-anchor="middle">{_number(tick, "carry_m", unit)}</text>'
    marks += f'<text x="580" y="{baseline + 22}">{unit}</text>'
    chart = f'<div class="scroll"><svg class="gap-chart" viewBox="0 0 700 {len(g.clubs) * 32 + 50}" role="img" aria-label="Observed carry bands in normal bag order">{marks}</svg></div>'
    rows = [
        [
            c.label,
            _number(c.summary.median if c.summary else None, "carry_m", unit),
            f"{_number(c.summary.low, 'carry_m', unit)} to {_number(c.summary.high, 'carry_m', unit)}"
            if c.summary
            else "Unavailable",
            "Limited history" if c.limited else "3 supported dates",
            _window(c.summary),
        ]
        for c in g.clubs
    ]
    gaps = [
        [
            f"{p.longer} → {p.shorter}",
            _number(p.gap, "carry_m", unit),
            _number(p.overlap, "carry_m", unit),
            _number(p.common_gap, "carry_m", unit),
            ", ".join(p.common_dates) or "None",
            f"{p.common_longer.shots} / {p.common_shorter.shots}"
            if p.common_longer and p.common_shorter
            else "None",
        ]
        for p in g.gaps
    ]
    return f'<h3>{escape(g.set_id)} · {escape(g.context["source"])}</h3><p class="muted">{escape(_context(g.context))}</p><p>Reference practice dates: {escape(", ".join(g.reference_dates) or "None")}.</p>{chart}{_table(["Club", f"Median carry ({unit})", f"P10 to P90 ({unit})", "Support", "Actual dates and shots"], rows)}{_table(["Neighbors", f"Median gap ({unit})", f"Band overlap ({unit})", f"Same-date gap ({unit})", "Shared dates", "Shared shots (longer / shorter)"], gaps)}'


def render_practice(report: PracticeReport) -> str:
    """Render local evidence with context, support, and no automatic coaching verdict."""
    unit = report.display_unit
    ready = sum(g.comparisons["carry_m"].prior is not None for g in report.groups)
    readiness = [
        [
            f"Context {i + 1}",
            g.set_id,
            g.label,
            g.context["source"],
            g.context["normalization"],
            g.context["intent"],
            str(g.shots),
            str(g.flagged),
            str(g.undated),
            str(g.comparisons["carry_m"].eligible_dates),
            "3 vs 3 available" if g.comparisons["carry_m"].prior else "History only",
        ]
        for i, g in enumerate(report.groups)
    ]
    overview = [
        [
            f"Context {i + 1}",
            g.set_id,
            g.label,
            g.context["source"],
            _number(c.prior.median, "carry_m", unit),
            _number(c.recent.median, "carry_m", unit),
            _number(c.median_change, "carry_m", unit),
            _number(c.spread_change, "carry_m", unit),
        ]
        for i, g in enumerate(report.groups)
        if (c := g.comparisons["carry_m"]).prior and c.recent
    ]
    groups = ""
    for i, g in enumerate(report.groups):
        fields = [
            [m, str(a.present), str(a.missing), str(a.eligible_dates)]
            for m, a in g.fields.items()
        ]
        metrics = "".join(
            f"<h4>{LABELS[m]}</h4>{_comparison(c, m, unit)}<details><summary>Per-date values and sparse dates</summary>{_history(c, m, unit)}</details>"
            for m, c in g.comparisons.items()
        )
        groups += f'<details id="group-{i + 1}"><summary>{escape(g.set_id)} · {escape(g.label)} · {escape(g.context["source"])} · Context {i + 1}</summary><p class="muted">{escape(_context(g.context))}</p><p>Group inventory: {g.shots} shots, {g.flagged} flagged, {g.undated} undated. Field availability below counts usable dated shots only.</p>{_table(["Field (SI)", "Present", "Missing", "Dates with 5+"], fields)}{metrics}</details>'
    gap_views = "".join(
        f"<details><summary>{escape(g.set_id)} · {escape(g.context['source'])} · Bag context {i + 1}</summary>{_gap_view(g, unit)}</details>"
        for i, g in enumerate(report.gap_maps)
    )
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Caddie · Practice insights</title>
<style>body{{margin:0;background:#f8f5ec;color:#193d31;font:16px/1.6 system-ui}}main{{max-width:1100px;margin:auto;padding:32px 20px}}h1{{font-size:34px}}h2{{font-size:24px}}h3{{font-size:20px}}section{{background:#fffdf7;border:1px solid #d9decf;border-radius:20px;padding:24px;margin:24px 0}}p{{max-width:90ch}}.muted{{color:#5c685f;font-size:14px}}.scroll{{overflow:auto}}table{{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}}th,td{{text-align:left;padding:12px;border-bottom:1px solid #e1e5d9;white-space:nowrap}}th{{font-size:13px}}details{{border:1px solid #e0e5d8;border-radius:12px;padding:12px 16px;margin:16px 0}}summary{{cursor:pointer;font-weight:600;padding:8px 0}}svg{{display:block;width:100%;font:13px system-ui;fill:#193d31}}.gap-chart{{min-width:650px}}a{{color:#52734d}}.notice{{background:#e7eedc;border-radius:12px;padding:16px}}@media(max-width:600px){{main{{padding:20px 12px}}section{{padding:16px}}h1{{font-size:28px}}}}</style>
<main><p class="muted">MY CADDIE · PRIVATE PRACTICE REVIEW</p><h1>What is changing in my practice?</h1><p class="notice">{report.shots:,} unique shot records · {report.clubs} physical clubs · {report.dates} practice dates. {ready} club/context groups support a carry comparison. Every date counts equally.</p>
<p>This report contains private practice dates and settings. Keep it local. Counts distinguish normalization variants and are not necessarily distinct swings. Results describe recorded practice; they do not diagnose a swing or prove improvement on the course. {report.unknown_intent:,} shots have unknown intent, so deliberate shorter swings may be mixed in.</p>
<nav><a href="#readiness">Readiness</a> · <a href="#changes">Recent changes</a> · <a href="#details">Detailed history</a> · <a href="#gaps">Club gaps</a></nav><section id="readiness"><h2>1. Where the history is ready</h2><p>A comparison needs six compatible dates with at least five measured usable shots each. Each context keeps physical clubs, source, intent, normalization, bases and settings separate. 'Unknown' is a recorded absence, not proof conditions match. Field availability and full context appear below.</p><details><summary>Readiness by club and context</summary>{_table(["Context", "Set", "Club", "Source", "Normalization", "Intent", "Shots", "Flagged", "Undated", "Eligible carry dates", "Status"], readiness)}</details><p>{report.duplicates} duplicate rows ignored; {report.flagged} flagged shots and {report.undated} undated shots are omitted from comparisons. Flagged and undated counts can overlap. Sparse dates remain in history.</p></section>
<section id="changes"><h2>2. Recent carry compared with earlier practice</h2><p>Latest three eligible dates versus the preceding three. Positive carry change means longer; negative width change means a narrower recorded distribution. Neither alone means better. Periods differ by club/context; open the detailed history to inspect their actual dates.</p>{_table(["Context", "Set", "Club", "Source", f"Earlier median ({unit})", f"Recent median ({unit})", f"Median change ({unit})", f"Width change ({unit})"], overview) if overview else "<p>No supported comparisons yet.</p>"}<p>Windows are descriptive. Three dates per period do not establish statistical significance or reliable future-shot bounds. A long gap between dates, changing intent or unrecorded conditions can explain differences.</p></section>
<section id="details"><h2>3. Inspect distance and sideways control</h2><p>Median side is signed bias (negative left, positive right). Width measures variability; median absolute miss measures distance from the target line. Landing and finishing side are different fields. Each measurement has its own supported dates; do not assume its windows match the carry windows. Per-date plots use equally spaced practice dates, with grey marks for sparse history, and do not interpolate gaps.</p>{groups or "<p>No shot groups.</p>"}</section>
<section id="gaps"><h2>4. Where the clubs overlap</h2><p>Carry medians and observed P10 to P90 bands in conventional bag order. Each set/context uses the same latest three supported practice dates. Individual clubs may have fewer dates inside this window. Their pooled gap is descriptive, not a head-to-head result; check shared-date gaps and support. Overlap is an interval length, not a probability or a reason to remove a club.</p>{gap_views or "<p>No club maps.</p>"}</section>
<section><h2>What to do with this</h2><p>Choose one supported pattern to investigate in practice, then agree a measurable goal before collecting later dates. Ball speed and flight fields can help a later pattern-discovery experiment; this report does not infer causes or train a model. The approach picker and its recommendation method are unchanged.</p><details><summary>Calculation and reproduction</summary><p>All JSON measurements remain SI. HTML distance values are in {unit}. Quantiles give each date equal mass, divide that mass among its eligible shots, and average adjacent values at exact cumulative boundaries. Carry short-tail comparisons use the earlier period's fixed P10 for both periods. Quality flags are respected and genuine mishits are retained. Run club-picker insights SNAPSHOT --output PRIVATE_DIRECTORY --unit {unit}. Results and report are replaced on rerun; the input is never modified. Input SHA-256: {report.input_sha256}.</p></details></section></main></html>"""


def write_practice(snapshot: Path, output: Path, *, unit: str = "yd") -> PracticeReport:
    """Write private JSON and HTML with a reproducible, fixed descriptive contract."""
    if unit not in {"yd", "m"}:
        raise ValueError("Unit must be yd or m")
    if any(
        target.resolve() == snapshot.resolve()
        or (target.exists() and target.samefile(snapshot))
        for target in (output / name for name in ("report.html", "results.json"))
    ):
        raise ValueError("Output must not overwrite the input snapshot")
    raw = snapshot.read_bytes()
    fingerprint = hashlib.sha256(raw).hexdigest()
    rows, duplicates = practice_shots(object_value(json.loads(raw)))
    report = PracticeReport(
        1,
        fingerprint,
        len(rows),
        duplicates,
        len({(r.set_id, r.shot.club_id) for r in rows}),
        len({r.shot.session_date for r in rows if r.shot.session_date}),
        sum(r.shot.quality != "usable" for r in rows),
        sum(r.shot.session_date is None for r in rows),
        sum(r.shot.intent == "unknown" for r in rows),
        unit,
        MIN_SHOTS,
        WINDOW_DATES,
        club_insights(rows),
        gap_maps(rows),
    )
    contents = {
        "results.json": json.dumps(asdict(report), indent=2, allow_nan=False) + "\n",
        "report.html": render_practice(report),
    }
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    for name, content in contents.items():
        target = output / name
        target.write_text(content)
        target.chmod(0o600)
    return report
