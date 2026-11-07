"""Validate private explorer measurements for descriptive practice reports."""

from dataclasses import dataclass, fields, replace
from math import isfinite

from club_picker.shots import Shot, Unit, parse_shot
from club_picker.trackman import FLIGHT, array_value, object_value, text_value

CONTEXT_FIELDS = (
    "source",
    "intent",
    "normalization",
    "compensation",
    "carry_basis",
    "total_basis",
    "session_mode",
    "normalization_settings",
    "ball_type",
    "surface",
)
METRICS = ("carry_m", "total_m", "carry_side_m", "total_side_m")
DISTANCES = (*METRICS, "apex_m", "curve_m")


@dataclass(frozen=True)
class PracticeShot:
    """Validated SI shot with physical set and optional flight fields."""

    shot: Shot
    set_id: str
    flight: dict[str, float | None]
    total_geometry: str = "unknown"

    @property
    def context(self) -> tuple[str, ...]:
        """Keep provider, intent, normalization and measurement bases distinct."""
        return tuple(str(getattr(self.shot, k)) for k in CONTEXT_FIELDS)

    def value(self, metric: str) -> float | None:
        """Read only a known, validated measurement without missing substitution."""
        if metric in METRICS:
            value: float | None = getattr(self.shot, metric)
            return value
        return self.flight.get(metric)


def _number(value: object, field: str) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise ValueError(f"{field}: expected a numeric measurement")
    result = float(value)
    if not isfinite(result):
        raise ValueError(f"{field}: expected a finite measurement")
    if field in {"launch_deg", "landing_deg"}:
        if not -90 <= result <= 90:
            raise ValueError(f"{field}: angle outside -90 to 90")
    elif field not in {"carry_side_m", "total_side_m", "curve_m"} and result < 0:
        raise ValueError(f"{field}: cannot be negative")
    return result


def practice_shots(payload: dict[str, object]) -> tuple[list[PracticeShot], int]:
    """Validate SI snapshot boundaries, deduplicate equals and reject conflicts."""
    if (
        set(payload) != {"kind", "version", "distance_unit", "shots"}
        or (payload.get("kind"), payload.get("version"), payload.get("distance_unit"))
        != ("club-picker-explorer", 1, "m")
        or isinstance(payload["version"], bool)
    ):
        raise ValueError("Expected a version 1 explorer snapshot in metres")
    allowed = {f.name for f in fields(Shot)} | {
        "set_id",
        "total_distance_geometry",
        *FLIGHT,
    }
    distances = {k: k.removesuffix("_m") for k in METRICS}
    aliases = {"intent": "shot_intent", "compensation": "ball_compensation"}
    numeric = set(METRICS) | set(FLIGHT)
    seen: dict[tuple[str, ...], PracticeShot] = {}
    clubs: dict[str, tuple[str, str]] = {}
    sessions: dict[tuple[str, str], tuple[str, object]] = {}
    duplicates = 0
    for raw in array_value(payload["shots"]):
        row = object_value(raw)
        if set(row) - allowed:
            raise ValueError("Unrecognized explorer shot fields")
        geometry = text_value(row.get("total_distance_geometry", "unknown"))
        if geometry not in {"radial", "unknown"}:
            raise ValueError("Unrecognized total distance geometry")
        record: dict[str, str] = {"distance_unit": "m"}
        for key, value in row.items():
            if key in numeric:
                measurement = _number(value, key)
                if key in distances:
                    record[distances[key]] = (
                        "" if measurement is None else str(measurement)
                    )
            elif key not in {"set_id", "source_unit", "total_distance_geometry"}:
                if value is not None and not isinstance(value, str):
                    raise ValueError(f"{key}: expected text")
                record[aliases.get(key, key)] = "" if value is None else str(value)
        shot = parse_shot(record)
        source_unit = Unit(text_value(row.get("source_unit")))
        shot = replace(shot, source_unit=source_unit)
        set_id = text_value(row.get("set_id")).strip()
        club = (set_id, shot.club_label)
        if shot.club_id in clubs and clubs[shot.club_id] != club:
            raise ValueError("Conflicting physical club identity")
        clubs[shot.club_id] = club
        session = (str(shot.source), shot.session_id)
        context = (set_id, shot.session_date)
        if session in sessions and sessions[session] != context:
            raise ValueError("Conflicting session date or set")
        sessions[session] = context
        parsed = PracticeShot(
            shot, set_id, {k: _number(row.get(k), k) for k in FLIGHT}, geometry
        )
        if shot.identity in seen:
            if seen[shot.identity] != parsed:
                raise ValueError("Conflicting duplicate shot")
            duplicates += 1
        else:
            seen[shot.identity] = parsed
    return list(seen.values()), duplicates
