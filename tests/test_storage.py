"""Verify private provenance, repeat imports, and all-or-nothing writes."""

import sqlite3
from collections.abc import Callable
from pathlib import Path

import pytest

from club_picker.importing import parse_csv
from club_picker.storage import Store


def test_preview_does_not_create_files(
    tmp_path: Path,
    record: dict[str, str],
    csv_bytes: Callable[[list[dict[str, str]]], bytes],
) -> None:
    """A preview and empty read are genuinely read only."""
    store = Store(tmp_path / "private")
    assert len(store.preview(parse_csv(csv_bytes([record]))).additions) == 1
    assert store.shots() == []
    assert not store.directory.exists()


def test_idempotent_import_preserves_distinct_equal_shots_and_original(
    tmp_path: Path,
    record: dict[str, str],
    csv_bytes: Callable[[list[dict[str, str]]], bytes],
) -> None:
    """Identity, rather than identical yardage, decides whether a shot is repeated."""
    store = Store(tmp_path / "private")
    batch = parse_csv(csv_bytes([record, record | {"shot_id": "shot-2"}]))
    assert len(store.import_batch(batch, filename="first.csv").additions) == 2
    assert store.import_batch(batch, filename="renamed.csv").duplicates == 2
    assert len(store.shots()) == 2
    archive = store.directory / "originals" / f"{batch.fingerprint}.csv"
    assert archive.read_bytes() == batch.original
    assert archive.stat().st_mode & 0o777 == 0o600
    assert store.database.stat().st_mode & 0o777 == 0o600
    with sqlite3.connect(store.database) as connection:
        assert connection.execute("SELECT count(*) FROM imports").fetchone()[0] == 1
        assert connection.execute("SELECT count(*) FROM import_rows").fetchone()[0] == 2
    # Different byte order and a partial overlapping export still deduplicate.
    reordered = parse_csv(csv_bytes([record | {"shot_id": "shot-2"}, record]))
    assert store.import_batch(reordered, filename="again.csv").duplicates == 2
    assert len(store.shots()) == 2


@pytest.mark.parametrize(
    "change",
    [
        {"carry": "141"},
        {"session_date": "2026-01-02"},
        {"club_label": "Changed label"},
        {"quality": "excluded", "exclusion_reason": "bad reading"},
    ],
)
def test_conflicting_import_rolls_back_every_row(
    tmp_path: Path,
    record: dict[str, str],
    csv_bytes: Callable[[list[dict[str, str]]], bytes],
    change: dict[str, str],
) -> None:
    """An edited known shot cannot silently overwrite history or partly append."""
    store = Store(tmp_path / "private")
    store.import_batch(parse_csv(csv_bytes([record])), filename="first.csv")
    conflicting = parse_csv(csv_bytes([record | {"shot_id": "new"}, record | change]))
    result = store.import_batch(conflicting, filename="conflicting.csv")
    assert result.errors
    assert len(store.shots()) == 1
    assert not (
        store.directory / "originals" / f"{conflicting.fingerprint}.csv"
    ).exists()


def test_within_file_conflicts_and_parse_errors_write_nothing(
    tmp_path: Path,
    record: dict[str, str],
    csv_bytes: Callable[[list[dict[str, str]]], bytes],
) -> None:
    """Internal conflicts and invalid rows fail before creating the store."""
    store = Store(tmp_path / "private")
    for other in (record | {"carry": "141"}, record | {"carry": "nan"}):
        assert store.import_batch(
            parse_csv(csv_bytes([record, other])), filename="bad.csv"
        ).errors
    assert not store.directory.exists()


def test_distinct_adjustments_and_sources_are_preserved(
    tmp_path: Path,
    record: dict[str, str],
    csv_bytes: Callable[[list[dict[str, str]]], bytes],
) -> None:
    """Raw and adjusted versions coexist without flattening their provenance."""
    store = Store(tmp_path / "private")
    rows = [
        record,
        record | {"normalization": "normalized", "carry": "145"},
        record | {"ball_compensation": "on"},
        record | {"source": "toptracer"},
    ]
    assert not store.import_batch(
        parse_csv(csv_bytes(rows)), filename="variants.csv"
    ).errors
    assert len(store.shots()) == 4


def test_database_failure_rolls_back_import(
    tmp_path: Path,
    record: dict[str, str],
    csv_bytes: Callable[[list[dict[str, str]]], bytes],
) -> None:
    """A failure after shot insertion cannot leave a partially committed import."""
    store = Store(tmp_path / "private")
    store.import_batch(parse_csv(csv_bytes([record])), filename="first.csv")
    with sqlite3.connect(store.database) as connection:
        connection.execute("""CREATE TRIGGER fail_link BEFORE INSERT ON import_rows
                              BEGIN SELECT RAISE(ABORT, 'injected failure'); END""")
    with pytest.raises(sqlite3.IntegrityError):
        store.import_batch(
            parse_csv(csv_bytes([record | {"shot_id": "new"}])), filename="second.csv"
        )
    assert len(store.shots()) == 1
    with sqlite3.connect(store.database) as connection:
        assert connection.execute("SELECT count(*) FROM imports").fetchone()[0] == 1


def test_archive_integrity_failure_does_not_add_shots(
    tmp_path: Path,
    record: dict[str, str],
    csv_bytes: Callable[[list[dict[str, str]]], bytes],
) -> None:
    """A damaged source archive is surfaced before any data is committed."""
    store = Store(tmp_path / "private")
    batch = parse_csv(csv_bytes([record]))
    store.import_batch(batch, filename="first.csv")
    (store.directory / "originals" / f"{batch.fingerprint}.csv").write_bytes(b"damaged")
    with pytest.raises(ValueError, match="integrity"):
        store.import_batch(batch, filename="first.csv")
    assert len(store.shots()) == 1


def test_future_database_version_is_rejected(tmp_path: Path) -> None:
    """A newer database cannot be silently downgraded."""
    store = Store(tmp_path)
    with sqlite3.connect(store.database) as connection:
        connection.execute("PRAGMA user_version = 99")
    with pytest.raises(ValueError, match="Unsupported database"):
        store.shots()
