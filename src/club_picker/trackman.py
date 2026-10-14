"""Read shared Trackman activity reports into the private explorer library."""

import hashlib
import json
import math
import os
import re
import tempfile
from datetime import date
from pathlib import Path
from typing import cast
from urllib.parse import parse_qs, urlsplit
from uuid import UUID

from club_picker.explorer import Snapshot, explorer_snapshot
from club_picker.shots import parse_shot

FLIGHT = {
    "ball_speed_mps": "BallSpeed",
    "spin_rpm": "SpinRate",
    "launch_deg": "LaunchAngle",
    "apex_m": "MaxHeight",
    "landing_deg": "LandingAngle",
    "hang_time_s": "HangTime",
    "curve_m": "Curve",
}


def object_value(value: object) -> dict[str, object]:
    """Require a JSON object at an external boundary."""
    if not isinstance(value, dict):
        raise ValueError("Expected a JSON object")
    return cast(dict[str, object], value)


def array_value(value: object) -> list[object]:
    """Require a JSON array at an external boundary."""
    if not isinstance(value, list):
        raise ValueError("Expected a JSON array")
    return cast(list[object], value)


def text_value(value: object, *, limit: int = 500) -> str:
    """Require nonempty text without control characters."""
    if (
        not isinstance(value, str)
        or not value.strip()
        or len(value) > limit
        or any(ord(c) < 32 for c in value)
    ):
        raise ValueError("Expected nonempty text without control characters")
    return value


def number(value: object) -> float | None:
    """Retain absent measurements while rejecting nonfinite and boolean values."""
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise ValueError("Expected a numeric measurement")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("Measurement must be finite")
    return result


def read_object(path: Path) -> dict[str, object]:
    """Load a JSON object from private storage."""
    return object_value(json.loads(path.read_text()))


def report_settings(url: str) -> tuple[str, dict[str, object]]:
    """Interpret the verified activity-report URL and normalization parameters."""
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "web-dynamic-reports.trackmangolf.com"
        or parsed.username
        or parsed.password
        or parsed.port not in (None, 443)
    ):
        raise ValueError("Expected a Trackman dynamic report URL")
    query = parse_qs(parsed.query)
    if any(
        len(values) != 1
        for key, values in query.items()
        if key
        in {
            "a",
            "nd",
            "nd_altitude",
            "nd_temperature",
            "nd_ballType",
            "nd_altitudeUnit",
            "nd_temperatureUnit",
        }
    ):
        raise ValueError("Ambiguous report parameters")
    activity = str(UUID(query.get("a", [""])[0]))
    if (
        query.get("nd_altitudeUnit", ["Meters"])[0] != "Meters"
        or query.get("nd_temperatureUnit", ["Celsius"])[0] != "Celsius"
    ):
        raise ValueError("Only meter/Celsius normalization settings are supported")
    settings: dict[str, object] = {"ActivityId": activity}
    for parameter, field in (
        ("nd_altitude", "Altitude"),
        ("nd_temperature", "Temperature"),
    ):
        if parameter in query:
            settings[field] = number(float(query[parameter][0]))
    if "nd_ballType" in query:
        settings["BallType"] = text_value(query["nd_ballType"][0])
    return query.get("nd", [""])[0], settings


def parse_report(
    report: dict[str, object],
    *,
    url: str,
    config: dict[str, object],
    set_id: str | None = None,
) -> Snapshot:
    """Allowlist measurements, preserving physical clubs and provider shot identity."""
    if config.get("version") != 1 or report.get("Kind") != "multiGroupReport":
        raise ValueError("Unsupported config version or Trackman report kind")
    selected_set = text_value(set_id or config.get("default_set_id"))
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", selected_set):
        raise ValueError("Set ID must use letters, numbers, underscores or hyphens")
    clubs = object_value(object_value(config.get("club_sets")).get(selected_set))
    mode, settings = report_settings(url)
    if mode not in ("", "true", "false"):
        raise ValueError("Invalid normalization mode")
    flag = object_value(report.get("Settings")).get("ShowNormalizedData")
    if not mode and not isinstance(flag, bool):
        raise ValueError("Normalization mode is missing")
    normalized = mode == "true" if mode else flag is True
    context = "unknown"
    if normalized:
        if not {"Altitude", "Temperature", "BallType"} <= settings.keys():
            raise ValueError(
                "Normalized report requires explicit normalization settings"
            )
        context = (
            f"{settings['Temperature']:g} C; altitude {settings['Altitude']:g} m; "
            f"{str(settings['BallType']).lower()} normalization model"
        )
    rows: list[dict[str, str | float | None]] = []
    for group_value in array_value(report.get("StrokeGroups")):
        group = object_value(group_value)
        day = text_value(group.get("Date"))
        if date.fromisoformat(day).isoformat() != day:
            raise ValueError("Session date must be YYYY-MM-DD")
        provider_club = text_value(group.get("Club"))
        if provider_club not in clubs:
            raise ValueError(f"Configure a physical club mapping for {provider_club}")
        club = object_value(clubs[provider_club])
        session = f"trackman-{day}-{selected_set}"
        for stroke_value in array_value(group.get("Strokes")):
            stroke = object_value(stroke_value)
            if stroke.get("Club") != provider_club:
                raise ValueError("Shot and group clubs disagree")
            provider_id = str(UUID(text_value(stroke.get("Id"))))
            shot_id = "tm-" + hashlib.sha256(provider_id.encode()).hexdigest()[:32]
            measurement = object_value(
                stroke.get("NormalizedMeasurement" if normalized else "Measurement")
            )
            values = {
                key: number(measurement.get(key))
                for key in (
                    "Carry",
                    "Total",
                    "CarrySide",
                    "TotalSide",
                    *FLIGHT.values(),
                )
            }
            if values["Carry"] is None:
                raise ValueError("A shot is missing carry; review it before importing")
            if values["CarrySide"] is None:
                values["CarrySide"] = number(measurement.get("Side"))
            record = {
                "session_id": session,
                "shot_id": shot_id,
                "club_id": text_value(club.get("club_id")),
                "club_label": text_value(club.get("club_label")),
                "source": "trackman",
                "distance_unit": "m",
                "session_date": day,
                "normalization": "normalized" if normalized else "unadjusted",
                "normalization_settings": context,
                "carry_basis": "modeled" if normalized else "unknown",
                "total_basis": "modeled",
            }
            for field, key in (
                ("carry", "Carry"),
                ("total", "Total"),
                ("carry_side", "CarrySide"),
                ("total_side", "TotalSide"),
            ):
                record[field] = "" if values[key] is None else str(values[key])
            row = explorer_snapshot(
                [parse_shot(record)], session_sets={("trackman", session): selected_set}
            )["shots"][0]
            for field, key in FLIGHT.items():
                value = values[key]
                if value is not None:
                    if field in ("launch_deg", "landing_deg"):
                        if not -90 <= value <= 90:
                            raise ValueError(f"Invalid {field}")
                    elif field != "curve_m" and value < 0:
                        raise ValueError(f"Invalid {field}")
                row[field] = value
            rows.append(row)
    if not rows:
        raise ValueError("Report contains no shots")
    empty = Snapshot(
        kind="club-picker-explorer", version=1, distance_unit="m", shots=[]
    )
    return merge_snapshot(empty, rows)[0]


