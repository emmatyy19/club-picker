"""Choose a local Trackman report folder, preview it, and optionally import it."""

import argparse
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from club_picker.cli import main as import_command
from club_picker.trackman import object_value, read_object


@dataclass(frozen=True)
class Candidate:
    """Local folder metadata; cached does not mean imported."""

    folder: Path
    day: date | None
    modified: float
    cached: bool


def discover(root: Path) -> list[Candidate]:
    """Find link-containing folders, dated newest first, then undated by mtime."""
    result: list[Candidate] = []
    for link in root.rglob("report-link.txt"):
        if not link.is_file():
            continue
        day = None
        for part in reversed(link.parent.relative_to(root).parts):
            match = re.match(r"^(\d{4}-\d{2}-\d{2})(?:$|[ _])", part)
            if match:
                try:
                    day = date.fromisoformat(match[1])
                except ValueError:
                    continue
                break
        result.append(
            Candidate(
                link.parent,
                day,
                link.stat().st_mtime,
                (link.parent / "trackman-report.json").is_file(),
            )
        )
    return sorted(
        result,
        key=lambda item: (
            item.day is not None,
            item.day.toordinal() if item.day else 0,
            item.modified,
            str(item.folder),
        ),
        reverse=True,
    )


def describe(
    candidates: list[Candidate], root: Path, write: Callable[[str], None]
) -> None:
    """Show numbered local paths without printing private report URLs."""
    write("Trackman sessions: newest folder dates first; undated folders last.")
    for i, candidate in enumerate(candidates, 1):
        label = candidate.folder.relative_to(root).as_posix()
        cache = "cached report" if candidate.cached else "not downloaded"
        day = candidate.day.isoformat() if candidate.day else "undated"
        write(f"  {i:>2}. {label}  [{day}; {cache}]")
    write("Cache labels do not indicate import status. Preview checks for duplicates.")


def choose_and_import(
    root: Path,
    config: Path,
    snapshot: Path,
    *,
    read: Callable[[str], str] = input,
    write: Callable[[str], None] = print,
    run: Callable[[list[str]], int] = import_command,
) -> int:
    """Require a folder selection and successful preview before optional apply."""
    candidates = discover(root)
    if not candidates:
        write(
            f"No report-link.txt files found under {root}. Add one in a YYYY-MM-DD folder."
        )
        return 0
    describe(candidates, root, write)
    while True:
        choice = read("Session number (q to cancel): ").strip()
        if choice.lower() in {"", "q"}:
            return 0
        if choice.isdecimal() and 1 <= int(choice) <= len(candidates):
            selected = candidates[int(choice) - 1]
            break
        write(f"Choose a number from 1 to {len(candidates)}, or q.")
    settings = read_object(config)
    sets = object_value(settings.get("club_sets"))
    if not sets:
        raise ValueError(
            "Configure physical club sets in the Trackman import config first."
        )
    default = settings.get("default_set_id")
    if default is not None and (not isinstance(default, str) or default not in sets):
        raise ValueError("Configured default club set is not present in club_sets.")
    write("Configured club sets: " + ", ".join(sorted(sets)))
    while True:
        prompt = (
            f"Club set [Enter for {default}; q to cancel]: "
            if default
            else "Club set (required; q to cancel): "
        )
        choice = read(prompt).strip()
        if choice.lower() == "q":
            return 0
        set_id = choice or (str(default) if default else "")
        if set_id in sets:
            break
        write("Choose a configured set. No source-to-set assignment is guessed.")
    args = [
        "trackman",
        str(selected.folder),
        "--config",
        str(config),
        "--snapshot",
        str(snapshot),
        "--set-id",
        set_id,
    ]
    write(
        f"\nPreviewing {selected.folder.name} with {set_id}. Report dates determine the actual session."
    )
    result = run(args)
    if result:
        write(
            "Preview failed; nothing was imported. Fix the reported issue before retrying."
        )
        return result
    write(
        "\nCheck the dates, set and new_shots above. Preview may download a private report cache."
    )
    if read(
        "Import this session into your local library? [y/N]: "
    ).strip().lower() not in {"y", "yes"}:
        write("Preview only; your library is unchanged.")
        return 0
    result = run([*args, "--apply"])
    if result == 0:
        write(
            "Done. Click Refresh data in the local explorer. Run again to choose another session."
        )
    return result


def main(argv: list[str] | None = None) -> int:
    """Launch from the repo root or from the editor's integrated terminal."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("data/raw/trackman"))
    parser.add_argument(
        "--config", type=Path, default=Path("data/private/trackman-import.json")
    )
    parser.add_argument(
        "--snapshot", type=Path, default=Path("data/private/explorer/snapshot.json")
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List candidates without fetching or importing",
    )
    args = parser.parse_args(argv)
    try:
        if args.list:
            candidates = discover(args.root)
            if candidates:
                describe(candidates, args.root, print)
            else:
                print(f"No report-link.txt files found under {args.root}.")
            return 0
        return choose_and_import(args.root, args.config, args.snapshot)
    except (EOFError, KeyboardInterrupt):
        print("\nCancelled.")
        return 0
    except (OSError, ValueError) as error:
        print(f"Error: {error}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
