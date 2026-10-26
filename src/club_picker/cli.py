"""Local commands for previewing, importing, and auditing shot data."""

import argparse
import csv
import json
import sqlite3
import sys
from pathlib import Path

from club_picker.audit import audit_shots
from club_picker.evaluation_report import write_report
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
from club_picker.trackman import (
    merge_snapshot,
    object_value,
    parse_report,
    read_object,
    save_snapshot,
    text_value,
)
from club_picker.trackman_fetch import load_report


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
    trackman = commands.add_parser(
        "trackman", help="Preview or merge a shared Trackman report"
    )
    trackman.add_argument(
        "folder", type=Path, help="Private folder containing report-link.txt"
    )
    trackman.add_argument(
        "--config", type=Path, default=Path("data/private/trackman-import.json")
    )
    trackman.add_argument(
        "--snapshot", type=Path, default=Path("data/private/explorer/snapshot.json")
    )
    trackman.add_argument(
        "--set-id", help="Override an explicitly configured standing default"
    )
    trackman.add_argument(
        "--apply", action="store_true", help="Back up and update the explorer library"
    )
    trackman.add_argument(
        "--refetch", action="store_true", help="Refresh the private report cache"
    )
    evaluation = commands.add_parser(
        "evaluate", help="Create a chronological carry backtest"
    )
    evaluation.add_argument("snapshot", type=Path)
    evaluation.add_argument("--output", type=Path, default=Path("runs/carry-baseline"))
    learning = commands.add_parser(
        "learn", help="Run the bounded chronological Ridge experiment"
    )
    learning.add_argument(
        "snapshot", type=Path, nargs="?", help="Omit for the invented learning exercise"
    )
    learning.add_argument("--output", type=Path, default=Path("runs/ridge-experiment"))
    ranges = commands.add_parser(
        "ranges", help="Inspect chronological carry-range coverage"
    )
    ranges.add_argument("snapshot", type=Path)
    ranges.add_argument("--output", type=Path, default=Path("runs/carry-ranges"))
    args = parser.parse_args(argv)
    store = Store(Path(args.data_dir))
    try:
        if args.command == "ranges":
            from club_picker.range_report import write_ranges

            result = write_ranges(args.snapshot, args.output)
            print(
                json.dumps({"summary": result["summary"], "output": str(args.output)})
            )
            return 0
        if args.command == "learn":
            from club_picker.learning_report import write_experiment

            result = write_experiment(args.snapshot, args.output)
            print(
                json.dumps(
                    {
                        "fitted_only": result["summary_fitted_only"],
                        "output": str(args.output),
                    }
                )
            )
            return 0
        if args.command == "evaluate":
            result = write_report(args.snapshot, args.output)
            print(
                json.dumps({"summary": result["summary"], "output": str(args.output)})
            )
            return 0
        if args.command == "trackman":
            config = read_object(args.config)
            cached = load_report(args.folder, refetch=args.refetch)
            batch = parse_report(
                object_value(cached.get("report")),
                url=text_value(cached.get("resolved_url"), limit=8192),
                config=config,
                set_id=args.set_id,
            )
            existing: dict[str, object] = (
                read_object(args.snapshot)
                if args.snapshot.exists()
                else {
                    "kind": "club-picker-explorer",
                    "version": 1,
                    "distance_unit": "m",
                    "shots": [],
                }
            )
            merged, added = merge_snapshot(existing, batch["shots"])
            if args.apply and added:
                save_snapshot(args.snapshot, merged)
            print(
                json.dumps(
                    {
                        "report_shots": len(batch["shots"]),
                        "new_shots": added,
                        "duplicates": len(batch["shots"]) - added,
                        "library_shots": len(merged["shots"]),
                        "applied": bool(args.apply),
                        "clubs": sorted(
                            {str(row["club_label"]) for row in batch["shots"]}
                        ),
                        "dates": sorted(
                            {str(row["session_date"]) for row in batch["shots"]}
                        ),
                        "sets": sorted({str(row["set_id"]) for row in batch["shots"]}),
                    },
                    indent=2,
                )
            )
            return 0
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
