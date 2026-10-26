"""Invented coverage diagnostics with chronology and privacy checks."""

import json
from dataclasses import replace
from datetime import date
from pathlib import Path

import pytest

from club_picker.cli import main
from club_picker.evaluation import Observation, aggregate, backtest
from club_picker.range_report import render
from club_picker.ranges import diagnose, interval_outcomes, range_analysis, summarize


def invented() -> list[Observation]:
    """Supply two historical dates and two later shifts."""
    return [
        Observation(
            ("set-a", "7i"), ("manual", "unknown"), date(2030, 1, day), value, "7 iron"
        )
        for day, values in (
            (1, (90, 100, 110)),
            (2, (90, 100, 110)),
            (3, (80, 100, 120)),
            (4, (70, 90, 100)),
        )
        for value in values
    ]


def test_inclusive_boundaries_and_interval_score() -> None:
    """Tails exclude endpoints; miss distance and width both affect the score."""
    short, inside, long, score = interval_outcomes([80, 90, 100, 110, 120], 90, 110)
    assert (short, inside, long) == pytest.approx((0.2, 0.6, 0.2))
    assert score == 60
    assert interval_outcomes([100], 100, 100) == (0, 1, 0, 0)
    with pytest.raises(ValueError):
        interval_outcomes([], 90, 110)
    with pytest.raises(ValueError):
        interval_outcomes([100], 110, 90)


def test_ranges_match_baseline_and_do_not_see_future() -> None:
    """Breakdowns reconcile to the original report and preserve its leakage boundary."""
    rows = invented()
    details = diagnose(rows)
    baseline, _ = backtest(rows)
    stable = summarize([r for r in details if r.method == "Stable range"])
    assert stable["inside"] == pytest.approx(
        aggregate(baseline)["Stable mean"]["coverage"]
    )
    assert stable["short"] + stable["inside"] + stable["long"] == pytest.approx(1)
    changed = diagnose([replace(r, carry=900) if r.day.day >= 3 else r for r in rows])
    a = [(r.low, r.high, r.historical_coverage) for r in details if r.session == 3]
    b = [(r.low, r.high, r.historical_coverage) for r in changed if r.session == 3]
    assert a == b
    assert all(r.history_sessions == 2 for r in details if r.session == 3)
    assert details[0].short == pytest.approx(1 / 3)


def test_club_balanced_and_pooled_answer_different_questions() -> None:
    """A long session cannot overwhelm equal club weighting."""
    base = diagnose(invented())[0]
    rows = [
        replace(base, club="A", shots=90, inside=1, short=0, long=0),
        replace(base, club="B", shots=10, inside=0, short=1, long=0),
    ]
    summary = summarize(rows)
    assert summary["inside"] == 0.5
    assert summary["pooled_shot_coverage"] == 0.9
    assert summary["dates"] == 1
    assert summary["groups"] == 2
    with pytest.raises(ValueError):
        summarize([*rows, replace(base, method="other")])


def test_contexts_remain_separate() -> None:
    """A second provider or physical set does not alter the original ranges."""
    original = diagnose(invented())
    expanded = diagnose(
        invented() + [replace(r, club=("set-z", "7i"), carry=1000) for r in invented()]
    )
    assert original == [r for r in expanded if r.context == "Context 1"]


def test_empty_report_and_private_input_cli(tmp_path: Path) -> None:
    """The CLI excludes raw identifiers and preserves its input."""
    assert "No evaluable ranges" in render(range_analysis([]))
    source = tmp_path / "snapshot.json"
    rows = [
        {
            "set_id": "private-set",
            "club_id": "private-club",
            "club_label": "7 iron",
            "source": "manual",
            "session_id": f"session-{r.day.day}",
            "shot_id": str(i),
            "session_date": r.day.isoformat(),
            "carry_m": r.carry,
            "normalization_settings": "PRIVATE VENUE",
        }
        for i, r in enumerate(invented())
    ]
    source.write_text(
        json.dumps(
            {
                "kind": "club-picker-explorer",
                "version": 1,
                "distance_unit": "m",
                "shots": rows,
            }
        )
    )
    original = source.read_bytes()
    output = tmp_path / "reports"
    assert main(["ranges", str(source), "--output", str(output)]) == 0
    assert source.read_bytes() == original
    for file in output.iterdir():
        text = file.read_text()
        for secret in (
            "PRIVATE VENUE",
            "private-set",
            "private-club",
            "2030-01",
            "session-1",
        ):
            assert secret not in text
    assert main(["ranges", str(output / "results.json"), "--output", str(output)]) == 2
