"""Verify measurement definitions and explicit unknowns at the boundary."""

import pytest

from club_picker.shots import Intent, Normalization, Quality, parse_shot


def test_converts_all_distances_and_keeps_signs(record: dict[str, str]) -> None:
    """Yards convert consistently for carry, rollout, and both lateral fields."""
    shot = parse_shot(
        record | {"carry_side": "-10", "total": "150", "total_side": "12"}
    )
    assert shot.carry_m == pytest.approx(128.016)
    assert shot.carry_side_m == pytest.approx(-9.144)
    assert shot.total_m == pytest.approx(137.16)
    assert shot.total_side_m == pytest.approx(10.9728)


def test_missing_is_not_zero_or_full_swing(record: dict[str, str]) -> None:
    """Omitted context and distances must remain unknown."""
    for key in ("session_date", "shot_intent", "normalization"):
        record.pop(key)
    shot = parse_shot(record | {"distance_unit": "m", "carry_side": "0"})
    assert shot.carry_m == 140
    assert shot.carry_side_m == 0
    assert shot.total_m is None
    assert shot.total_side_m is None
    assert shot.session_date is None
    assert shot.intent == Intent.UNKNOWN
    assert shot.normalization == Normalization.UNKNOWN


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("carry", "nan"),
        ("carry", "inf"),
        ("carry", "1e999"),
        ("carry", "-1"),
        ("carry", ""),
        ("carry", "not a number"),
        ("total", "-10"),
        ("carry_side", "NaN"),
        ("total_side", "5"),
        ("distance_unit", "feet"),
        ("source", "unknown-provider"),
        ("shot_intent", "stock"),
        ("normalization", "yes"),
        ("session_date", "2026-02-30"),
        ("session_date", "20260101"),
        ("club_id", ""),
        ("shot_id", "bad\nidentifier"),
        ("quality", "excluded"),
        ("exclusion_reason", "unflagged reason"),
    ],
)
def test_invalid_fields_fail(record: dict[str, str], field: str, value: str) -> None:
    """Invalid values never become apparently usable observations."""
    with pytest.raises(ValueError):
        parse_shot(record | {field: value})


def test_mishits_retained_and_errors_require_reasons(record: dict[str, str]) -> None:
    """There is no yardage threshold that silently removes a poor golf shot."""
    assert parse_shot(record | {"carry": "0"}).quality == Quality.USABLE
    flagged = parse_shot(
        record | {"quality": "suspected_error", "exclusion_reason": "double capture"}
    )
    assert flagged.quality == Quality.SUSPECTED_ERROR
