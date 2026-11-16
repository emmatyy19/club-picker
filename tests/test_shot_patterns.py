"""Chronological and sparse-date checks for the flight-pattern experiment."""

from datetime import date

import pytest

from club_picker.shot_patterns import compare_patterns


def test_later_points_cannot_change_fitted_centers() -> None:
    """Changing later dates affects scoring only, regardless of import order."""
    points = [(30.0, 20.0), (31.0, 21.0), (30.5, 19.0), (40.0, 15.0), (41.0, 16.0)]
    days = {date(2020, 1, i): points.copy() for i in range(8, 0, -1)}
    days[date(2020, 1, 8)] = points[:2]
    first = compare_patterns(days)
    days[date(2020, 1, 7)] = [(60.0, 8.0)] * 5
    second = compare_patterns(days)
    assert first.training_dates == 4
    assert first.training_shots == 20
    assert first.later_shots == (5, 5, 5)
    assert first.centers_speed_mps_launch_deg == second.centers_speed_mps_launch_deg
    assert first.speed_split_mps == second.speed_split_mps
    assert first.cluster_error < second.cluster_error
    assert second.later_cluster_counts[-1] == (0, 5)


def test_sparse_history_is_rejected() -> None:
    """A large single practice date cannot substitute for later dates."""
    with pytest.raises(ValueError, match="four training"):
        compare_patterns({date(2020, 1, 1): [(30.0, 20.0)] * 50})
