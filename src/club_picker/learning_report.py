"""Local experiment artifacts and a standalone Ridge comparison walkthrough."""

import hashlib
import json
import random
import sys
from datetime import date, timedelta
from html import escape
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import cast

from club_picker.evaluation import Observation, observations
from club_picker.learning import FEATURES, Model, PointResult, experiment
from club_picker.trackman import read_object


def synthetic_exercise() -> list[Observation]:
    """Invent steady, improving, and reversing form without private aggregates."""
    rng = random.Random(417)
    rows: list[Observation] = []
    for club in range(3):
        for day in range(32):
            trend = (0.0, day * 0.65, min(day, 31 - day) * 0.9)[club]
            for _ in range(12):
                rows.append(
                    Observation(
                        ("invented", str(club)),
                        ("manual", "full"),
                        date(2030, 1, 1) + timedelta(days=day),
                        100 + club * 15 + trend + rng.gauss(0, 3),
                        ("Steady", "Trend", "Reversal")[club],
                    )
                )
    return rows


def _table(summary: dict[str, dict[str, float]], *, fitted: bool = False) -> str:
    rows = "".join(
        f"<tr><th>{escape(model.replace(' + fallback', '') if fitted else model)}</th><td>{values['rmse']:.2f}</td><td>{values['mae']:.2f}</td><td>{values['bias']:+.2f}</td></tr>"
        for model, values in summary.items()
    )
    return (
        '<div class="scroll"><table><tr><th>Method</th><th>RMSE (m)</th><th>MAE (m)</th><th>Bias (m)</th></tr>'
        + rows
        + "</table></div>"
    )


