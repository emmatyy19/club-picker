"""Invented shots with no personal or location data."""

import csv
import io
from collections.abc import Callable

import pytest

from club_picker.shots import COLUMNS


@pytest.fixture
def record() -> dict[str, str]:
    """Return one entirely invented manual-format row."""
    return {
        "session_id": "invented-session-1",
        "shot_id": "shot-1",
        "club_id": "iron-7-v1",
        "club_label": "7 iron",
        "source": "manual",
        "distance_unit": "yd",
        "carry": "140",
        "session_date": "2026-01-01",
        "shot_intent": "full",
        "normalization": "unadjusted",
    }


@pytest.fixture
def csv_bytes() -> Callable[[list[dict[str, str]]], bytes]:
    """Serialize invented records in the documented interchange format."""

    def write(rows: list[dict[str, str]]) -> bytes:
        stream = io.StringIO(newline="")
        writer = csv.DictWriter(stream, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
        return stream.getvalue().encode()

    return write
