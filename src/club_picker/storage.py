"""Keep source files and repeatable shot imports in a local private store."""

import hashlib
import json
import os
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import cast

from club_picker.importing import ADAPTER, Batch, Row
from club_picker.shots import Shot, parse_shot

SCHEMA_VERSION = 1


@dataclass(frozen=True)
class Plan:
    """A preview of additions, duplicates, and conflicts for an entire file."""

    additions: tuple[Row, ...]
    duplicates: int
    errors: tuple[str, ...]


def _identity(shot: Shot) -> str:
    return json.dumps(shot.identity)


def _read_shots(connection: sqlite3.Connection) -> list[Shot]:
    records = cast(
        list[tuple[str]], connection.execute("SELECT record FROM shots").fetchall()
    )
    return [
        parse_shot(cast(dict[str, str], json.loads(record))) for (record,) in records
    ]


def _plan(batch: Batch, existing: list[Shot]) -> Plan:
    shots = {shot.identity: shot for shot in existing}
    sessions = {(shot.source, shot.session_id): shot.session_date for shot in existing}
    clubs = {shot.club_id: shot.club_label for shot in existing}
    additions: list[Row] = []
    duplicates = 0
    errors = list(batch.errors)
    for row in batch.rows:
        shot = row.shot
        session = (shot.source, shot.session_id)
        if session in sessions and sessions[session] != shot.session_date:
            errors.append(f"Line {row.line}: session_id has a conflicting session_date")
        if shot.club_id in clubs and clubs[shot.club_id] != shot.club_label:
            errors.append(f"Line {row.line}: club_id has a conflicting club_label")
        if shot.identity in shots:
            if shots[shot.identity] != shot:
                errors.append(
                    f"Line {row.line}: shot_id has conflicting measurements or metadata"
                )
            else:
                duplicates += 1
        else:
            additions.append(row)
        shots[shot.identity] = shot
        sessions[session] = shot.session_date
        clubs[shot.club_id] = shot.club_label
    return Plan(tuple(additions), duplicates, tuple(errors))


class Store:
    """An explicitly local SQLite database with immutable input archives."""

    def __init__(self, directory: Path) -> None:
        """Choose a private directory without creating it on read or preview."""
        self.directory = directory
        self.database = directory / "shots.sqlite3"

    def _connect(self, *, write: bool) -> sqlite3.Connection:
        if write:
            self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            try:
                descriptor = os.open(
                    self.database, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600
                )
            except FileExistsError:
                pass
            else:
                os.close(descriptor)
            connection = sqlite3.connect(self.database)
        else:
            connection = sqlite3.connect(
                self.database.resolve().as_uri() + "?mode=ro", uri=True
            )
        try:
            connection.execute("PRAGMA foreign_keys = ON")
            version = cast(
                tuple[int], connection.execute("PRAGMA user_version").fetchone()
            )[0]
            if write and version == 0:
                tables = connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
                if tables:
                    raise ValueError("Refusing to initialize an unrelated database")
                connection.executescript("""
                    BEGIN IMMEDIATE;
                    CREATE TABLE shots (identity TEXT PRIMARY KEY, record TEXT NOT NULL);
                    CREATE TABLE imports (
                        fingerprint TEXT PRIMARY KEY,
                        adapter TEXT NOT NULL,
                        imported_at TEXT NOT NULL,
                        filename TEXT NOT NULL
                    );
                    CREATE TABLE import_rows (
                        fingerprint TEXT NOT NULL REFERENCES imports(fingerprint),
                        source_line INTEGER NOT NULL,
                        identity TEXT NOT NULL REFERENCES shots(identity),
                        PRIMARY KEY (fingerprint, source_line)
                    );
                    PRAGMA user_version = 1;
                    COMMIT;
                """)
            elif version != SCHEMA_VERSION:
                raise ValueError(
                    f"Unsupported database schema {version}; expected {SCHEMA_VERSION}"
                )
        except Exception:
            connection.close()
            raise
        return connection

    def shots(self) -> list[Shot]:
        """Read shots without creating a store or manufacturing chronology."""
        if not self.database.exists():
            return []
        with closing(self._connect(write=False)) as connection:
            return _read_shots(connection)

    def preview(self, batch: Batch) -> Plan:
        """Check the entire batch against stored identities without writing."""
        return _plan(batch, self.shots())

    def _archive(self, batch: Batch) -> None:
        archive = self.directory / "originals"
        archive.mkdir(exist_ok=True, mode=0o700)
        destination = archive / f"{batch.fingerprint}.csv"
        try:
            descriptor = os.open(
                destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600
            )
        except FileExistsError:
            if (
                hashlib.sha256(destination.read_bytes()).hexdigest()
                != batch.fingerprint
            ):
                raise ValueError(
                    "Archived original failed its integrity check"
                ) from None
        else:
            try:
                with os.fdopen(descriptor, "wb") as stream:
                    stream.write(batch.original)
                    stream.flush()
                    os.fsync(stream.fileno())
            except BaseException:
                destination.unlink(missing_ok=True)
                raise

    def import_batch(self, batch: Batch, *, filename: str) -> Plan:
        """Atomically import valid rows; conflicts reject the whole batch."""
        preliminary = self.preview(batch)
        if preliminary.errors:
            return preliminary
        with closing(self._connect(write=True)) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            plan = _plan(batch, _read_shots(connection))
            if plan.errors:
                return plan
            self._archive(batch)
            connection.execute(
                "INSERT OR IGNORE INTO imports VALUES (?, ?, ?, ?)",
                (batch.fingerprint, ADAPTER, datetime.now(UTC).isoformat(), filename),
            )
            for row in plan.additions:
                connection.execute(
                    "INSERT INTO shots VALUES (?, ?)",
                    (_identity(row.shot), json.dumps(row.fields, sort_keys=True)),
                )
            for row in batch.rows:
                connection.execute(
                    "INSERT OR IGNORE INTO import_rows VALUES (?, ?, ?)",
                    (batch.fingerprint, row.line, _identity(row.shot)),
                )
            return plan
