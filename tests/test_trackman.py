"""Exercise shared-report imports with invented provider data."""

import copy
import json
from pathlib import Path

import pytest

from club_picker.cli import main
from club_picker.trackman import merge_snapshot, parse_report, report_settings
from club_picker.trackman_fetch import fetch_report, load_report, request

URL = (
    "https://web-dynamic-reports.trackmangolf.com/?a=00000000-0000-0000-0000-000000000001"
    "&nd=true&nd_altitude=0&nd_temperature=25&nd_ballType=Premium"
)
CONFIG = {
    "version": 1,
    "default_set_id": "bag-a",
    "club_sets": {"bag-a": {"7Iron": {"club_id": "bag-a-7i", "club_label": "7 iron"}}},
}
EMPTY = {
    "kind": "club-picker-explorer",
    "version": 1,
    "distance_unit": "m",
    "shots": [],
}


@pytest.fixture
def report():
    """Supply distinct swings with identical measurements, including a zero miss."""
    measurement = {
        "Carry": 100,
        "Total": 110,
        "CarrySide": 0,
        "Side": 9,
        "TotalSide": -3,
        "BallSpeed": 40,
        "SpinRate": 5000,
        "LaunchAngle": 20,
        "MaxHeight": 25,
        "LandingAngle": 45,
        "HangTime": 5,
        "Curve": -2,
    }
    return {
        "Kind": "multiGroupReport",
        "Settings": {"ShowNormalizedData": False},
        "StrokeGroups": [
            {
                "Club": "7Iron",
                "Date": "2026-01-02",
                "Strokes": [
                    {
                        "Id": f"00000000-0000-0000-0000-{i:012d}",
                        "Club": "7Iron",
                        "Measurement": measurement | {"Carry": 90},
                        "NormalizedMeasurement": measurement.copy(),
                    }
                    for i in (2, 3)
                ],
            }
        ],
    }


def parse(report, url=URL):
    """Parse the invented bag using the report's explicit display settings."""
    return parse_report(report, url=url, config=CONFIG)


def test_units_normalization_and_unknowns(report):
    """URL display mode wins; SI values and zero side survive, with no raw fallback."""
    result = parse(report, URL + "&u=yd")
    row = result["shots"][0]
    assert row["carry_m"] == 100
    assert row["carry_side_m"] == 0
    assert row["curve_m"] == -2
    assert row["compensation"] == "unknown"
    assert (
        row["normalization_settings"]
        == "25 C; altitude 0 m; premium normalization model"
    )
    assert len(result["shots"]) == 2
    assert (
        parse(report, URL.replace("nd=true", "nd=false"))["shots"][0]["carry_m"] == 90
    )
    del report["StrokeGroups"][0]["Strokes"][0]["NormalizedMeasurement"]["SpinRate"]
    assert parse(report)["shots"][0]["spin_rpm"] is None
    del report["StrokeGroups"][0]["Strokes"][0]["NormalizedMeasurement"]
    with pytest.raises(ValueError):
        parse(report)


@pytest.mark.parametrize(
    "field,value",
    [
        ("Carry", True),
        ("Total", -1),
        ("SpinRate", float("nan")),
        ("LaunchAngle", 91),
        ("HangTime", -2),
    ],
)
def test_bad_measurements(report, field, value):
    """Reject corrupt measurements instead of manufacturing usable data."""
    report["StrokeGroups"][0]["Strokes"][0]["NormalizedMeasurement"][field] = value
    with pytest.raises(ValueError):
        parse(report)


