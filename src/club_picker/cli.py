"""Local commands for previewing, importing, and auditing shot data."""

import argparse
import csv
import json
import sqlite3
import sys
from pathlib import Path

from club_picker.audit import audit_shots
from club_picker.explorer import explorer_snapshot
from club_picker.importing import ADAPTER, parse_csv
from club_picker.shots import (
    COLUMNS,
    Compensation,
    Intent,
    Normalization,
    Quality,
    Shot,
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
    snapshot = commands.add_parser(
        "snapshot", help="Export reviewed CSVs for the local explorer"
    )
    snapshot.add_argument("files", nargs="+", type=Path)
    snapshot.add_argument(
        "--session-set",
        action="append",
        required=True,
        help="Owner-confirmed SOURCE/SESSION=SET assignment; repeat per session",
    )
    snapshot.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Private output file, outside the web source/build directories",
    )
    args = parser.parse_args(argv)
    store = Store(Path(args.data_dir))
    try:
        if args.command == "snapshot":
            assignments: dict[tuple[str, str], str] = {}
            for assignment in args.session_set:
                session, separator, set_id = assignment.partition("=")
                source, slash, session_id = session.partition("/")
                if (
                    not separator
                    or not slash
                    or not source
                    or not session_id
                    or not set_id
                ):
                    raise ValueError("Use SOURCE/SESSION=SET for each --session-set")
                key = (source, session_id)
                if key in assignments and assignments[key] != set_id:
                    raise ValueError("Conflicting session-set assignments")
                assignments[key] = set_id
            shots: list[Shot] = []
            for input_file in args.files:
                batch = parse_csv(input_file.read_bytes())
                if batch.errors:
                    raise ValueError("; ".join(batch.errors))
                shots.extend(row.shot for row in batch.rows)
            result = explorer_snapshot(shots, session_sets=assignments)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, indent=2) + "\n")
            print(
                json.dumps({"shots": len(result["shots"]), "output": str(args.output)})
            )
            return 0
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
