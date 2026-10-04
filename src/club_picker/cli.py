"""Local commands for previewing, importing, and auditing shot data."""

import argparse
import csv
import json
import sqlite3
import sys
from pathlib import Path

from club_picker.audit import audit_shots
from club_picker.importing import ADAPTER, parse_csv
from club_picker.shots import (
    COLUMNS,
    Compensation,
    Intent,
    Normalization,
    Quality,
    Unit,
)
from club_picker.storage import Store


def main(argv: list[str] | None = None) -> int:
    """Run a local workflow, returning nonzero for invalid or conflicting input."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data/private/club-picker"),
        help="Private store directory (relative to the current directory)",
    )
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("template", help="Print the manual-v1 CSV header")
    for command in ("preview", "import"):
        subparser = commands.add_parser(
            command, help=f"{command.capitalize()} a manual-v1 CSV"
        )
        subparser.add_argument("file", type=Path)
    audit = commands.add_parser("audit", help="Print a private JSON data inventory")
    audit.add_argument("--unit", choices=list(Unit), default=Unit.YARDS)
    args = parser.parse_args(argv)
    store = Store(Path(args.data_dir))
    try:
        if args.command == "template":
            csv.writer(sys.stdout).writerow(COLUMNS)
            return 0
        if args.command == "audit":
            print(
                json.dumps(audit_shots(store.shots(), unit=Unit(args.unit)), indent=2)
            )
            return 0
        file = Path(args.file)
        batch = parse_csv(file.read_bytes())
        plan = (
            store.import_batch(batch, filename=file.name)
            if args.command == "import"
            else store.preview(batch)
        )
        warnings: list[str] = []
        if any(row.shot.session_date is None for row in batch.rows):
            warnings.append(
                "Undated shots cannot support chronological trend evaluation."
            )
        if any(row.shot.carry_side_m is None for row in batch.rows):
            warnings.append(
                "Missing carry-side measurements do not establish lateral safety."
            )
        if any(row.shot.intent == Intent.UNKNOWN for row in batch.rows):
            warnings.append("Unknown shot intent remains separate from full swings.")
        if any(row.shot.normalization == Normalization.UNKNOWN for row in batch.rows):
            warnings.append("Normalization is unknown for some shots.")
        if any(row.shot.compensation == Compensation.UNKNOWN for row in batch.rows):
            warnings.append("Ball compensation is unknown for some shots.")
        if any(row.shot.quality != Quality.USABLE for row in batch.rows):
            warnings.append(
                "Flagged shots are retained but omitted from carry summaries."
            )
        print(
            json.dumps(
                {
                    "adapter": ADAPTER,
                    "command": args.command,
                    "valid_rows": len(batch.rows),
                    "flagged_rows": sum(
                        row.shot.quality != Quality.USABLE for row in batch.rows
                    ),
                    "new_shots": len(plan.additions),
                    "duplicate_rows": plan.duplicates,
                    "written_shots": len(plan.additions)
                    if args.command == "import" and not plan.errors
                    else 0,
                    "errors": plan.errors,
                    "warnings": warnings,
                },
                indent=2,
            )
        )
        return 2 if plan.errors else 0
    except (OSError, ValueError, sqlite3.Error) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
