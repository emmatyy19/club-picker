"""Exercise the user workflow through the command-line entry point."""

import json
from collections.abc import Callable
from pathlib import Path

import pytest

from club_picker.cli import main
from club_picker.shots import COLUMNS


def test_preview_import_reimport_audit(
    tmp_path: Path,
    record: dict[str, str],
    csv_bytes: Callable[[list[dict[str, str]]], bytes],
    capsys: pytest.CaptureFixture[str],
) -> None:
    """All commands agree on row counts and report duplicate imports."""
    source = tmp_path / "input.csv"
    source.write_bytes(csv_bytes([record]))
    directory = tmp_path / "private"
    common = ["--data-dir", str(directory)]
    assert main([*common, "preview", str(source)]) == 0
    assert json.loads(capsys.readouterr().out)["written_shots"] == 0
    assert not directory.exists()
    assert main([*common, "import", str(source)]) == 0
    assert json.loads(capsys.readouterr().out)["written_shots"] == 1
    assert main([*common, "import", str(source)]) == 0
    repeated = json.loads(capsys.readouterr().out)
    assert repeated["written_shots"] == 0
    assert repeated["duplicate_rows"] == 1
    assert main([*common, "audit", "--unit", "m"]) == 0
    assert json.loads(capsys.readouterr().out)["total_shots"] == 1


def test_cli_invalid_input_has_nonzero_status(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Invalid files are actionable errors rather than successful empty imports."""
    source = tmp_path / "input.csv"
    source.write_text("club,carry\n7 iron,140\n")
    assert main(["--data-dir", str(tmp_path / "private"), "import", str(source)]) == 2
    assert json.loads(capsys.readouterr().out)["errors"]
    assert not (tmp_path / "private").exists()
    assert main(["preview", str(tmp_path / "missing.csv")]) == 2
    assert json.loads(capsys.readouterr().err)["error"]


def test_template_matches_parser(capsys: pytest.CaptureFixture[str]) -> None:
    """The printed template uses exactly the supported columns."""
    assert main(["template"]) == 0
    assert capsys.readouterr().out.strip().split(",") == list(COLUMNS)


def test_documented_fixture_workflow(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The checked-in tutorial produces its documented counts in an empty store."""
    fixture = Path(__file__).resolve().parents[1] / "data/synthetic/shots.csv"
    common = ["--data-dir", str(tmp_path / "demo")]
    assert main([*common, "import", str(fixture)]) == 0
    assert json.loads(capsys.readouterr().out)["written_shots"] == 8
    assert main([*common, "import", str(fixture)]) == 0
    assert json.loads(capsys.readouterr().out)["duplicate_rows"] == 8
    assert main([*common, "audit"]) == 0
    audit = json.loads(capsys.readouterr().out)
    assert len(audit["groups"]) == 3
    assert len(audit["session_order"]) == 2


def test_missing_context_and_flagged_rows_are_visible(
    tmp_path: Path,
    record: dict[str, str],
    csv_bytes: Callable[[list[dict[str, str]]], bytes],
    capsys: pytest.CaptureFixture[str],
) -> None:
    """A successful preview still exposes gaps that limit future analysis."""
    source = tmp_path / "unknown.csv"
    source.write_bytes(
        csv_bytes(
            [
                record
                | {
                    "session_date": "",
                    "normalization": "",
                    "shot_intent": "",
                    "quality": "suspected_error",
                    "exclusion_reason": "tracking issue",
                }
            ]
        )
    )
    assert main(["--data-dir", str(tmp_path / "private"), "preview", str(source)]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["flagged_rows"] == 1
    assert len(report["warnings"]) == 6
