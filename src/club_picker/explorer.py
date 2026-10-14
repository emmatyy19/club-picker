"""Export reviewed measurements into a private, versioned explorer snapshot."""

from dataclasses import asdict
from typing import TypedDict

from club_picker.shots import Shot


class Snapshot(TypedDict):
    """Private browser interchange, never a public-data export."""

    kind: str
    version: int
    distance_unit: str
    shots: list[dict[str, str | float | None]]


def explorer_snapshot(
    shots: list[Shot], *, session_sets: dict[tuple[str, str], str]
) -> Snapshot:
    """Require explicit session assignments and reject conflicting identities.

    Callers must obtain owner confirmation or an explicit standing default.
    Provider names and
    club labels never establish physical set identity. Input is already parsed
    through the manual format; raw exports and unrecognized fields stay out.
    """
    rows: list[dict[str, str | float | None]] = []
    seen: dict[tuple[str, ...], Shot] = {}
    clubs: dict[str, tuple[str, str]] = {}
    dates: dict[tuple[str, str], str | None] = {}
    for shot in shots:
        session = (str(shot.source), shot.session_id)
        set_id = session_sets.get(session, "").strip()
        if not set_id or any(ord(char) < 32 for char in set_id):
            raise ValueError(f"Explicit club-set assignment required for {session}")
        club = (set_id, shot.club_label)
        if shot.club_id in clubs and clubs[shot.club_id] != club:
            raise ValueError(f"Conflicting physical club identity: {shot.club_id}")
        clubs[shot.club_id] = club
        day = shot.session_date.isoformat() if shot.session_date else None
        if session in dates and dates[session] != day:
            raise ValueError(f"Conflicting session dates: {session}")
        dates[session] = day
        if shot.identity in seen:
            if seen[shot.identity] != shot:
                raise ValueError(f"Conflicting shot identity: {shot.identity}")
            continue
        seen[shot.identity] = shot
        # Shot is the explicit validated contract, not arbitrary provider columns.
        row: dict[str, str | float | None] = asdict(shot)
        row["session_date"] = day
        row["set_id"] = set_id
        rows.append(row)
    return Snapshot(
        kind="club-picker-explorer", version=1, distance_unit="m", shots=rows
    )