def render(result: dict[str, object], *, synthetic: bool) -> str:
    """Render point errors only; do not imply Ridge predicts risk or intervals."""
    points = [
        PointResult(**row)  # pyright: ignore[reportArgumentType]
        for row in cast(list[dict[str, object]], result["results"])
    ]
    fitted = [r for r in points if r.fitted and r.model == "Ridge + fallback"]
    fallback = [r for r in points if not r.fitted and r.model == "Ridge + fallback"]
    charts: list[str] = []
    colors = {
        "Stable mean": "#377b67",
        "Stable median": "#9871ad",
        "Recent mean": "#c26a36",
        "Ridge + fallback": "#2877b2",
    }
    for context in sorted(
        {r.context for r in fitted}, key=lambda value: int(value.split()[-1])
    ):
        group = [r for r in points if r.context == context and r.fitted]
        sessions = sorted({r.session for r in group})
        low = min(min(r.prediction, r.actual_mean) for r in group) - 3
        high = max(max(r.prediction, r.actual_mean) for r in group) + 3

        def x(session: int, sessions: list[int] = sessions) -> float:
            return 65 + sessions.index(session) * 610 / max(1, len(sessions) - 1)

        def y(value: float, low: float = low, high: float = high) -> float:
            return 235 - (value - low) / (high - low) * 200

        marks = ""
        for i in range(5):
            value = low + (high - low) * i / 4
            marks += f'<path d="M65 {y(value)}H690" stroke="#e0e6e1"/><text x="55" y="{y(value) + 4}" text-anchor="end">{value:.0f}</text>'
        for model, color in colors.items():
            selected = [r for r in group if r.model == model]
            vertices = " ".join(f"{x(r.session)},{y(r.prediction)}" for r in selected)
            marks += f'<polyline points="{vertices}" fill="none" stroke="{color}" stroke-width="2"/>'
            for r in selected:
                marks += f'<circle cx="{x(r.session)}" cy="{y(r.prediction)}" r="2" fill="{color}"/>'
                if model == "Ridge + fallback":
                    marks += f'<circle cx="{x(r.session)}" cy="{y(r.actual_mean)}" r="4" fill="#243a32"><title>Actual mean {r.actual_mean:.1f} m; prediction {r.prediction:.1f} m; {r.history_sessions} prior dates</title></circle><text x="{x(r.session)}" y="260" text-anchor="middle">{r.session}</text>'
        charts.append(
            f'<section><h2>{escape(group[0].club)} · {context}</h2><p>{len(sessions)} fitted evaluation dates · carry in metres</p><svg viewBox="0 0 740 285" role="img" aria-label="Predictions versus actual session means">{marks}</svg></section>'
        )
    per_club = cast(dict[str, dict[str, dict[str, float]]], result["per_club_fitted"])
    club_tables = "".join(
        f"<h3>{escape(club)}</h3>{_table(metrics, fitted=True)}"
        for club, metrics in per_club.items()
    )
    bands = cast(dict[str, dict[str, dict[str, float]]], result["history_bands"])
    band_tables = "".join(
        f"<h3>{escape(label)}</h3>{_table(metrics, fitted=True)}"
        for label, metrics in bands.items()
        if metrics
    )
    details = "".join(
        f"<tr><td>{escape(r.club)}</td><td>{r.session}</td><td>{r.history_sessions}</td><td>{r.shots}</td><td>{'Fitted' if r.fitted else 'Recent fallback'}</td><td>{r.rmse:.2f}</td></tr>"
        for r in points
        if r.model == "Ridge + fallback"
    )
    summary = cast(dict[str, dict[str, float]], result["summary_fitted_only"])
    conclusion = "Not enough compatible dates to evaluate Ridge. Collect more sessions; fallback is not a trained-model result."
    if summary:
        strongest = min(
            (name for name in summary if name != "Ridge + fallback"),
            key=lambda name: summary[name]["rmse"],
        )
        delta = summary["Ridge + fallback"]["rmse"] - summary[strongest]["rmse"]
        conclusion = f"On the fitted subset, Ridge error is {abs(delta):.2f} m {'higher' if delta >= 0 else 'lower'} than {strongest}. This is exploratory development evidence, not an adoption decision."
    coefficient_tables: list[str] = []
    for artifact in cast(list[dict[str, object]], result["final_models"]):
        model = Model(**cast(dict[str, object], artifact["fit"]))  # pyright: ignore[reportArgumentType]
        coefficients = "".join(
            f"<tr><td>{escape(name)}</td><td>{value:+.3f}</td></tr>"
            for name, value in zip(FEATURES, model.coefficients, strict=True)
        )
        coefficient_tables.append(
            f'<h3>{escape(str(artifact["context"]))}</h3><p>Alpha {model.alpha:g} · {model.training_examples} training dates · residual intercept {model.intercept:+.3f} m</p><div class="scroll"><table><tr><th>Standardized feature</th><th>Coefficient (m)</th></tr>{coefficients}</table></div>'
        )
    label = (
        "INVENTED LEARNING EXERCISE"
        if synthetic
        else "REAL PRACTICE · DEVELOPMENT BACKTEST"
    )
    legend = "".join(
        f'<span style="color:{color}">{escape(name.replace(" + fallback", ""))}</span>'
        for name, color in colors.items()
    )
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Caddie · First ML experiment</title>
<style>body{{font:16px/1.6 system-ui;background:#f5f7f3;color:#243a32;margin:0}}main{{max-width:1050px;margin:auto;padding:40px 24px}}section{{background:white;padding:24px;margin:24px 0;border:1px solid #dce5dd;border-radius:16px}}h1{{margin:8px 0}}h2{{font-size:22px}}table{{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}}th,td{{text-align:left;padding:12px;border-bottom:1px solid #e0e6e1;white-space:nowrap}}.scroll{{overflow:auto}}svg{{width:100%;min-width:600px}}section:has(svg){{overflow:auto}}svg text{{font:12px system-ui;fill:#53645b}}.legend{{display:flex;gap:24px;flex-wrap:wrap}}summary{{cursor:pointer;padding:12px}}p{{max-width:85ch}}</style>
<main><p>{label}</p><h1>Can a small model help?</h1><p>{conclusion}</p>
<section><h2>What the model learns</h2><p>Ridge learns a correction to the historical mean from four earlier-session measurements: recent average relative to the historical average, last average relative to history, change between the last two averages, and historical carry spread. Regularization discourages large coefficients.</p><p>Each physical club and measurement context gets its own model. Scaling and regularization selection use only earlier dates. At least 13 earlier dates are needed; otherwise the experiment uses the recent mean.</p></section>
<section><h2>The fair comparison: fitted dates only</h2><p>{len(fitted)} club/context/date predictions · {len({r.session for r in fitted})} distinct dates · {len({r.club for r in fitted})} clubs · {sum(r.shots for r in fitted)} shots</p>{_table(summary, fitted=True)}<p>Every method is scored on these same dates. Lower RMSE and MAE are better; positive bias means predicting too long. Metrics average dates within context, contexts within club, then clubs.</p></section>
<section><details><summary>All eligible dates, including fallback</summary><p>{len(fallback)} predictions used the recent-average fallback. These are not Ridge successes or failures.</p>{_table(cast(dict[str, dict[str, float]], result["summary_all"]))}</details></section>
<h2>Predictions before each session</h2><div class="legend">{legend}<span>● Actual session mean</span></div><p>Only fitted dates appear below. The vertical scale is zoomed and differs by chart. The horizontal axis is ordinal date order, not elapsed time. Dots are session averages; error metrics score individual shots. Ridge does not supply a prediction interval or hazard probability.</p>{"".join(charts)}
<section><details><summary>Errors by club</summary>{club_tables or "<p>No fitted dates.</p>"}</details></section>
<section><details><summary>Error by amount of earlier history</summary><p>Exploratory support bands, not a controlled learning curve: the clubs and dates differ between bands.</p>{band_tables or "<p>No fitted dates.</p>"}</details></section>
<section><details><summary>Individual Ridge and fallback diagnostics</summary><div class="scroll"><table><tr><th>Club</th><th>Session</th><th>Prior dates</th><th>Shots</th><th>Used</th><th>RMSE (m)</th></tr>{details}</table></div></details></section>
<section><details><summary>Final fitted coefficients</summary><p>These are the final fits on all development history, not the earlier fold fits used to score predictions. Each coefficient is the change in the predicted correction for one training standard deviation of that feature, holding the other features fixed. It is not a causal effect.</p>{"".join(coefficient_tables) or "<p>No final models have enough support.</p>"}</details></section>
<section><details><summary>How to reproduce and inspect the fit</summary><p>results.json contains every prediction, earlier validation scores, per-fold coefficients and final numeric models. Coefficients apply to standardized features; correlated features make causal interpretations inappropriate. The final fit uses all available development history and is not deployed. manifest.private.json records local provenance and must stay private.</p><p>Alphas: 0.1, 1, 10, 100. Each selection uses the latest three earlier expanding folds with at least eight training examples per fit. Each date contributes equally. Fitting the session-mean residual has the same coefficients as fitting individual-shot residuals with equal date weights.</p></details></section>
<p>No model has been promoted. This history was already explored; future untouched sessions are still needed. A carry improvement would not prove safer hazards, better club decisions, or lower scores.</p></main></html>"""


def write_experiment(snapshot: Path | None, output: Path) -> dict[str, object]:
    """Save a rerunnable local experiment with explicit synthetic provenance."""
    try:
        sklearn_version = version("scikit-learn")
    except PackageNotFoundError as error:
        raise ValueError("Install ML dependencies with uv sync --extra ml.") from error
    if snapshot is not None and snapshot.resolve() in {
        (output / name).resolve()
        for name in ("results.json", "report.html", "manifest.private.json")
    }:
        raise ValueError("Output must not overwrite the input snapshot.")
    excluded: dict[str, int] = {}
    if snapshot is None:
        rows = synthetic_exercise()
    else:
        rows, excluded = observations(read_object(snapshot))
    result = experiment(rows)
    result["data_kind"] = "invented" if snapshot is None else "supplied snapshot"
    result["excluded"] = excluded
    output.mkdir(parents=True, exist_ok=True)
    (output / "results.json").write_text(
        json.dumps(result, indent=2, allow_nan=False) + "\n"
    )
    (output / "report.html").write_text(render(result, synthetic=snapshot is None))
    manifest = {
        "input_sha256": hashlib.sha256(snapshot.read_bytes()).hexdigest()
        if snapshot
        else None,
        "input_path": str(snapshot.resolve()) if snapshot else None,
        "code_sha256": {
            name: hashlib.sha256(
                Path(__file__).with_name(name).read_bytes()
            ).hexdigest()
            for name in ("learning.py", "learning_report.py", "evaluation.py")
        },
        "scikit_learn": sklearn_version,
        "python": sys.version,
        "scipy": version("scipy"),
        "numpy": version("numpy"),
        "context_registry": [
            {
                "context": f"Context {i + 1}",
                "club": club,
                "measurement_context": context,
            }
            for i, (club, context) in enumerate(
                sorted({(r.club, r.context) for r in rows})
            )
        ],
    }
    (output / "manifest.private.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return result
