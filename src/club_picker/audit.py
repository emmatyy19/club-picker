"""Describe imported evidence without making recommendation or risk claims."""

from collections import defaultdict
from statistics import median
from typing import TypedDict

from club_picker.shots import Quality, Shot, Unit


class Group(TypedDict):
    """Observed carry statistics for a compatible group of shots."""

    club_id: str
    club_label: str
    source: str
    shot_intent: str
    normalization: str
    ball_compensation: str
    carry_basis: str
    session_mode: str
    normalization_settings: str
    ball_type: str
    surface: str
    shots: int
    sessions: int
    dated_sessions: int
    carry_side_shots: int
    carry_min: float
    carry_median: float
    carry_max: float


class Audit(TypedDict):
    """A private inventory of data support and missing context."""

    schema_version: int
    distance_unit: str
    total_shots: int
    usable_shots: int
    flagged_shots: int
    undated_shots: int
    session_order: list[dict[str, str]]
    groups: list[Group]


def audit_shots(shots: list[Shot], *, unit: Unit = Unit.YARDS) -> Audit:
    """Group compatible observations and sort known sessions chronologically."""
    grouped: dict[tuple[str, ...], list[Shot]] = defaultdict(list)
    for shot in shots:
        if shot.quality == Quality.USABLE:
            key = (
                shot.club_id,
                shot.source,
                shot.intent,
                shot.normalization,
                shot.compensation,
                shot.carry_basis,
                shot.session_mode,
                shot.normalization_settings,
                shot.ball_type,
                shot.surface,
            )
            grouped[key].append(shot)
    groups: list[Group] = []
    for key, members in sorted(grouped.items()):
        distances = [shot.carry_m / unit.meters for shot in members]
        groups.append(
            Group(
                club_id=key[0],
                club_label=members[0].club_label,
                source=key[1],
                shot_intent=key[2],
                normalization=key[3],
                ball_compensation=key[4],
                carry_basis=key[5],
                session_mode=key[6],
                normalization_settings=key[7],
                ball_type=key[8],
                surface=key[9],
                shots=len(members),
                sessions=len({shot.session_id for shot in members}),
                dated_sessions=len(
                    {shot.session_id for shot in members if shot.session_date}
                ),
                carry_side_shots=sum(shot.carry_side_m is not None for shot in members),
                carry_min=min(distances),
                carry_median=median(distances),
                carry_max=max(distances),
            )
        )
    dated = sorted(
        {
            (shot.session_date, shot.source, shot.session_id)
            for shot in shots
            if shot.session_date is not None
        }
    )
    return Audit(
        schema_version=1,
        distance_unit=unit,
        total_shots=len(shots),
        usable_shots=sum(shot.quality == Quality.USABLE for shot in shots),
        flagged_shots=sum(shot.quality != Quality.USABLE for shot in shots),
        undated_shots=sum(shot.session_date is None for shot in shots),
        session_order=[
            {"session_date": day.isoformat(), "source": source, "session_id": session}
            for day, source, session in dated
        ],
        groups=groups,
    )
