"""Invented practice insights: weighting, chronology, support, and private output."""

import json
from dataclasses import asdict, replace
from datetime import date
from pathlib import Path

import pytest

from club_picker.approach import summarize_carry
from club_picker.cli import main
from club_picker.explorer import explorer_snapshot
from club_picker.practice import club_insights, club_order, compare, gap_maps, summarize
from club_picker.practice_data import PracticeShot, practice_shots
from club_picker.practice_report import render_practice, write_practice
from club_picker.shots import Quality, Unit, parse_shot


def sample(
    day: int,
    value: float,
    *,
    club: str = "7 iron",
    source: str = "manual",
    set_id: str = "a",
    side: float | None = None,
    intent: str = "unknown",
    index: int = 0,
) -> PracticeShot:
    """Construct a typed, invented canonical shot with optional signed side."""
    shot = parse_shot(
        {
            "session_id": f"invented-{source}-{set_id}-{day}",
            "shot_id": f"{club}-{index}",
            "club_id": f"{set_id}-{club}",
            "club_label": club,
            "source": source,
            "distance_unit": "m",
            "carry": str(value),
            "total": str(value + 10),
            "total_side": str(side) if side is not None else "",
            "session_date": f"2030-01-{day:02}",
            "shot_intent": intent,
        }
    )
    return PracticeShot(shot, set_id, {})


def history() -> list[PracticeShot]:
    """Supply three earlier and three later dates with a carry and side shift."""
    return [
        sample(d, v, side=v - 105, index=i)
        for d in range(1, 7)
        for i, v in enumerate(
            [90, 95, 100, 105, 110] if d <= 3 else [100, 105, 110, 115, 120]
        )
    ]


def payload(rows: list[PracticeShot]) -> dict[str, object]:
    """Serialize the canonical snapshot rather than a provider-specific fixture."""
    return dict(
        explorer_snapshot(
            [r.shot for r in rows],
            session_sets={
                (str(r.shot.source), r.shot.session_id): r.set_id for r in rows
            },
        )
    )


def test_quantiles_equal_date_weight_and_reference_parity() -> None:
    """Repeating all shots in a long date cannot increase that date's mass."""
    values = {date(2030, 1, 1): [10] * 100, date(2030, 1, 2): [100]}
    s = summarize(values)
    reference = summarize_carry(list(values.values()))
    assert (
        (s.low, s.median, s.high)
        == (reference.low, reference.median, reference.high)
        == (10, 55, 100)
    )
    changed = summarize({**values, date(2030, 1, 1): [10] * 1000})
    assert (changed.low, changed.median, changed.high) == (s.low, s.median, s.high)
    assert summarize({date(2030, 1, 1): [-10, 0, 10]}).median == 0
    for bad in ({}, {date(2030, 1, 1): []}, {date(2030, 1, 1): [float("nan")]}):
        with pytest.raises(ValueError):
            summarize(bad)


def test_browser_parity_fixture() -> None:
    """Pin the browser's invented fixture to the Python reference calculations."""
    fixture = json.loads(
        (Path(__file__).parent / "fixtures/practice-insights.json").read_text()
    )
    for case in fixture["summaries"]:
        values = {date.fromisoformat(d): vs for d, vs in case["dates"].items()}
        assert asdict(summarize(values)) == case["expected"]
    for case in fixture["comparisons"]:
        values = {date.fromisoformat(d): vs for d, vs in case["dates"].items()}
        result = compare(values)
        assert {
            "eligible": result.eligible_dates,
            "earlier": asdict(result.prior) if result.prior else None,
            "recent": asdict(result.recent) if result.recent else None,
        } == case["expected"]


def test_disjoint_chronology_sparse_dates_and_fixed_short_threshold() -> None:
    """Recent measurements never change the earlier window or its tail threshold."""
    values = {
        date(2030, 1, d): [90, 100, 110, 120, 130] if d <= 3 else [50, 60, 70, 80, 90]
        for d in range(1, 7)
    }
    values[date(2030, 1, 7)] = [1000] * 4
    c = compare(dict(reversed(list(values.items()))), carry=True)
    assert c.prior and c.recent
    assert c.prior.dates == ["2030-01-01", "2030-01-02", "2030-01-03"]
    assert c.recent.dates == ["2030-01-04", "2030-01-05", "2030-01-06"]
    assert c.short_threshold == 90
    assert c.prior_short == 0
    assert c.recent_short == pytest.approx(0.8)
    assert c.history[-1].eligible is False
    changed = compare(values | {date(2030, 1, 6): [500] * 20}, carry=True)
    assert changed.prior == c.prior and changed.short_threshold == c.short_threshold
    assert compare(dict(list(values.items())[:5]), carry=True).prior is None


