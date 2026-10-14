"""Check the private explorer boundary using invented measurements."""

import json
from collections.abc import Callable
from pathlib import Path

import pytest

from club_picker.cli import main
from club_picker.explorer import explorer_snapshot
from club_picker.shots import parse_shot


def test_units_unknowns_dedup_and_assignment(record: dict[str, str]) -> None:
    """Keep meters and unknowns while requiring an explicit physical set."""
    shot = parse_shot(record)
    with pytest.raises(ValueError, match="assignment required"):
        explorer_snapshot([shot], session_sets={})
    result = explorer_snapshot(
        [shot, shot], session_sets={("manual", shot.session_id): "bag-a"}
    )
    assert len(result["shots"]) == 1
    row = result["shots"][0]
    assert row["carry_m"] == pytest.approx(128.016)
    assert row["total_m"] is None
    assert row["carry_side_m"] is None
    assert row["set_id"] == "bag-a"
    assert row["session_date"] == "2026-01-01"
    assert result["distance_unit"] == "m"


def test_conflicts(record: dict[str, str]) -> None:
    """Reject shot, equipment, and session-date conflicts without dropping rows."""
    shot = parse_shot(record)
    assignments = {("manual", shot.session_id): "bag-a"}
    for change, message in [
        ({"carry": "150"}, "shot identity"),
        ({"club_label": "6 iron"}, "physical club"),
        ({"session_date": "2026-01-02"}, "session dates"),
    ]:
        with pytest.raises(ValueError, match=message):
            explorer_snapshot(
                [shot, parse_shot(record | change)], session_sets=assignments
            )
    second = parse_shot(record | {"session_id": "another-session"})
    with pytest.raises(ValueError, match="physical club"):
        explorer_snapshot(
            [shot, second],
            session_sets=assignments | {("manual", "another-session"): "bag-b"},
        )


def test_snapshot_cli(
    tmp_path: Path,
    record: dict[str, str],
    csv_bytes: Callable[[list[dict[str, str]]], bytes],
) -> None:
    """Export reviewed data without modifying the personal database."""
    file = tmp_path / "input.csv"
    output = tmp_path / "private" / "snapshot.json"
    file.write_bytes(csv_bytes([record]))
    args = ["snapshot", str(file), "--output", str(output), "--session-set"]
    assert main([*args, "manual/invented-session-1=bag-a"]) == 0
    assert json.loads(output.read_text())["shots"][0]["set_id"] == "bag-a"
    original = output.read_bytes()
    assert main([*args, "invalid"]) == 2
    assert main([*args, "manual/wrong-session=bag-a"]) == 2
    assert output.read_bytes() == original
    file.write_text("not,a,valid,csv")
    assert main([*args, "manual/invented-session-1=bag-a"]) == 2
    assert output.read_bytes() == original
