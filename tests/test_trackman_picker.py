"""Invented folder selection and preview-before-apply behavior."""

import json
import os
from pathlib import Path

from club_picker.trackman_picker import choose_and_import, discover, main


def prepare(tmp_path: Path) -> tuple[Path, Path, Path]:
    """Create a local fixture without real URLs or network activity."""
    root = tmp_path / "raw"
    for name in ("2030-02-01", "2030-01-01", "historical"):
        folder = root / name
        folder.mkdir(parents=True)
        (folder / "report-link.txt").write_text("invented link")
    config = tmp_path / "config.json"
    config.write_text(
        json.dumps({"default_set_id": "set-a", "club_sets": {"set-a": {}, "set-b": {}}})
    )
    return root, config, tmp_path / "snapshot.json"


def test_sort_uses_dates_before_modified_times(tmp_path: Path) -> None:
    """Refreshing an old cache must not make an older session rank first."""
    root, _, _ = prepare(tmp_path)
    os.utime(root / "2030-02-01/report-link.txt", (1, 1))
    (root / "2030-01-01/trackman-report.json").write_text("{}")
    candidates = discover(root)
    assert [item.folder.name for item in candidates] == [
        "2030-02-01",
        "2030-01-01",
        "historical",
    ]
    assert candidates[1].cached
    assert not candidates[0].cached


def test_apply_requires_successful_preview_and_explicit_choice(tmp_path: Path) -> None:
    """Reuse the importer with the selected folder and overridden physical set."""
    root, config, snapshot = prepare(tmp_path)
    calls: list[list[str]] = []
    answers = iter(["99", "1", "set-b", "y"])

    def run(args: list[str], calls: list[list[str]] = calls) -> int:
        calls.append(args)
        return 0

    assert (
        choose_and_import(
            root,
            config,
            snapshot,
            read=lambda _, answers=answers: next(answers),
            write=lambda _: None,
            run=run,
        )
        == 0
    )
    assert len(calls) == 2
    assert calls[0][1] == str(root / "2030-02-01")
    assert calls[0][-1] == "set-b"
    assert "--apply" not in calls[0]
    assert calls[1] == [*calls[0], "--apply"]


def test_failed_preview_never_applies(tmp_path: Path) -> None:
    """A rejected preview stops without offering to import."""
    root, config, snapshot = prepare(tmp_path)
    answers = iter(["1", ""])
    calls: list[list[str]] = []

    def run(args: list[str], calls: list[list[str]] = calls) -> int:
        calls.append(args)
        return 2

    assert (
        choose_and_import(
            root,
            config,
            snapshot,
            read=lambda _, answers=answers: next(answers),
            write=lambda _: None,
            run=run,
        )
        == 2
    )
    assert len(calls) == 1
    assert calls[0][-1] == "set-a"


def test_preview_only_and_cancel(tmp_path: Path) -> None:
    """Empty confirmation does not mutate the library; cancelling never fetches."""
    root, config, snapshot = prepare(tmp_path)
    for inputs, expected in ((["1", "", ""], 1), (["q"], 0), (["1", "q"], 0)):
        answers = iter(inputs)
        calls: list[list[str]] = []

        def run(args: list[str], calls: list[list[str]] = calls) -> int:
            calls.append(args)
            return 0

        assert (
            choose_and_import(
                root,
                config,
                snapshot,
                read=lambda _, answers=answers: next(answers),
                write=lambda _: None,
                run=run,
            )
            == 0
        )
        assert len(calls) == expected
        assert all("--apply" not in call for call in calls)


def test_no_default_requires_explicit_set(tmp_path: Path) -> None:
    """Never silently use the first set when the owner has no standing default."""
    root, config, snapshot = prepare(tmp_path)
    config.write_text(json.dumps({"club_sets": {"set-a": {}, "set-b": {}}}))
    answers = iter(["1", "", "set-b", "n"])
    calls: list[list[str]] = []

    def run(args: list[str], calls: list[list[str]] = calls) -> int:
        calls.append(args)
        return 0

    choose_and_import(
        root,
        config,
        snapshot,
        read=lambda _, answers=answers: next(answers),
        write=lambda _: None,
        run=run,
    )
    assert calls[0][-1] == "set-b"


def test_list_and_empty_root_need_no_config(tmp_path: Path) -> None:
    """Read-only discovery works in a fresh clone without private configuration."""
    assert main(["--root", str(tmp_path / "absent"), "--list"]) == 0
    assert main(["--root", str(tmp_path / "absent")]) == 0
    root, _, _ = prepare(tmp_path)
    assert main(["--root", str(root), "--list"]) == 0
