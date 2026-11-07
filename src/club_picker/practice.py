"""Date-balanced descriptions of practice changes and adjacent club gaps."""

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from itertools import pairwise
from math import isfinite
from statistics import fmean

from club_picker.evaluation import quantile
from club_picker.practice_data import CONTEXT_FIELDS, METRICS, PracticeShot
from club_picker.trackman import FLIGHT

MIN_SHOTS = 5
WINDOW_DATES = 3
DateValues = dict[date, list[float]]


@dataclass(frozen=True)
class Summary:
    """Observed equal-date quantiles; these are not predictive bounds."""

    low: float
    median: float
    high: float
    spread: float
    absolute_miss: float
    shots: int
    dates: list[str]


def summarize(values: DateValues) -> Summary:
    """Give every date equal mass using the app's empirical quantile convention."""
    if not values or any(
        not vs or any(not isfinite(v) for v in vs) for vs in values.values()
    ):
        raise ValueError("Need nonempty dates")
    points = sorted(
        (v, 1 / len(values) / len(vs)) for vs in values.values() for v in vs
    )
    low, median, high = (quantile(points, p) for p in (0.1, 0.5, 0.9))
    return Summary(
        low,
        median,
        high,
        high - low,
        quantile(sorted((abs(v), w) for v, w in points), 0.5),
        len(points),
        [d.isoformat() for d in sorted(values)],
    )


@dataclass(frozen=True)
class DateSummary:
    """One date's observations, including sparse dates omitted from comparisons."""

    day: str
    shots: int
    median: float
    low: float
    high: float
    eligible: bool


@dataclass(frozen=True)
class Comparison:
    """Two disjoint three-date windows or an explicit lack of support."""

    history: list[DateSummary]
    eligible_dates: int
    prior: Summary | None
    recent: Summary | None
    median_change: float | None
    spread_change: float | None
    absolute_miss_change: float | None
    prior_short: float | None
    recent_short: float | None
    short_threshold: float | None


def compare(values: DateValues, *, carry: bool = False) -> Comparison:
    """Freeze prior carry P10 and score both periods with equal date weights."""
    history: list[DateSummary] = []
    for day, vs in sorted(values.items()):
        s = summarize({day: vs})
        history.append(
            DateSummary(
                day.isoformat(), len(vs), s.median, s.low, s.high, len(vs) >= MIN_SHOTS
            )
        )
    days = sorted(d for d, vs in values.items() if len(vs) >= MIN_SHOTS)
    if len(days) < 2 * WINDOW_DATES:
        return Comparison(
            history, len(days), None, None, None, None, None, None, None, None
        )
    prior_values = {d: values[d] for d in days[-2 * WINDOW_DATES : -WINDOW_DATES]}
    recent_values = {d: values[d] for d in days[-WINDOW_DATES:]}
    prior, recent = summarize(prior_values), summarize(recent_values)
    threshold = prior.low if carry else None

    def short(window: DateValues) -> float | None:
        return (
            fmean(sum(v < prior.low for v in vs) / len(vs) for vs in window.values())
            if carry
            else None
        )

    return Comparison(
        history,
        len(days),
        prior,
        recent,
        recent.median - prior.median,
        recent.spread - prior.spread,
        recent.absolute_miss - prior.absolute_miss,
        short(prior_values),
        short(recent_values),
        threshold,
    )


@dataclass(frozen=True)
class Availability:
    """Present usable dated values and independently supported practice dates."""

    present: int
    missing: int
    eligible_dates: int


@dataclass(frozen=True)
class ClubInsights:
    """One physical club in one fully recorded measurement context."""

    set_id: str
    club_id: str
    label: str
    context: dict[str, str]
    shots: int
    flagged: int
    undated: int
    fields: dict[str, Availability]
    comparisons: dict[str, Comparison]


def _values(rows: list[PracticeShot], metric: str) -> DateValues:
    result: DateValues = defaultdict(list)
    for row in rows:
        value = row.value(metric)
        if row.shot.quality == "usable" and row.shot.session_date and value is not None:
            result[row.shot.session_date].append(value)
    return dict(result)


def club_insights(rows: list[PracticeShot]) -> list[ClubInsights]:
    """Audit all contexts; do not infer intents or substitute lateral fields."""
    groups: dict[tuple[str, str, tuple[str, ...]], list[PracticeShot]] = defaultdict(
        list
    )
    for row in rows:
        groups[row.set_id, row.shot.club_id, row.context].append(row)
    result: list[ClubInsights] = []
    for (set_id, club_id, context), group in sorted(
        groups.items(),
        key=lambda item: (
            item[0][0],
            club_order(item[1][0].shot.club_label),
            item[0][1],
            item[0][2],
        ),
    ):
        eligible = sum(
            r.shot.quality == "usable" and r.shot.session_date is not None
            for r in group
        )
        fields: dict[str, Availability] = {}
        for metric in (*METRICS, *FLIGHT):
            values = _values(group, metric)
            n = sum(map(len, values.values()))
            fields[metric] = Availability(
                n, eligible - n, sum(len(vs) >= MIN_SHOTS for vs in values.values())
            )
        result.append(
            ClubInsights(
                set_id,
                club_id,
                group[0].shot.club_label,
                dict(zip(CONTEXT_FIELDS, context, strict=True)),
                len(group),
                sum(r.shot.quality != "usable" for r in group),
                sum(r.shot.session_date is None for r in group),
                fields,
                {m: compare(_values(group, m), carry=m == "carry_m") for m in METRICS},
            )
        )
    return result


