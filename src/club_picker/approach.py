"""Reference calculations for the local, descriptive approach picker."""

from dataclasses import dataclass
from math import isfinite


@dataclass(frozen=True)
class CarrySummary:
    """Session-balanced empirical carry statistics, in the input distance unit."""

    low: float
    median: float
    high: float
    shots: int
    sessions: int


def summarize_carry(sessions: list[list[float]]) -> CarrySummary:
    """Give each session equal mass and calculate empirical 10/50/90 percentiles.

    At an exact cumulative-mass boundary, average the adjacent values. These
    are descriptive quantiles, not a calibrated next-shot prediction interval.
    """
    if not sessions or any(
        not session or any(not isfinite(v) or v < 0 for v in session)
        for session in sessions
    ):
        raise ValueError("Carry sessions must contain finite, nonnegative distances.")
    points = sorted(
        (value, 1 / len(sessions) / len(session))
        for session in sessions
        for value in session
    )

    def quantile(p: float) -> float:
        mass = 0.0
        for i, (value, weight) in enumerate(points):
            mass += weight
            if abs(mass - p) < 1e-10:
                return (value + points[min(i + 1, len(points) - 1)][0]) / 2
            if mass > p:
                return value
        return points[-1][0]

    return CarrySummary(
        low=quantile(0.1),
        median=quantile(0.5),
        high=quantile(0.9),
        shots=len(points),
        sessions=len(sessions),
    )


def approach_target(
    distance: float,
    *,
    plays_like: float | None = None,
    angle: float | None = None,
    unit: str = "yd",
) -> float:
    """Return target carry in metres, using plays-like yardage exactly once.

    The signed angle is validated context only. No slope model is applied.
    """
    if unit not in {"yd", "m"}:
        raise ValueError("Unit must be yd or m.")
    if any(
        not isfinite(v) or v <= 0
        for v in [distance, *([] if plays_like is None else [plays_like])]
    ):
        raise ValueError("Enter a distance greater than zero.")
    if angle is not None and (not isfinite(angle) or abs(angle) >= 90):
        raise ValueError("Slope angle must be between -90 and 90 degrees.")
    return (distance if plays_like is None else plays_like) * (
        0.9144 if unit == "yd" else 1
    )