def test_side_bias_spread_absolute_miss_and_population_support() -> None:
    """Signed side and absolute side answer different questions; absent carry side stays absent."""
    rows = history()
    g = club_insights(rows)[0]
    c = g.comparisons["total_side_m"]
    assert c.prior and c.recent
    assert c.prior.median == -5
    assert c.recent.median == 5
    assert c.median_change == 10
    assert c.absolute_miss_change == 0
    assert c.spread_change == 0
    assert g.comparisons["carry_side_m"].prior is None
    assert g.fields["carry_side_m"].missing == 30
    assert g.fields["spin_rpm"].present == 0
    assert g.fields["total_side_m"].present == 30
    assert g.comparisons["total_m"].short_threshold is None
    sparse = [
        replace(r, shot=replace(r.shot, total_side_m=None))
        if r.shot.session_date == date(2030, 1, 6)
        else r
        for r in rows
    ]
    assert club_insights(sparse)[0].comparisons["total_side_m"].prior is None
    assert club_insights(sparse)[0].comparisons["carry_m"].prior is not None


def test_contexts_sets_intents_and_quality_do_not_pool() -> None:
    """Additional providers, settings, and shots cannot manufacture compatible dates."""
    rows = history()
    variants = [sample(1, 500, source="toptracer", index=i) for i in range(5)]
    variants += [sample(1, 500, set_id="b", index=i) for i in range(5)]
    variants += [sample(1, 500, intent="partial", index=i) for i in range(5)]
    variants += [
        replace(r, shot=replace(r.shot, normalization_settings="different"))
        for r in rows[:5]
    ]
    variants += [
        replace(
            rows[0],
            shot=replace(
                rows[0].shot,
                quality=Quality.EXCLUDED,
                exclusion_reason="invented tracking error",
            ),
        )
    ]
    variants += [replace(rows[0], shot=replace(rows[0].shot, session_date=None))]
    groups = club_insights([*rows, *variants])
    assert len(groups) == 5
    original = next(
        g
        for g in groups
        if g.set_id == "a"
        and g.context["source"] == "manual"
        and g.context["intent"] == "unknown"
        and g.context["normalization_settings"] == "unknown"
    )
    assert original.flagged == 1 and original.undated == 1
    assert original.comparisons == club_insights(rows)[0].comparisons


def test_same_date_sessions_merge_only_within_a_context() -> None:
    """A program restart adds shots to a date rather than independent date support."""
    rows = history()[:3]
    more = [
        replace(r, shot=replace(r.shot, session_id="restart", shot_id=f"restart-{i}"))
        for i, r in enumerate(rows)
    ]
    c = club_insights([*rows, *more])[0].comparisons["carry_m"]
    assert c.eligible_dates == 1 and c.history[0].shots == 6
    assert c.prior is None


def test_bag_order_shared_window_missing_clubs_and_same_date_gap() -> None:
    """Missing recent clubs stay visible; shared-date comparisons use the same dates."""
    rows = [
        sample(d, v, club=club, index=i)
        for club, days, v in [
            ("7 iron", range(1, 7), 110),
            ("8 iron", range(4, 7), 100),
            ("9 iron", range(1, 4), 90),
        ]
        for d in days
        for i in range(5)
    ]
    maps = gap_maps(list(reversed(rows)))
    m = maps[0]
    assert m.reference_dates == ["2030-01-04", "2030-01-05", "2030-01-06"]
    assert [c.label for c in m.clubs] == ["7 iron", "8 iron", "9 iron"]
    assert m.clubs[2].summary is None and m.clubs[2].limited
    assert m.gaps[0].gap == m.gaps[0].common_gap == 10
    assert m.gaps[0].overlap == 0
    assert m.gaps[0].common_dates == m.reference_dates
    assert m.gaps[1].gap is None
    assert (
        club_order("Driver")
        < club_order("3 wood")
        < club_order("5 hybrid")
        < club_order("7 iron")
        < club_order("PW")
        < club_order("SW")
    )
    assert club_order("56°") == club_order("SW")


