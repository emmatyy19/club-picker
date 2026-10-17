"""Shared browser/reference contracts for approach-shot calculations."""

import json
from dataclasses import asdict
from pathlib import Path

import pytest

from club_picker.approach import approach_target, summarize_carry

FIXTURES = json.loads((Path(__file__).parent / "fixtures/approach.json").read_text())


def test_shared_session_balanced_quantiles():
    """Retain mishits and prevent a long session from dominating the median."""
    for case in FIXTURES["summaries"]:
        assert asdict(summarize_carry(case["sessions"])) == pytest.approx(
            case["expected"]
        )


def test_shared_rangefinder_targets():
    """Use adjusted distance once and leave an angle-only target unadjusted."""
    for case in FIXTURES["targets"]:
        assert approach_target(
            case["distance"],
            plays_like=case["playsLike"],
            angle=case["angle"],
            unit=case["unit"],
        ) == pytest.approx(case["expected"])


@pytest.mark.parametrize(
    "sessions", [[], [[]], [[-1]], [[float("nan")]], [[float("inf")]]]
)
def test_reject_invalid_carries(sessions):
    """Reject invalid observations before they enter a summary."""
    with pytest.raises(ValueError):
        summarize_carry(sessions)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"distance": 0},
        {"distance": -10},
        {"distance": float("nan")},
        {"distance": 10, "plays_like": 0},
        {"distance": 10, "angle": 90},
        {"distance": 10, "angle": float("nan")},
        {"distance": 10, "unit": "ft"},
    ],
)
def test_reject_invalid_target(kwargs):
    """Reject invalid rangefinder inputs."""
    with pytest.raises(ValueError):
        approach_target(**kwargs)
