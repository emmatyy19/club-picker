"""Preview CSV input before any persistent storage is touched."""

import csv
import hashlib
import io
from dataclasses import dataclass

from club_picker.shots import COLUMNS, REQUIRED_COLUMNS, Shot, parse_shot

ADAPTER = "manual-v1"


@dataclass(frozen=True)
class Row:
    """A validated row and its location in the original file."""

    line: int
    fields: dict[str, str]
    shot: Shot


@dataclass(frozen=True)
class Batch:
    """A complete parse result, including errors that prevent importing."""

    original: bytes
    rows: tuple[Row, ...]
    errors: tuple[str, ...]

    @property
    def fingerprint(self) -> str:
        """Identify exact input bytes independently of file name."""
        return hashlib.sha256(self.original).hexdigest()


def parse_csv(original: bytes) -> Batch:
    """Validate a manual-v1 CSV, collecting row errors without dropping shots."""
    rows: list[Row] = []
    errors: list[str] = []
    try:
        stream = io.StringIO(original.decode("utf-8-sig"), newline="")
    except UnicodeDecodeError:
        return Batch(original, (), ("Expected a UTF-8 CSV file",))
    reader = csv.reader(stream, strict=True)
    try:
        header = next(reader, list[str]())
        if not header:
            return Batch(original, (), ("CSV is empty",))
        if len(set(header)) != len(header):
            errors.append("Duplicate column names")
        missing = set(REQUIRED_COLUMNS) - set(header)
        extra = set(header) - set(COLUMNS)
        if missing:
            errors.append(f"Missing columns: {', '.join(sorted(missing))}")
        if extra:
            errors.append(f"Unknown columns: {', '.join(sorted(extra))}")
        if errors:
            return Batch(original, (), tuple(errors))
        for values in reader:
            if not values:
                continue
            line = reader.line_num
            if len(values) != len(header):
                errors.append(f"Line {line}: column count differs from header")
                continue
            fields = dict(zip(header, values, strict=True))
            try:
                rows.append(Row(line, fields, parse_shot(fields)))
            except ValueError as error:
                errors.append(f"Line {line}: {error}")
    except csv.Error as error:
        errors.append(f"Line {reader.line_num}: invalid CSV: {error}")
    if not rows and not errors:
        errors.append("CSV contains no shot rows")
    return Batch(original, tuple(rows), tuple(errors))
