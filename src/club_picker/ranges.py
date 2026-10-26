"""Diagnose historical carry-range coverage without fitting a correction."""

from collections import defaultdict
from dataclasses import asdict, dataclass
from statistics import fmean

from club_picker.evaluation import Observation, backtest, distribution, quantile


@dataclass(frozen=True)
class RangeResult:
    """Matched range diagnostics for one club/context/date, in metres."""

    club: str
    context: str
    session: int
    method: str
    history_sessions: int
    shots: int
    low: float
    high: float
    short: float
    inside: float
    long: float
    width: float
    interval_score: float
    historical_coverage: float
    median_shift: float


def interval_outcomes(
    actual: list[float], low: float, high: float
) -> tuple[float, float, float, float]:
    """Count inclusive coverage and the nominal 80% interval score.

    Miss penalties are 2/alpha = 10 times the miss distance, with alpha=0.2.
    Lower score rewards narrow ranges while penalizing missed outcomes.
    """
    distribution([actual])
    distribution([[low, high]])
    if low > high:
        raise ValueError("Range boundaries are reversed.")
    return (
        fmean(v < low for v in actual),
        fmean(low <= v <= high for v in actual),
        fmean(v > high for v in actual),
        fmean(
            high - low + 10 * max(low - v, 0) + 10 * max(v - high, 0) for v in actual
        ),
    )


def diagnose(rows: list[Observation]) -> list[RangeResult]:
    """Replay unchanged baseline ranges, retaining short and long misses."""
    baseline, _ = backtest(rows)
    lookup = {(f.context, f.session, f.model): f for f in baseline}
    days = {day: i + 1 for i, day in enumerate(sorted({r.day for r in rows}))}
    groups: dict[tuple[tuple[str, str], tuple[str, ...]], dict[int, list[float]]] = (
        defaultdict(lambda: defaultdict(list))
    )
    for row in rows:
        groups[row.club, row.context][days[row.day]].append(row.carry)
    result: list[RangeResult] = []
    for i, (_, sessions) in enumerate(sorted(groups.items())):
        context = f"Context {i + 1}"
        history: list[list[float]] = []
        for day, actual in sorted(sessions.items()):
            if len(history) >= 2:
                for name, half_life in (("Stable mean", None), ("Recent mean", 3)):
                    fold = lookup[context, day, name]
                    points = distribution(history, half_life=half_life)
                    short, inside, long, score = interval_outcomes(
                        actual, fold.low, fold.high
                    )
                    result.append(
                        RangeResult(
                            fold.club,
                            context,
                            day,
                            "Stable range" if half_life is None else "Recent range",
                            len(history),
                            len(actual),
                            fold.low,
                            fold.high,
                            short,
                            inside,
                            long,
                            fold.width,
                            score,
                            sum(w for v, w in points if fold.low <= v <= fold.high),
                            quantile(distribution([actual]), 0.5)
                            - quantile(points, 0.5),
                        )
                    )
            history.append(actual)
    return result


def summarize(rows: list[RangeResult]) -> dict[str, float]:
    """Balance contexts within clubs and dates within contexts; retain support."""
    if not rows:
        return {}
    if len({r.method for r in rows}) > 1:
        raise ValueError("Summarize one method at a time.")
    summary: dict[str, float] = {}
    for metric in (
        "short",
        "inside",
        "long",
        "width",
        "interval_score",
        "historical_coverage",
        "median_shift",
    ):
        contexts: dict[tuple[str, str], list[float]] = defaultdict(list)
        for row in rows:
            contexts[row.club, row.context].append(float(getattr(row, metric)))
        clubs: dict[str, list[float]] = defaultdict(list)
        for (club, _), values in contexts.items():
            clubs[club].append(fmean(values))
        summary[metric] = fmean(fmean(values) for values in clubs.values())
    summary.update(
        groups=len(rows),
        dates=len({r.session for r in rows}),
        clubs=len({r.club for r in rows}),
        shots=sum(r.shots for r in rows),
        pooled_shot_coverage=sum(r.inside * r.shots for r in rows)
        / sum(r.shots for r in rows),
        min_session_coverage=min(r.inside for r in rows),
        max_session_coverage=max(r.inside for r in rows),
    )
    return summary


def range_analysis(rows: list[Observation]) -> dict[str, object]:
    """Build reproducible breakdowns with unchanged range definitions."""
    diagnostics = diagnose(rows)
    methods = ("Stable range", "Recent range")
    return {
        "schema_version": 1,
        "status": "descriptive development investigation; no calibrated adjustment",
        "unit": "m",
        "config": {
            "nominal_coverage": 0.8,
            "min_history": 2,
            "recent_half_life_sessions": 3,
            "history_bands": ["2-4", "5-9", "10+"],
        },
        "summary": {
            method: summarize([r for r in diagnostics if r.method == method])
            for method in methods
        },
        "by_context": [
            {
                "club": club,
                "context": context,
                "methods": {
                    method: summarize(
                        [
                            r
                            for r in diagnostics
                            if (r.club, r.context, r.method) == (club, context, method)
                        ]
                    )
                    for method in methods
                },
            }
            for club, context in sorted({(r.club, r.context) for r in diagnostics})
        ],
        "by_history": {
            label: {
                method: summarize(
                    [
                        r
                        for r in diagnostics
                        if r.method == method and low <= r.history_sessions <= high
                    ]
                )
                for method in methods
            }
            for label, low, high in (
                ("2-4", 2, 4),
                ("5-9", 5, 9),
                ("10+", 10, float("inf")),
            )
        },
        "folds": [asdict(r) for r in diagnostics],
    }