def test_same_date_and_dedup_conflicts(report):
    """Merge restarted groups and overlapping reports without collapsing equal shots."""
    batch = parse(report)
    reordered = copy.deepcopy(report)
    reordered["StrokeGroups"][0]["Strokes"].reverse()
    report["StrokeGroups"].append(copy.deepcopy(report["StrokeGroups"][0]))
    assert len(parse(report)["shots"]) == 2
    merged, added = merge_snapshot(batch, parse(reordered)["shots"])
    assert added == 0 and merged == batch
    changed = copy.deepcopy(batch["shots"])
    changed[0]["carry_m"] = 120
    with pytest.raises(ValueError, match="Conflicting shot"):
        merge_snapshot(batch, changed)
    changed = copy.deepcopy(batch["shots"])
    for row in changed:
        row["session_id"] = "another-date"
        row["session_date"] = "2026-01-03"
    with pytest.raises(ValueError, match="Conflicting shot"):
        merge_snapshot(batch, changed)
    legacy = copy.deepcopy(batch)
    legacy["shots"][0]["shot_id"] = "old-manual-001"
    with pytest.raises(ValueError, match="legacy"):
        merge_snapshot(legacy, batch["shots"])


def test_unknown_club_and_settings(report):
    """Require explicit equipment and normalization context."""
    report["StrokeGroups"][0]["Club"] = "6Iron"
    with pytest.raises(ValueError, match="physical club"):
        parse(report)
    for url in (
        URL.replace("nd=true", "nd=maybe"),
        URL.replace("&nd_temperature=25", ""),
        URL + "&nd_altitudeUnit=Feet",
        URL + "&nd=false",
    ):
        with pytest.raises(ValueError):
            parse(report, url)
    with pytest.raises(ValueError):
        report_settings(URL.replace("https:", "http:"))


def test_cli_preview_apply_backup_and_conflict(tmp_path: Path, report):
    """Preview stays read-only, writes preserve old rows, and repeat imports do nothing."""
    folder = tmp_path / "raw"
    folder.mkdir()
    (folder / "report-link.txt").write_text(URL)
    cache = folder / "trackman-report.json"
    cache.write_text(
        json.dumps(
            {"version": 1, "source_url": URL, "resolved_url": URL, "report": report}
        )
    )
    config = tmp_path / "config.json"
    config.write_text(json.dumps(CONFIG))
    snapshot = tmp_path / "snapshot.json"
    snapshot.write_text(json.dumps(EMPTY))
    original = snapshot.read_bytes()
    args = [
        "trackman",
        str(folder),
        "--config",
        str(config),
        "--snapshot",
        str(snapshot),
    ]
    assert main(args) == 0
    assert snapshot.read_bytes() == original
    assert main([*args, "--apply"]) == 0
    assert next((tmp_path / "backups").glob("*.json")).read_bytes() == original
    imported = snapshot.read_bytes()
    modified = snapshot.stat().st_mtime_ns
    assert main([*args, "--apply"]) == 0
    assert snapshot.stat().st_mtime_ns == modified
    report["StrokeGroups"][0]["Strokes"][0]["NormalizedMeasurement"]["Carry"] = 120
    cached = json.loads(cache.read_text())
    cached["report"] = report
    cache.write_text(json.dumps(cached))
    assert main([*args, "--apply"]) == 2
    assert snapshot.read_bytes() == imported
    (folder / "report-link.txt").write_text(URL + "&u=m")
    with pytest.raises(ValueError, match="does not match"):
        load_report(folder)


def test_fetch_redirect_and_payload(monkeypatch, report):
    """Use the observed endpoint and request settings without credentials."""
    calls = []

    def fake_request(url, *, payload=None):
        calls.append((url, payload))
        if len(calls) == 1:
            return 302, URL, b""
        if payload is None:
            return 200, None, b"<html/>"
        return 200, None, json.dumps(report).encode()

    monkeypatch.setattr("club_picker.trackman_fetch.request", fake_request)
    result = fetch_report("https://tm-short.me/invented")
    assert result["resolved_url"] == URL
    assert calls[-1][1] == {
        "ActivityId": "00000000-0000-0000-0000-000000000001",
        "Altitude": 0.0,
        "Temperature": 25.0,
        "BallType": "Premium",
    }
    with pytest.raises(ValueError, match="Unsupported"):
        request("https://example.com/private")
