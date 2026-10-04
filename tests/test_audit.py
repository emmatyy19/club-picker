"""Keep summaries honest about compatible groups, chronology, and support."""

import pytest

from club_picker.audit import audit_shots
from club_picker.shots import Unit, parse_shot


def test_summary_separates_context_and_retains_mishits(record: dict[str, str]) -> None:
    """A real short mishit remains in the observed range; flagged errors do not."""
    records = [
        record,
        record | {"shot_id": "2", "carry": "20", "carry_side": "0"},
        record
        | {
            "shot_id": "3",
            "carry": "500",
            "quality": "excluded",
            "exclusion_reason": "tracking",
        },
        record | {"shot_id": "4", "shot_intent": "partial"},
        record | {"shot_id": "5", "normalization": "normalized"},
        record | {"shot_id": "6", "source": "toptracer"},
        record | {"shot_id": "7", "ball_compensation": "on"},
        record | {"shot_id": "8", "carry_basis": "modeled"},
    ]
    audit = audit_shots([parse_shot(row) for row in records])
    assert audit["total_shots"] == 8
    assert audit["usable_shots"] == 7
    assert audit["flagged_shots"] == 1
    assert len(audit["groups"]) == 6
    group = next(group for group in audit["groups"] if group["shots"] == 2)
    assert group["carry_min"] == pytest.approx(20)
    assert group["carry_median"] == pytest.approx(80)
    assert group["carry_max"] == pytest.approx(140)
    assert group["carry_side_shots"] == 1


def test_session_order_uses_dates_not_import_order(record: dict[str, str]) -> None:
    """Undated sessions remain unplaced instead of using an invented date."""
    shots = [
        parse_shot(record | {"session_id": "later", "session_date": "2026-02-01"}),
        parse_shot(record),
        parse_shot(record | {"session_id": "unknown", "session_date": ""}),
    ]
    audit = audit_shots(shots, unit=Unit.METERS)
    assert [session["session_id"] for session in audit["session_order"]] == [
        "invented-session-1",
        "later",
    ]
    assert audit["undated_shots"] == 1
    assert audit["groups"][0]["sessions"] == 3
    assert audit["groups"][0]["dated_sessions"] == 2
    assert audit["groups"][0]["carry_median"] == pytest.approx(128.016)


def test_empty_audit_is_explicit() -> None:
    """An empty store produces no invented profiles."""
    audit = audit_shots([])
    assert audit["total_shots"] == 0
    assert audit["groups"] == []


@pytest.mark.parametrize(
    "field", ["session_mode", "normalization_settings", "ball_type", "surface"]
)
def test_known_context_is_not_pooled(record: dict[str, str], field: str) -> None:
    """Known settings stay distinct from unknown or different settings."""
    shots = [
        parse_shot(record),
        parse_shot(record | {"shot_id": "2", field: "different"}),
    ]
    assert len(audit_shots(shots)["groups"]) == 2