def club_order(label: str) -> tuple[int, int]:
    """Use conventional club families and wedge lofts, never observed distance."""
    name = label.lower().strip()
    if name in {"driver", "dr", "1 wood"}:
        return (0, 0)
    match = re.fullmatch(r"(\d+)\s*(wood|hybrid|iron)", name)
    if match:
        return ({"wood": 1, "hybrid": 2, "iron": 3}[match[2]], int(match[1]))
    wedges = {
        "pw": 46,
        "pitching wedge": 46,
        "gw": 50,
        "gap wedge": 50,
        "aw": 52,
        "approach wedge": 52,
        "sw": 56,
        "sand wedge": 56,
        "lw": 60,
        "lob wedge": 60,
    }
    if name in wedges:
        return (4, wedges[name])
    loft = re.fullmatch(r"([4-6]\d|7[0-2])(?:°| degree| wedge)?", name)
    return (4, int(loft[1])) if loft else (99, 0)


@dataclass(frozen=True)
class GapClub:
    """Club band and its actual support inside the common reference window."""

    club_id: str
    label: str
    summary: Summary | None
    limited: bool


@dataclass(frozen=True)
class ClubGap:
    """Signed neighbor gap and observed band overlap, including same-date support."""

    longer: str
    shorter: str
    gap: float | None
    overlap: float | None
    common_dates: list[str]
    common_longer: Summary | None
    common_shorter: Summary | None
    common_gap: float | None


@dataclass(frozen=True)
class GapMap:
    """One set/context bag, with a shared reference window and honest missing clubs."""

    set_id: str
    context: dict[str, str]
    reference_dates: list[str]
    clubs: list[GapClub]
    gaps: list[ClubGap]


def gap_maps(rows: list[PracticeShot]) -> list[GapMap]:
    """Compare normal-order neighbors using only the latest three supported dates."""
    bags: dict[str, dict[str, str]] = defaultdict(dict)
    contexts: dict[tuple[str, tuple[str, ...]], list[PracticeShot]] = defaultdict(list)
    for row in rows:
        bags[row.set_id][row.shot.club_id] = row.shot.club_label
        contexts[row.set_id, row.context].append(row)
    result: list[GapMap] = []
    for (set_id, context), group in sorted(contexts.items()):
        values = {
            club: _values([r for r in group if r.shot.club_id == club], "carry_m")
            for club in bags[set_id]
        }
        supported = {
            club: {d: vs for d, vs in dates.items() if len(vs) >= MIN_SHOTS}
            for club, dates in values.items()
        }
        dates = sorted({d for v in supported.values() for d in v})[-WINDOW_DATES:]
        window = {
            club: {d: vs for d, vs in v.items() if d in dates}
            for club, v in supported.items()
        }
        ordered = sorted(bags[set_id], key=lambda c: (club_order(bags[set_id][c]), c))
        clubs = [
            GapClub(
                c,
                bags[set_id][c],
                summarize(window[c]) if window[c] else None,
                len(window[c]) < WINDOW_DATES,
            )
            for c in ordered
        ]
        gaps: list[ClubGap] = []
        for a, b in pairwise(clubs):
            # Unknown/equivalent labels cannot establish a meaningful bag neighbor.
            if (
                club_order(a.label) >= club_order(b.label)
                or club_order(b.label)[0] == 99
            ):
                continue
            x, y = a.summary, b.summary
            common = sorted(window[a.club_id].keys() & window[b.club_id].keys())
            ca = (
                summarize({d: window[a.club_id][d] for d in common}) if common else None
            )
            cb = (
                summarize({d: window[b.club_id][d] for d in common}) if common else None
            )
            gaps.append(
                ClubGap(
                    a.label,
                    b.label,
                    x.median - y.median if x and y else None,
                    max(0, min(x.high, y.high) - max(x.low, y.low))
                    if x and y
                    else None,
                    [d.isoformat() for d in common],
                    ca,
                    cb,
                    ca.median - cb.median if ca and cb else None,
                )
            )
        result.append(
            GapMap(
                set_id,
                dict(zip(CONTEXT_FIELDS, context, strict=True)),
                [d.isoformat() for d in dates],
                clubs,
                gaps,
            )
        )
    return result
