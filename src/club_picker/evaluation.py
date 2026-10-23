"""Chronological carry backtests with no fitted settings or app side effects."""

import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import date
from math import isfinite, sqrt
from statistics import fmean
from typing import cast

from club_picker.shots import parse_shot
from club_picker.trackman import object_value

CONTEXT_FIELDS = (
    "source",
    "intent",
    "normalization",
    "compensation",
    "carry_basis",
    "session_mode",
    "normalization_settings",
    "ball_type",
    "surface",
)


@dataclass(frozen=True)
class Observation:
    """Minimal validated carry record; private identifiers never enter reports."""

    club: tuple[str, str]
    context: tuple[str, ...]
    day: date
    carry: float
    label: str = "Club"


def observations(
    payload: dict[str, object],
) -> tuple[list[Observation], dict[str, int]]:
    """Validate a snapshot and audit exclusions, deduplicating identical records."""
    if (payload.get("kind"), payload.get("version"), payload.get("distance_unit")) != (
        "club-picker-explorer",
        1,
        "m",
    ):
        raise ValueError("Expected a version 1 explorer snapshot in metres.")
    rows = payload.get("shots")
    if not isinstance(rows, list):
        raise ValueError("Snapshot shots must be a list.")
    seen: dict[tuple[str, ...], dict[str, object]] = {}
    labels: dict[tuple[str, str], str] = {}
    dates: dict[tuple[str, str, str], date | None] = {}
    result: list[Observation] = []
    excluded: Counter[str] = Counter()
    aliases = {"shot_intent": "intent", "ball_compensation": "compensation"}
    for raw in cast(list[object], rows):
        row = object_value(raw)
        set_id = row.get("set_id")
        if not isinstance(set_id, str) or not set_id.strip():
            raise ValueError("Every shot needs a physical club set.")
        record: dict[str, str] = {"distance_unit": "m"}
        for key in (
            "session_id",
            "shot_id",
            "club_id",
            "club_label",
            "source",
            "session_date",
            "shot_intent",
            "normalization",
            "ball_compensation",
            "carry_basis",
            "total_basis",
            "quality",
            "exclusion_reason",
            "session_mode",
            "normalization_settings",
            "ball_type",
            "surface",
        ):
            value = row.get(aliases.get(key, key))
            if value is not None and not isinstance(value, str):
                raise ValueError(f"{key} must be text.")
            record[key] = str(value) if value is not None else ""
        carry = row.get("carry_m")
        if isinstance(carry, bool) or not isinstance(carry, (float, int)):
            raise ValueError("carry_m must be a finite nonnegative number.")
        record["carry"] = str(carry)
        shot = parse_shot(record)
        identity = (set_id, *shot.identity)
        if identity in seen:
            if seen[identity] != row:
                raise ValueError("Conflicting duplicate shot.")
            excluded["duplicate"] += 1
            continue
        seen[identity] = row
        session = (set_id, str(shot.source), shot.session_id)
        if session in dates and dates[session] != shot.session_date:
            raise ValueError("Conflicting session dates.")
        dates[session] = shot.session_date
        club = (set_id, shot.club_id)
        if club in labels and labels[club] != shot.club_label:
            raise ValueError("Conflicting physical club label.")
        labels[club] = shot.club_label
        label = shot.club_label.lower()
        if shot.quality != "usable":
            excluded["flagged"] += 1
        elif shot.intent not in {"full", "unknown"}:
            excluded["other intent"] += 1
        elif shot.session_date is None:
            excluded["undated"] += 1
        elif not re.fullmatch(
            r"(?:[2-9]|1[0-9]) (?:iron|wood|hybrid)|(?:[3-6][0-9](?:°| degree)? )?wedge|[pagsl]w",
            label,
        ):
            excluded["outside approach clubs"] += 1
        else:
            fields = asdict(shot)
            result.append(
                Observation(
                    club,
                    tuple(str(fields[k]) for k in CONTEXT_FIELDS),
                    shot.session_date,
                    shot.carry_m,
                    label,
                )
            )
    return result, dict(excluded)


