"""Invented chronological examples, including leakage and weighting checks."""

import json
from dataclasses import replace
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from club_picker.cli import main
from club_picker.evaluation import (
    Observation,
    aggregate,
    backtest,
    distribution,
    observations,
    quantile,
)
from club_picker.evaluation_report import write_report


def obs(
    day: int,
    carry: float,
    club: tuple[str, str] = ("set-a", "7i"),
    context: tuple[str, ...] = ("manual", "unknown"),
) -> Observation:
    """Create one invented observation."""
    return Observation(club, context, date(2030, 1, day), carry)


def snapshot() -> dict[str, Any]:
    """Build an invented versioned snapshot."""
    return {
        "kind": "club-picker-explorer",
        "version": 1,
        "distance_unit": "m",
        "shots": [
            {
                "set_id": "set-a",
                "club_id": "7i",
                "club_label": "7 iron",
                "source": "manual",
                "shot_id": f"shot-{day}",
                "session_id": f"session-{day}",
                "session_date": f"2030-01-0{day}",
                "carry_m": 100.0 + day,
                "intent": "unknown",
                "quality": "usable",
            }
            for day in range(1, 5)
        ],
    }


def test_whole_dates_are_held_out_and_future_does_not_change_predictions() -> None:
    """Whole dates are held out and future does not change predictions."""
    rows = [obs(1, 100), obs(2, 110), obs(3, 120), obs(3, 130), obs(4, 140)]
    folds, warmup = backtest(rows)
    assert warmup == 2
    before = [f for f in folds if f.session == 3]
    changed, _ = backtest([r if r.day.day < 3 else replace(r, carry=900) for r in rows])
    assert [(f.model, f.prediction, f.low, f.high) for f in before] == [
        (f.model, f.prediction, f.low, f.high) for f in changed if f.session == 3
    ]
    assert all(f.shots == 2 and f.history_sessions == 2 for f in before)
    stable = next(f for f in before if f.model == "Stable mean")
    assert stable.prediction == pytest.approx(105)
    assert stable.bias == pytest.approx(-20)
    assert stable.coverage == 0


def test_session_balancing_and_recency() -> None:
    """Session balancing and recency."""
    points = distribution([[100] * 100, [120]])
    assert sum(v * w for v, w in points) == pytest.approx(110)
    assert quantile(points, 0.5) == 110
    recent = distribution([[100], [120]], half_life=1)
    assert sum(v * w for v, w in recent) == pytest.approx(340 / 3)
    for sessions in ([], [[]], [[float("nan")]], [[-1]]):
        with pytest.raises(ValueError):
            distribution(sessions)
    with pytest.raises(ValueError):
        distribution([[1]], half_life=0)


def test_sets_contexts_and_sparse_histories_stay_separate() -> None:
    """Sets contexts and sparse histories stay separate."""
    rows = [obs(1, 100), obs(2, 100), obs(3, 120)]
    rows += [
        obs(1, 900, club=("set-b", "7i")),
        obs(3, 900, context=("trackman", "full")),
    ]
    folds, warmup = backtest(rows)
    assert len(folds) == 3
    assert warmup == 4
    assert {f.prediction for f in folds} == {100}


def test_aggregate_gives_clubs_equal_weight() -> None:
    """Aggregate gives clubs equal weight."""
    folds, _ = backtest([obs(1, 100), obs(2, 100), obs(3, 110)])
    first = next(f for f in folds if f.model == "Stable mean")
    values = [first, replace(first, session=4), replace(first, club="Club 2", rmse=30)]
    assert aggregate(values)["Stable mean"]["rmse"] == 20


def test_snapshot_validation_deduplication_and_exclusions() -> None:
    """Snapshot validation deduplication and exclusions."""
    payload = snapshot()
    payload["shots"].append(dict(payload["shots"][0]))
    rows, excluded = observations(payload)
    assert len(rows) == 4 and excluded == {"duplicate": 1}
    payload["shots"][-1]["carry_m"] = 101.1
    with pytest.raises(ValueError, match="Conflicting"):
        observations(payload)
    payload = snapshot()
    payload["shots"][0]["session_date"] = None
    payload["shots"][1]["intent"] = "partial"
    rows, excluded = observations(payload)
    assert len(rows) == 2
    assert excluded == {"undated": 1, "other intent": 1}
    for invalid in (True, float("nan"), -1, None):
        payload = snapshot()
        payload["shots"][0]["carry_m"] = invalid
        with pytest.raises(ValueError):
            observations(payload)
    with pytest.raises(ValueError):
        observations({**snapshot(), "distance_unit": "yd"})


def test_report_has_no_private_identifiers_or_dates(tmp_path: Path) -> None:
    """Report has no private identifiers or dates."""
    payload = snapshot()
    payload["shots"][0]["normalization_settings"] = "PRIVATE VENUE"
    source = tmp_path / "private.json"
    source.write_text(json.dumps(payload))
    result = write_report(source, tmp_path / "report")
    assert result["evaluated_shots"] == 1
    for file in (tmp_path / "report").iterdir():
        text = file.read_text()
        for private in ("PRIVATE VENUE", "2030-01", "set-a", "session-1", "shot-1"):
            assert private not in text
    assert "No groups" not in (tmp_path / "report/report.html").read_text()


def test_no_history_report(tmp_path: Path) -> None:
    """No history report."""
    source = tmp_path / "empty.json"
    source.write_text(json.dumps({**snapshot(), "shots": []}))
    assert write_report(source, tmp_path / "report")["summary"] == {}
    assert "No groups" in (tmp_path / "report/report.html").read_text()


def test_cli_and_inconsistent_date(tmp_path: Path) -> None:
    """Exercise the command and reject contradictory session metadata."""
    payload = snapshot()
    source = tmp_path / "snapshot.json"
    source.write_text(json.dumps(payload))
    assert main(["evaluate", str(source), "--output", str(tmp_path / "report")]) == 0
    assert (tmp_path / "report/report.html").exists()
    payload["shots"][1]["session_id"] = payload["shots"][0]["session_id"]
    source.write_text(json.dumps(payload))
    assert main(["evaluate", str(source), "--output", str(tmp_path / "report")]) == 2