def merge_snapshot(
    existing: dict[str, object] | Snapshot,
    incoming: list[dict[str, str | float | None]],
) -> tuple[Snapshot, int]:
    """Reject conflicts and legacy overlap; retain existing rows without rounding."""
    if (
        existing.get("kind"),
        existing.get("version"),
        existing.get("distance_unit"),
    ) != ("club-picker-explorer", 1, "m"):
        raise ValueError("Unsupported explorer snapshot")
    rows: list[dict[str, str | float | None]] = []
    seen: dict[tuple[str, str], dict[str, str | float | None]] = {}
    clubs: dict[str, tuple[str, str]] = {}
    sessions: dict[tuple[str, str], tuple[object, str]] = {}
    legacy_sessions: set[tuple[object, object]] = set()
    originals = array_value(existing.get("shots"))
    for raw in originals:
        row = object_value(raw)
        if row.get("source") == "trackman" and not re.fullmatch(
            r"tm-[0-9a-f]{32}", text_value(row.get("shot_id"))
        ):
            legacy_sessions.add((row.get("session_date"), row.get("set_id")))
    for index, raw in enumerate([*originals, *incoming]):
        value = object_value(raw)
        if any(
            not isinstance(v, str | int | float | type(None)) or isinstance(v, bool)
            for v in value.values()
        ):
            raise ValueError("Invalid explorer row")
        row = cast(dict[str, str | float | None], value)
        source, session, shot = (
            text_value(row.get(k)) for k in ("source", "session_id", "shot_id")
        )
        club_id, label, set_id = (
            text_value(row.get(k)) for k in ("club_id", "club_label", "set_id")
        )
        if (
            index >= len(originals)
            and source == "trackman"
            and (row.get("session_date"), set_id) in legacy_sessions
        ):
            raise ValueError(
                "This date has legacy Trackman IDs; reconcile its source ledger first"
            )
        club = (set_id, label)
        if club_id in clubs and clubs[club_id] != club:
            raise ValueError("Conflicting physical club identity")
        clubs[club_id] = club
        context = (row.get("session_date"), set_id)
        if (source, session) in sessions and sessions[source, session] != context:
            raise ValueError("Conflicting session date or set")
        sessions[source, session] = context
        # New Trackman hashes identify a swing globally, even if its set/date changes.
        identity = (
            source,
            shot
            if source == "trackman" and shot.startswith("tm-")
            else f"{session}/{shot}/{row.get('normalization')}/{row.get('compensation')}",
        )
        if identity in seen:
            if index < len(originals):
                raise ValueError("Existing library contains duplicate identities")
            if seen[identity] != row:
                raise ValueError("Conflicting shot identity; library left unchanged")
            continue
        seen[identity] = row
        rows.append(row)
    return Snapshot(
        kind="club-picker-explorer", version=1, distance_unit="m", shots=rows
    ), len(rows) - len(originals)


def save_snapshot(path: Path, snapshot: Snapshot) -> None:
    """Back up an existing library and replace it atomically after validation."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        original = path.read_bytes()
        backups = path.parent / "backups"
        backups.mkdir(exist_ok=True)
        backup = (
            backups / f"{path.stem}-{hashlib.sha256(original).hexdigest()[:16]}.json"
        )
        if not backup.exists():
            backup.write_bytes(original)
            backup.chmod(0o600)
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, prefix=".trackman-")
    try:
        with os.fdopen(descriptor, "w") as stream:
            json.dump(snapshot, stream, indent=2, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)