def distribution(
    sessions: list[list[float]], *, half_life: float | None = None
) -> list[tuple[float, float]]:
    """Weight each date equally, or decay mass by ordinal session age."""
    if not sessions or any(
        not s or any(not isfinite(v) or v < 0 for v in s) for s in sessions
    ):
        raise ValueError("Expected nonempty finite carry sessions.")
    if half_life is not None and (not isfinite(half_life) or half_life <= 0):
        raise ValueError("Half-life must be positive.")
    weights = [
        1.0 if half_life is None else 2 ** (-(len(sessions) - 1 - i) / half_life)
        for i in range(len(sessions))
    ]
    mass = sum(weights)
    return sorted(
        (v, weight / mass / len(s))
        for s, weight in zip(sessions, weights, strict=True)
        for v in s
    )


def quantile(points: list[tuple[float, float]], p: float) -> float:
    """Use the app's empirical cumulative-mass boundary convention."""
    mass = 0.0
    for i, (value, weight) in enumerate(points):
        mass += weight
        if abs(mass - p) < 1e-10:
            return (value + points[min(i + 1, len(points) - 1)][0]) / 2
        if mass > p:
            return value
    return points[-1][0]


@dataclass(frozen=True)
class Fold:
    """One context/date prediction, anonymized to ordinal labels and metres."""

    club: str
    context: str
    session: int
    history_sessions: int
    shots: int
    model: str
    prediction: float
    actual_mean: float
    rmse: float
    mae: float
    bias: float
    low: float
    high: float
    coverage: float
    width: float
    clearance_brier: float


def backtest(
    rows: list[Observation], *, min_history: int = 2, half_life: float = 3
) -> tuple[list[Fold], int]:
    """Replay whole dates, sharing no shots across the chronological boundary."""
    if min_history < 1 or not isfinite(half_life) or half_life <= 0:
        raise ValueError("Invalid backtest settings.")
    groups: dict[tuple[tuple[str, str], tuple[str, ...]], dict[date, list[float]]] = (
        defaultdict(lambda: defaultdict(list))
    )
    for row in rows:
        groups[row.club, row.context][row.day].append(row.carry)
    set_numbers = {
        value: i + 1 for i, value in enumerate(sorted({r.club[0] for r in rows}))
    }
    labels = {r.club: r.label for r in rows}
    clubs = {
        club: f"{labels[club]} · Set {set_numbers[club[0]]} · Club {i + 1}"
        for i, club in enumerate(sorted(labels))
    }
    days = {day: i + 1 for i, day in enumerate(sorted({r.day for r in rows}))}
    folds: list[Fold] = []
    warmup = 0
    for index, ((club, _), sessions) in enumerate(sorted(groups.items())):
        history: list[list[float]] = []
        for day, actual in sorted(sessions.items()):
            if len(history) < min_history:
                warmup += len(actual)
                history.append(actual)
                continue
            stable = distribution(history)
            recent = distribution(history, half_life=half_life)
            boundary = quantile(stable, 0.5)
            for model, points, prediction in (
                ("Stable mean", stable, sum(v * w for v, w in stable)),
                ("Stable median", stable, boundary),
                ("Recent mean", recent, sum(v * w for v, w in recent)),
            ):
                low, high = quantile(points, 0.1), quantile(points, 0.9)
                probability = sum(w for v, w in points if v > boundary)
                errors = [prediction - value for value in actual]
                folds.append(
                    Fold(
                        clubs[club],
                        f"Context {index + 1}",
                        days[day],
                        len(history),
                        len(actual),
                        model,
                        prediction,
                        fmean(actual),
                        sqrt(fmean(e * e for e in errors)),
                        fmean(abs(e) for e in errors),
                        fmean(errors),
                        low,
                        high,
                        fmean(low <= v <= high for v in actual),
                        high - low,
                        fmean((probability - (v > boundary)) ** 2 for v in actual),
                    )
                )
            history.append(actual)
    return folds, warmup


def aggregate(folds: list[Fold]) -> dict[str, dict[str, float]]:
    """Average dates within contexts, contexts within clubs, then clubs equally."""
    output: dict[str, dict[str, float]] = {}
    for model in sorted({fold.model for fold in folds}):
        metrics: dict[str, float] = {}
        for metric in ("rmse", "mae", "bias", "coverage", "width", "clearance_brier"):
            groups: dict[tuple[str, str], list[float]] = defaultdict(list)
            for fold in folds:
                if fold.model == model:
                    groups[fold.club, fold.context].append(float(getattr(fold, metric)))
            clubs: dict[str, list[float]] = defaultdict(list)
            for (club, _), values in groups.items():
                clubs[club].append(fmean(values))
            metrics[metric] = fmean(fmean(values) for values in clubs.values())
        output[model] = metrics
    return output
