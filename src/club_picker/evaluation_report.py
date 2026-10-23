"""Standalone, network-free visual reports for development backtests."""

import json
from dataclasses import asdict
from html import escape
from pathlib import Path

from club_picker.evaluation import aggregate, backtest, observations
from club_picker.trackman import read_object


def write_report(snapshot: Path, output: Path) -> dict[str, object]:
    """Write anonymized diagnostics locally; never change the recommendation app."""
    rows, excluded = observations(read_object(snapshot))
    folds, warmup = backtest(rows)
    summary = aggregate(folds)
    result: dict[str, object] = {
        "schema_version": 1,
        "status": "development backtest; no untouched test",
        "unit": "m",
        "config": {"min_history": 2, "recency_half_life_sessions": 3},
        "eligible_shots": len(rows),
        "unknown_intent_shots": sum(r.context[1] == "unknown" for r in rows),
        "excluded": excluded,
        "warmup_or_insufficient_history_shots": warmup,
        "evaluated_shots": sum(f.shots for f in folds if f.model == "Stable mean"),
        "evaluated_dates": len({f.session for f in folds}),
        "summary": summary,
        "folds": [asdict(f) for f in folds],
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "results.json").write_text(
        json.dumps(result, indent=2, allow_nan=False) + "\n"
    )
    table = "".join(
        f"<tr><th>{escape(model)}</th>"
        + "".join(
            f"<td>{metrics[key]:.2f}</td>"
            for key in ("rmse", "mae", "bias", "coverage", "width", "clearance_brier")
        )
        + "</tr>"
        for model, metrics in summary.items()
    )
    charts: list[str] = []
    colors = {
        "Stable mean": "#377b67",
        "Stable median": "#9871ad",
        "Recent mean": "#c26a36",
    }
    for context in sorted({f.context for f in folds}):
        selected = [f for f in folds if f.context == context]
        dates = sorted({f.session for f in selected})
        maximum = (
            max(max(f.high, f.actual_mean, f.prediction) for f in selected) * 1.1 or 1
        )

        def x(session: int, dates: list[int] = dates) -> float:
            return 60 + dates.index(session) * 620 / max(1, len(dates) - 1)

        def y(value: float, maximum: float = maximum) -> float:
            return 240 - value / maximum * 210

        marks = ""
        for tick in range(5):
            value = maximum * tick / 4
            marks += f'<path d="M60 {y(value)}H700" stroke="#e0e6e1"/><text x="50" y="{y(value) + 4}" text-anchor="end">{value:.0f}</text>'
        for model, color in colors.items():
            points = " ".join(
                f"{x(f.session)},{y(f.prediction)}"
                for f in selected
                if f.model == model
            )
            marks += f'<polyline fill="none" stroke="{color}" stroke-width="2" points="{points}"/>'
            for f in selected:
                if f.model == model:
                    marks += f'<circle cx="{x(f.session)}" cy="{y(f.prediction)}" r="2" fill="{color}"/>'
        for f in selected:
            if f.model != "Stable mean":
                continue
            marks += f'<line x1="{x(f.session)}" x2="{x(f.session)}" y1="{y(f.low)}" y2="{y(f.high)}" stroke="#377b67" opacity=".3" stroke-width="10"/>'
            marks += f'<circle cx="{x(f.session)}" cy="{y(f.actual_mean)}" r="4" fill="#243a32"><title>Session {f.session}: actual mean {f.actual_mean:.1f} m; {f.shots} shots; {f.history_sessions} earlier sessions</title></circle>'
            marks += f'<text x="{x(f.session)}" y="265" text-anchor="middle">{f.session}</text>'
        charts.append(
            f'<section><h2>{selected[0].club} · {context}</h2><p>{len(dates)} evaluated dates · carry (m)</p><svg role="img" aria-label="Predicted carry and observed session mean" viewBox="0 0 740 290">{marks}</svg></section>'
        )
    details = "".join(
        f"<tr><td>{f.club}</td><td>{f.context}</td><td>{f.session}</td><td>{f.history_sessions}</td><td>{f.shots}</td><td>{f.model}</td><td>{f.rmse:.2f}</td><td>{f.coverage:.0%}</td></tr>"
        for f in folds
    )
    html = f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Caddie · Carry backtest</title>
