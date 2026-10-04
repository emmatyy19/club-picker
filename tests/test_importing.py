"""Exercise malformed exports and row-level validation reports."""

from collections.abc import Callable

import pytest

from club_picker.importing import parse_csv
from club_picker.shots import COLUMNS


def test_reports_invalid_rows_without_losing_valid_rows(
    record: dict[str, str],
    csv_bytes: Callable[[list[dict[str, str]]], bytes],
) -> None:
    """Preview lists errors and the valid subset without authorizing partial writes."""
    batch = parse_csv(
        csv_bytes([record, record | {"carry": "NaN"}, record | {"carry": ""}])
    )
    assert len(batch.rows) == 1
    assert len(batch.errors) == 2
    assert batch.errors[0].startswith("Line 3:")
    assert batch.errors[1].startswith("Line 4:")


@pytest.mark.parametrize(
    "raw",
    [
        b"",
        b"\xff",
        b"carry\n100\n",
        b"carry,carry\n100,100\n",
        (",".join(COLUMNS) + ",venue\n").encode(),
        (",".join(COLUMNS) + "\n").encode(),
        (",".join(COLUMNS) + "\nonly,three,columns\n").encode(),
        (",".join(COLUMNS) + '\n"unterminated').encode(),
    ],
)
def test_rejects_ambiguous_or_malformed_files(raw: bytes) -> None:
    """Unknown headers, bad encoding, and broken CSV are explicit failures."""
    assert parse_csv(raw).errors


def test_bom_and_quoted_club_label(
    record: dict[str, str],
    csv_bytes: Callable[[list[dict[str, str]]], bytes],
) -> None:
    """Common spreadsheet CSV encoding and quoting preserve club labels."""
    batch = parse_csv(
        b"\xef\xbb\xbf" + csv_bytes([record | {"club_label": "Iron, seven"}])
    )
    assert not batch.errors
    assert batch.rows[0].shot.club_label == "Iron, seven"
