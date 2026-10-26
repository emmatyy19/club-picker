"""Render local range diagnostics with explicit weighting and support."""

import json
from html import escape
from pathlib import Path
from typing import cast

from club_picker.evaluation import observations
from club_picker.ranges import range_analysis
from club_picker.trackman import read_object


def _table(methods: dict[str, dict[str, float]]) -> str:
    rows = "".join(
        f"<tr><th>{escape(name)}</th><td>{v['short']:.1%}</td><td>{v['inside']:.1%}</td><td>{v['long']:.1%}</td><td>{v['width']:.1f}</td><td>{v['interval_score']:.1f}</td>"
        f"<td>{int(v['groups'])}</td><td>{int(v['shots'])}</td></tr>"
        for name, v in methods.items()
        if v
    )
    return (
        '<div class="scroll"><table><tr><th>Range</th><th>Short</th><th>Inside</th><th>Long</th><th>Width (m)</th><th>Interval score</th><th>Club/date groups</th><th>Shots</th></tr>'
        + rows
        + "</table></div>"
    )


def render(result: dict[str, object]) -> str:
    """Explain associations without fitting or claiming calibrated probabilities."""
    summary = cast(dict[str, dict[str, float]], result["summary"])
    stable = summary["Stable range"]
    if not stable:
        return '<!doctype html><html lang="en"><meta charset="utf-8"><title>Range diagnostics</title><h1>No evaluable ranges</h1><p>Each club/context needs two earlier compatible dates.</p></html>'
    by_history = cast(dict[str, dict[str, dict[str, float]]], result["by_history"])
    bands = "".join(
        f"<h3>{label} earlier compatible dates</h3>{_table(methods)}<p>Support: {int(methods['Stable range'].get('clubs', 0))} clubs, {int(methods['Stable range'].get('dates', 0))} distinct dates.</p>"
        for label, methods in by_history.items()
    )
    contexts = cast(list[dict[str, object]], result["by_context"])
    marks = ""
    context_tables = ""
    for i, item in enumerate(contexts):
        label = escape(f"{item['club']} · {item['context']}")
        methods = cast(dict[str, dict[str, float]], item["methods"])
        v = methods["Stable range"]
        y = 25 + i * 50
        marks += f'<text x="10" y="{y}">{label}</text><text x="10" y="{y + 17}" class="small">{int(v["groups"])} evaluated dates · {int(v["shots"])} shots</text>'
        x = 365.0
        for key, color in (
            ("short", "#c07844"),
            ("inside", "#438775"),
            ("long", "#9570aa"),
        ):
            width = v[key] * 460
            marks += f'<rect x="{x}" y="{y - 10}" width="{width}" height="21" fill="{color}"><title>{key}: {v[key]:.1%}</title></rect>'
            x += width
        marks += f'<text x="845" y="{y + 5}">{v["inside"]:.1%} inside</text>'
        context_tables += f"<h3>{label}</h3>{_table(methods)}<p>Stable per-date coverage ranged from {v['min_session_coverage']:.0%} to {v['max_session_coverage']:.0%}. These extremes are observations, not uncertainty bounds.</p>"
    folds = cast(list[dict[str, object]], result["folds"])
    worst = sorted(
        [r for r in folds if r["method"] == "Stable range"],
        key=lambda r: (float(cast(float, r["inside"])), -int(cast(int, r["shots"]))),
    )[:12]
    worst_rows = "".join(
        f"<tr><td>{escape(str(r['club']))}</td><td>{escape(str(r['context']))}</td><td>{r['session']}</td><td>{r['history_sessions']}</td><td>{r['shots']}</td><td>{cast(float, r['short']):.0%}</td><td>{cast(float, r['inside']):.0%}</td><td>{cast(float, r['long']):.0%}</td><td>{cast(float, r['median_shift']):+.1f}</td></tr>"
        for r in worst
    )
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Caddie · Understanding carry ranges</title>
<style>body{{font:16px/1.6 system-ui;background:#f5f7f3;color:#243a32;margin:0}}main{{max-width:1100px;margin:auto;padding:40px 24px}}section{{background:white;padding:24px;margin:24px 0;border:1px solid #dce5dd;border-radius:16px}}h1{{margin:8px 0}}h2{{font-size:22px}}table{{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}}th,td{{text-align:left;padding:12px;border-bottom:1px solid #e0e6e1;white-space:nowrap}}.scroll{{overflow:auto}}svg{{width:100%;min-width:950px}}svg text{{font:13px system-ui;fill:#243a32}}svg .small{{font-size:11px;fill:#64756c}}.legend{{display:flex;gap:24px;flex-wrap:wrap;margin:20px 0}}summary{{cursor:pointer;padding:12px}}p{{max-width:90ch}}</style>
<main><p>MY CADDIE · RANGE DIAGNOSTICS{" · SYNTHETIC DATA" if result.get("data_kind") == "synthetic" else ""}</p><h1>Where does the 80% range miss?</h1><p>The same historical P10 to P90 ranges, inspected more closely. Nothing has been widened or calibrated to make the results look better.</p>
<section><h2>Two numbers, two different questions</h2><p><strong>{stable["inside"]:.1%}: giving every club equal weight.</strong> This asks how consistently the range works across the bag. Dates are averaged within context, contexts within club, then clubs equally.</p><p><strong>{stable["pooled_shot_coverage"]:.1%}: giving every evaluated shot equal weight.</strong> This asks what fraction of all evaluated shots landed inside. Frequently practiced clubs dominate this number.</p><p>Neither replaces the other. Near-80% overall coverage can hide a poorly supported club. Evidence: {int(stable["shots"])} shots, {int(stable["groups"])} club/context/date groups, {int(stable["dates"])} distinct dates, {int(stable["clubs"])} clubs.</p></section>
<section><h2>Are the misses short or long?</h2>{_table(summary)}<p>These are club-balanced rates. The intended split is roughly 10% short, 80% inside, 10% long. Endpoints count inside. Lower interval score is better: it combines width with a penalty for how far missed shots fall outside. It is not a safety probability or a golf score.</p><p>On the earlier shots used to construct it, the stable range covered {stable["historical_coverage"]:.1%} on average. Discrete values, ties and limited samples mean historical coverage need not be exactly 80%. That in-sample fit is not evidence about a later session.</p></section>
<section><h2>Does limited history matter?</h2>{bands}<p>These bands were fixed before inspecting the results. They contain different clubs and dates, so differences are descriptive associations, not proof that collecting more sessions alone fixes coverage. The 80% target is a benchmark, not a guarantee.</p></section>
<section><h2>Which clubs need attention?</h2><p>Stable ranges, separated by physical club and measurement context. Read the support counts: one date is weak evidence, even when coverage looks excellent.</p><div class="legend"><span style="color:#c07844">Short</span><span style="color:#438775">Inside</span><span style="color:#9570aa">Long</span></div><div class="scroll"><svg viewBox="0 0 970 {len(contexts) * 50 + 10}" role="img" aria-label="Short, inside and long shares by club and context">{marks}</svg></div><details><summary>Compare stable and recent ranges for each group</summary>{context_tables}</details></section>
<section><details><summary>Inspect the lowest-coverage dates</summary><p>Up to twelve dates selected after evaluation for inspection, not a representative sample. A negative median shift means the actual session's middle carry moved shorter than the earlier historical median. This is an after-the-fact diagnostic, never a prediction input.</p><div class="scroll"><table><tr><th>Club</th><th>Context</th><th>Session order</th><th>Earlier dates</th><th>Shots</th><th>Short</th><th>Inside</th><th>Long</th><th>Median shift (m)</th></tr>{worst_rows}</table></div></details></section>
<section><h2>What this means for the caddie</h2><p>Check the individual club and its history before treating a descriptive range as a future-shot prediction. Do not widen every club blindly from one overall number. Missing shot intent and unrecorded conditions remain unknown; this report cannot establish why a session changed.</p><p>This is development evidence, with shared dates and reused training history. No independent-shot confidence interval is claimed. The app is unchanged. Any fitted range adjustment needs a separate chronological experiment and future validation. Carry-only coverage says nothing about sideways misses, rollout, or course safety.</p><details><summary>Reproduce this report</summary><p>Run club-picker ranges with a reviewed explorer snapshot and an output directory. results.json includes the settings, exclusions and every diagnostic fold. Outputs use ordinal dates and generic labels; raw dates and context settings remain outside the report. Regenerating replaces these two files. Keep generated runs ignored.</p></details></section></main></html>"""


def write_ranges(snapshot: Path, output: Path) -> dict[str, object]:
    """Write local diagnostics, preserving the input and excluding raw metadata."""
    if snapshot.resolve() in {
        (output / name).resolve() for name in ("results.json", "report.html")
    }:
        raise ValueError("Output must not overwrite the input snapshot.")
    rows, excluded = observations(read_object(snapshot))
    result = range_analysis(rows)
    result["data_kind"] = (
        "synthetic"
        if rows and all(r.context[5] == "synthetic" for r in rows)
        else "supplied snapshot"
    )
    result["excluded"] = excluded
    result["eligible_shots"] = len(rows)
    output.mkdir(parents=True, exist_ok=True)
    (output / "results.json").write_text(
        json.dumps(result, indent=2, allow_nan=False) + "\n"
    )
    (output / "report.html").write_text(render(result))
    return result