def test_gap_overlap_and_different_dates_are_not_pairwise_probability() -> None:
    """Overlapping carry bands and non-shared dates remain explicit descriptions."""
    rows = [
        sample(d, v, club=club, index=i)
        for club, days, vs in [
            ("7 iron", [1, 2], [90, 100, 110, 120, 130]),
            ("8 iron", [3], [80, 90, 100, 110, 120]),
        ]
        for d in days
        for i, v in enumerate(vs)
    ]
    m = gap_maps(rows)[0]
    assert m.gaps[0].gap == 10 and m.gaps[0].overlap == 30
    assert m.gaps[0].common_gap is None and m.gaps[0].common_dates == []
    assert all(c.limited for c in m.clubs)


def test_snapshot_validation_and_si_units_preserve_original_unit() -> None:
    """Reject malformed input, conflicting identities and unknown fields before analysis."""
    p = payload(history())
    rows = p["shots"]
    assert isinstance(rows, list)
    row = rows[0]
    variants = [row, row | {"source_unit": "yd"}]
    for v in variants:
        parsed, _ = practice_shots(p | {"shots": [v]})
        assert parsed[0].shot.carry_m == row["carry_m"]
    parsed, duplicates = practice_shots(p | {"shots": [row, row]})
    assert duplicates == 1 and len(parsed) == 1
    assert (
        practice_shots(p | {"shots": [row | {"total_distance_geometry": "radial"}]})[0][
            0
        ].total_geometry
        == "radial"
    )
    with pytest.raises(ValueError, match="Conflicting duplicate"):
        practice_shots(
            p | {"shots": [row, row | {"total_distance_geometry": "radial"}]}
        )
    for change in [
        {"carry_m": True},
        {"carry_m": float("inf")},
        {"carry_side_m": "2"},
        {"spin_rpm": -1},
        {"launch_deg": 91},
        {"venue": "do not allow"},
        {"source_unit": "ft"},
        {"source_unit": None},
        {"total_distance_geometry": "unknown geometry"},
        {"total_m": None, "total_side_m": 2},
    ]:
        with pytest.raises(ValueError):
            practice_shots(p | {"shots": [row | change]})
    for change in [
        {"carry_m": 5},
        {"set_id": "other"},
        {"club_label": "6 iron"},
        {"session_date": "2030-02-01"},
    ]:
        with pytest.raises(ValueError):
            practice_shots(p | {"shots": [row, row | change]})
    with pytest.raises(ValueError):
        practice_shots(p | {"version": True})
    assert (
        practice_shots(
            p | {"shots": [row | {"total_side_m": 0, "carry_side_m": None}]}
        )[0][0].shot.total_side_m
        == 0
    )
    assert parse_shot(
        {
            "session_id": "s",
            "shot_id": "s",
            "club_id": "c",
            "club_label": "7 iron",
            "source": "manual",
            "distance_unit": "yd",
            "carry": "100",
        }
    ).carry_m == pytest.approx(100 * Unit.YARDS.meters)


def test_cli_repeatability_output_units_empty_history_and_input_preservation(
    tmp_path: Path,
) -> None:
    """Generate the same report repeatedly, escape labels, and never overwrite input."""
    source = tmp_path / "snapshot.json"
    source.write_text(json.dumps(payload(history())))
    before = source.read_bytes()
    out = tmp_path / "private"
    assert main(["insights", str(source), "--output", str(out)]) == 0
    first = (out / "results.json").read_bytes()
    assert main(["insights", str(source), "--output", str(out)]) == 0
    assert (out / "results.json").read_bytes() == first
    assert source.read_bytes() == before
    assert "109.4" in (out / "report.html").read_text()  # Earlier 100 m in yards.
    report = write_practice(source, out, unit="m")
    assert (
        report.shots == 30
        and report.groups[0].comparisons["carry_m"].median_change == 10
    )
    assert "Measurement (m)" in render_practice(report)

    empty = tmp_path / "empty.json"
    empty.write_text(json.dumps(payload([])))
    assert write_practice(empty, out).shots == 0
    assert "No supported comparisons" in (out / "report.html").read_text()
    original = out / "results.json"
    original.write_bytes(before)
    with pytest.raises(ValueError, match="overwrite"):
        write_practice(original, out)
    malicious = [sample(1, 100, club="<script>untrusted</script>")]
    source.write_text(json.dumps(payload(malicious)))
    r = write_practice(source, out)
    assert "<script>" not in render_practice(r)
    assert "&lt;script&gt;" in render_practice(r)
    assert asdict(r)["min_shots_per_date"] == 5