<style>body{{font:16px/1.6 system-ui;background:#f5f7f3;color:#243a32;margin:0}}main{{max-width:1050px;margin:auto;padding:40px 24px}}section{{background:white;padding:24px;margin:24px 0;border:1px solid #dce5dd;border-radius:16px}}h1{{margin:8px 0}}h2{{font-size:20px}}table{{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}}td,th{{padding:12px;text-align:left;border-bottom:1px solid #e0e6e1;white-space:nowrap}}.scroll{{overflow:auto}}svg{{width:100%;max-height:400px}}svg text{{font:12px system-ui;fill:#53645b}}.legend{{display:flex;gap:24px;flex-wrap:wrap}}summary{{cursor:pointer;padding:12px}}p{{max-width:85ch}}</style>
<main><p>MY CADDIE · DEVELOPMENT BACKTEST</p><h1>Does recent practice help?</h1>
<p>Each prediction uses only earlier dates for the same physical club and measurement context. This history has already been explored. These are development results, not an untouched test or evidence of lower golf scores.</p>
<section><h2>Evidence available</h2><p>{len(rows)} eligible shots · {result["evaluated_shots"]} evaluated shots · {result["evaluated_dates"]} evaluated dates · {len({f.club for f in folds})} evaluated clubs</p><p>{warmup} shots used only as warm-up or lacking two earlier compatible dates. {result["unknown_intent_shots"]} eligible shots have unknown intent; those remain separate from explicit full swings. Exclusions: {escape(str(excluded))}.</p></section>
<section><h2>Prediction error and range checks</h2><div class="scroll"><table><thead><tr><th>Method</th><th>RMSE (m)</th><th>MAE (m)</th><th>Bias (m)</th><th>Coverage</th><th>Width (m)</th><th>Brier</th></tr></thead><tbody>{table}</tbody></table></div>
<p>Lower error is better. Positive bias means predicted too long. Coverage is a fraction, with 0.80 as the target for the historical P10 to P90 range. Width matters too. Stable mean and median share the same range and event probabilities.</p><p>Metrics average dates within each context, contexts within each physical club, then clubs equally. RMSE is the average of session RMSEs, not pooled shot RMSE. Recent mean uses a fixed three-session half-life, not a tuned setting.</p><p>Brier checks clearance beyond the earlier stable median, a moving diagnostic boundary shared by all methods. It does not measure safety at a specific hazard. No uncertainty interval is claimed; folds share training history and practice dates are limited.</p></section>
<h2>Replay later sessions</h2><div class="legend"><span style="color:#377b67">Stable mean</span><span style="color:#9871ad">Stable median</span><span style="color:#c26a36">Recent mean</span><span>● Actual session mean</span></div><p>Faint vertical bars show the stable historical middle 80% range. The horizontal axis is session order, spaced equally, not elapsed time. Clubs and contexts have anonymous labels; calendar dates and original identifiers are omitted.</p>
{"".join(charts) or "<p>No groups have enough earlier sessions. Collect more compatible practice dates.</p>"}
<section><details><summary>Individual session diagnostics</summary><div class="scroll"><table><tr><th>Club</th><th>Context</th><th>Session</th><th>Earlier dates</th><th>Shots</th><th>Method</th><th>RMSE (m)</th><th>Coverage</th></tr>{details}</table></div></details></section>
<p>The app still uses its existing baseline. A model comparison and future untouched sessions are needed before changing recommendations. Carry-only results do not validate lateral misses, rollout, or course outcomes.</p></main></html>"""
    (output / "report.html").write_text(html)
    return result
