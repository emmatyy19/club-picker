"""Validate manual shot records without guessing provider field meanings."""

from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from math import isfinite


class Source(StrEnum):
    """Origin of the measurements, independent of the import format."""

    MANUAL = "manual"
    TRACKMAN = "trackman"
    TOPTRACER = "toptracer"


class Unit(StrEnum):
    """Supported distance units."""

    YARDS = "yd"
    METERS = "m"

    @property
    def meters(self) -> float:
        """Return the exact definition of one source unit in meters."""
        return 0.9144 if self == Unit.YARDS else 1.0


class Intent(StrEnum):
    """Intent known independently of a shot's outcome."""

    FULL = "full"
    PARTIAL = "partial"
    PUNCH = "punch"
    EXPERIMENT = "experiment"
    UNKNOWN = "unknown"


class Normalization(StrEnum):
    """Whether the provider adjusted flight conditions."""

    UNADJUSTED = "unadjusted"
    NORMALIZED = "normalized"
    UNKNOWN = "unknown"


class Compensation(StrEnum):
    """Whether range-ball compensation was enabled."""

    ON = "on"
    OFF = "off"
    UNKNOWN = "unknown"


class Basis(StrEnum):
    """Source-reported measurement basis for a distance."""

    MEASURED = "measured"
    MODELED = "modeled"
    UNKNOWN = "unknown"


class Quality(StrEnum):
    """Review state; ordinary mishits remain usable."""

    USABLE = "usable"
    SUSPECTED_ERROR = "suspected_error"
    EXCLUDED = "excluded"


REQUIRED_COLUMNS = (
    "session_id",
    "shot_id",
    "club_id",
    "club_label",
    "source",
    "distance_unit",
    "carry",
)
OPTIONAL_COLUMNS = (
    "session_date",
    "shot_intent",
    "normalization",
    "ball_compensation",
    "carry_side",
    "total",
    "total_side",
    "carry_basis",
    "total_basis",
    "quality",
    "exclusion_reason",
    "session_mode",
    "normalization_settings",
    "ball_type",
    "surface",
)
COLUMNS = REQUIRED_COLUMNS + OPTIONAL_COLUMNS


@dataclass(frozen=True)
class Shot:
    """A validated shot in meters, retaining its original unit and context."""

    session_id: str
    shot_id: str
    club_id: str
    club_label: str
    source: Source
    source_unit: Unit
    carry_m: float
    session_date: date | None
    intent: Intent
    normalization: Normalization
    compensation: Compensation
    carry_side_m: float | None
    total_m: float | None
    total_side_m: float | None
    carry_basis: Basis
    total_basis: Basis
    quality: Quality
    exclusion_reason: str
    session_mode: str
    normalization_settings: str
    ball_type: str
    surface: str

    @property
    def identity(self) -> tuple[str, str, str, str, str]:
        """Distinguish shots and adjusted variants without deduplicating values."""
        return (
            self.source,
            self.session_id,
            self.shot_id,
            self.normalization,
            self.compensation,
        )


def _required(row: dict[str, str], name: str) -> str:
    value = row.get(name, "").strip()
    if not value:
        raise ValueError(f"{name}: a value is required")
    if any(ord(character) < 32 for character in value):
        raise ValueError(f"{name}: control characters are not allowed")
    return value


def _choice[T: StrEnum](
    row: dict[str, str], name: str, kind: type[T], default: str = "unknown"
) -> T:
    value = row.get(name, "").strip() or default
    try:
        return kind(value)
    except ValueError:
        raise ValueError(f"{name}: choose from {', '.join(kind)}") from None


def _distance(row: dict[str, str], name: str, unit: Unit) -> float | None:
    value = row.get(name, "").strip()
    if not value:
        return None
    try:
        number = float(value) * unit.meters
    except ValueError:
        raise ValueError(f"{name}: expected a number") from None
    if not isfinite(number):
        raise ValueError(f"{name}: expected a finite number")
    if name in {"carry", "total"} and number < 0:
        raise ValueError(f"{name}: distance cannot be negative")
    return number


def parse_shot(row: dict[str, str]) -> Shot:
    """Parse one manual-v1 row, retaining unknowns and signed lateral distances."""
    for column in REQUIRED_COLUMNS:
        _required(row, column)
    unit = _choice(row, "distance_unit", Unit)
    carry = _distance(row, "carry", unit)
    assert carry is not None  # Required text and numerical validation above.
    date_text = row.get("session_date", "").strip()
    try:
        session_date = date.fromisoformat(date_text) if date_text else None
        if session_date and date_text != session_date.isoformat():
            raise ValueError
    except ValueError:
        raise ValueError("session_date: expected YYYY-MM-DD or blank") from None
    total = _distance(row, "total", unit)
    total_side = _distance(row, "total_side", unit)
    if total_side is not None and total is None:
        raise ValueError("total_side: requires total distance for the same shot")
    quality = _choice(row, "quality", Quality, "usable")
    reason = row.get("exclusion_reason", "").strip()
    if quality != Quality.USABLE and not reason:
        raise ValueError("exclusion_reason: required for flagged or excluded shots")
    if quality == Quality.USABLE and reason:
        raise ValueError("quality: an exclusion reason requires a flagged state")
    return Shot(
        session_id=_required(row, "session_id"),
        shot_id=_required(row, "shot_id"),
        club_id=_required(row, "club_id"),
        club_label=_required(row, "club_label"),
        source=_choice(row, "source", Source),
        source_unit=unit,
        carry_m=carry,
        session_date=session_date,
        intent=_choice(row, "shot_intent", Intent),
        normalization=_choice(row, "normalization", Normalization),
        compensation=_choice(row, "ball_compensation", Compensation),
        carry_side_m=_distance(row, "carry_side", unit),
        total_m=total,
        total_side_m=total_side,
        carry_basis=_choice(row, "carry_basis", Basis),
        total_basis=_choice(row, "total_basis", Basis),
        quality=quality,
        exclusion_reason=reason,
        session_mode=_context(row, "session_mode"),
        normalization_settings=_context(row, "normalization_settings"),
        ball_type=_context(row, "ball_type"),
        surface=_context(row, "surface"),
    )


def _context(row: dict[str, str], name: str) -> str:
    """Keep known session settings as text without inventing provider semantics."""
    return _required({name: row.get(name, "").strip() or "unknown"}, name)
