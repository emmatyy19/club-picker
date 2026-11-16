"""Compare two flight clusters with a speed-only split on later practice dates."""

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from statistics import fmean
from typing import Any

from club_picker.practice_data import PracticeShot

Point = tuple[float, float]


@dataclass(frozen=True)
class PatternResult:
    """Summarize later-date errors and recurrence with equal weight per date."""

    training_dates: int
    training_shots: int
    later_shots: tuple[int, ...]
    speed_split_mps: float
    centers_speed_mps_launch_deg: tuple[Point, ...]
    speed_split_error: float
    cluster_error: float
    later_cluster_counts: tuple[tuple[int, int], ...]
    leave_one_date_out_agreement: float


def _fit_clusters(points: list[Point], weights: list[float]) -> tuple[Any, Any]:
    from sklearn.cluster import KMeans  # pyright: ignore[reportMissingTypeStubs]
    from sklearn.preprocessing import (  # pyright: ignore[reportMissingTypeStubs]
        StandardScaler,
    )

    if len(set(points)) < 2:
        raise ValueError("Two distinct training shots are required to fit clusters.")
    scaler: Any = StandardScaler()
    scaler.fit(points, sample_weight=weights)
    # The installed sklearn accepts an integer restart count.
    model: Any = KMeans(n_clusters=2, n_init=10, random_state=17)  # pyright: ignore[reportArgumentType]
    model.fit(scaler.transform(points), sample_weight=weights)
    return scaler, model


def _training(dates: Sequence[list[Point]]) -> tuple[list[Point], list[float]]:
    return (
        [point for day in dates for point in day],
        [1 / len(day) for day in dates for _ in day],
    )


def compare_patterns(days: dict[date, list[Point]]) -> PatternResult:
    """Fit on earlier eligible dates and score the final three in time order."""
    eligible = [rows for _, rows in sorted(days.items()) if len(rows) >= 5]
    if len(eligible) < 7:
        raise ValueError(
            "Need four training and three later dates of five paired shots."
        )
    training, later = eligible[:-3], eligible[-3:]
    points, weights = _training(training)
    half_mass = sum(weights) / 2
    cumulative = 0.0
    threshold = 0.0
    for (speed, _), weight in sorted(zip(points, weights, strict=True)):
        cumulative += weight
        if cumulative >= half_mass:
            threshold = speed
            break
    scaler, model = _fit_clusters(points, weights)
    centers: list[Point] = []
    for faster in (False, True):
        subset = [
            (point, weight)
            for point, weight in zip(points, weights, strict=True)
            if (point[0] > threshold) == faster
        ]
        if not subset:
            raise ValueError("Training speed split needs two populated groups.")
        mass = sum(w for _, w in subset)
        centers.append(
            (
                sum(p[0] * w for p, w in subset) / mass,
                sum(p[1] * w for p, w in subset) / mass,
            )
        )
    baseline: Any = scaler.transform(centers)
    physical: Any = scaler.inverse_transform(model.cluster_centers_)
    slow = min(range(2), key=lambda i: float(physical[i][0]))
    counts: list[tuple[int, int]] = []
    speed_errors: list[float] = []
    cluster_errors: list[float] = []
    labels: list[list[int]] = []
    for day in later:
        values: Any = scaler.transform(day)
        groups = [int(i) for i in model.predict(values)]
        labels.append(groups)
        counts.append((groups.count(slow), len(day) - groups.count(slow)))
        speed_errors.append(
            fmean(
                float(sum((v - baseline[int(p[0] > threshold)]) ** 2))
                for v, p in zip(values, day, strict=True)
            )
        )
        cluster_errors.append(
            fmean(
                float(sum((v - model.cluster_centers_[i]) ** 2))
                for v, i in zip(values, groups, strict=True)
            )
        )
    agreement: list[float] = []
    for i in range(len(training)):
        scale, fit = _fit_clusters(*_training(training[:i] + training[i + 1 :]))
        match = fmean(
            fmean(
                int(a == b)
                for a, b in zip(
                    original, fit.predict(scale.transform(day)), strict=True
                )
            )
            for original, day in zip(labels, later, strict=True)
        )
        agreement.append(max(match, 1 - match))  # Cluster numbers are arbitrary.
    return PatternResult(
        len(training),
        len(points),
        tuple(map(len, later)),
        threshold,
        tuple((float(physical[i][0]), float(physical[i][1])) for i in (slow, 1 - slow)),
        fmean(speed_errors),
        fmean(cluster_errors),
        tuple(counts),
        fmean(agreement),
    )


def pattern_days(
    rows: Sequence[PracticeShot], club_id: str, source: str
) -> dict[date, list[Point]]:
    """Collect paired usable shots for one physical club and compatible context."""
    selected = [
        r
        for r in rows
        if r.shot.club_id == club_id
        and r.shot.source == source
        and r.shot.quality == "usable"
    ]
    if len({r.context for r in selected}) > 1:
        raise ValueError(
            "Multiple measurement contexts. Supply a single-context snapshot."
        )
    days: dict[date, list[Point]] = defaultdict(list)
    for row in selected:
        speed, launch = row.value("ball_speed_mps"), row.value("launch_deg")
        if row.shot.session_date and speed is not None and launch is not None:
            days[row.shot.session_date].append((speed, launch))
    return days
