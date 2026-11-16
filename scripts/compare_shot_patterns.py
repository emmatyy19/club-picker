"""Run the two-group flight experiment on a validated explorer snapshot."""

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from club_picker.practice_data import practice_shots
from club_picker.shot_patterns import compare_patterns, pattern_days
from club_picker.trackman import object_value


def main() -> None:
    """Print the experiment summary as JSON."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--club", required=True)
    parser.add_argument("--source", required=True)
    args = parser.parse_args()
    rows, _ = practice_shots(object_value(json.loads(args.snapshot.read_bytes())))
    result = compare_patterns(pattern_days(rows, args.club, args.source))
    print(json.dumps(asdict(result), indent=2))


if __name__ == "__main__":
    main()
