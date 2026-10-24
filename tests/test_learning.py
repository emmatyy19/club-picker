"""Invented chronological checks for fitting, tuning, and fallback reporting."""

import json
from dataclasses import asdict, replace
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

from club_picker.evaluation import Observation
from club_picker.learning import experiment, features, fit, train
from club_picker.learning_report import render, synthetic_exercise, write_experiment


def series(count: int = 17) -> list[Observation]:
    """Create an upward trajectory with two outcomes on each date."""
    return [
        Observation(
            ("set-a", "7i"),
            ("manual", "full"),
            date(2030, 1, 1) + timedelta(days=i),
            100 + i * 0.8 + error,
            "7 iron",
        )
        for i in range(count)
        for error in (-2, 2)
    ]


def test_features_and_fitting_ignore_current_and_future_outcomes() -> None:
    """Changing held-out shots cannot alter fitted scaling, tuning or prediction."""
    rows = series()
    first = experiment(rows)
    changed = experiment(
        [replace(r, carry=900) if r.day >= date(2030, 1, 15) else r for r in rows]
    )
    for key in ("diagnostics",):
        a = [r for r in first[key] if r["session"] <= 15]  # type: ignore[union-attr]
        b = [r for r in changed[key] if r["session"] <= 15]  # type: ignore[union-attr]
        assert a == b
    a = [r["prediction"] for r in first["results"] if r["session"] <= 15]  # type: ignore[union-attr]
    b = [r["prediction"] for r in changed["results"] if r["session"] <= 15]  # type: ignore[union-attr]
    assert a == b


def test_session_means_equal_weighted_individual_shot_fit() -> None:
    """Session size does not change the training objective or scaler weights."""
    history = [[100 + i, 102 + i] * (i + 1) for i in range(13)]
    ours = fit(history, alpha=1)
    xs, ys, weights = [], [], []
    for i in range(2, len(history)):
        baseline, values = features(history[:i])
        for value in history[i]:
            xs.append(values)
            ys.append(value - baseline)
            weights.append(1 / len(history[i]))
    scaler = StandardScaler().fit(xs, sample_weight=weights)
    sklearn = Ridge(alpha=1, solver="svd").fit(
        scaler.transform(xs), ys, sample_weight=weights
    )
    assert ours.center == pytest.approx(scaler.mean_)
    assert ours.scale == pytest.approx(scaler.scale_)
    assert ours.coefficients == pytest.approx(sklearn.coef_, abs=1e-10)
    assert ours.intercept == pytest.approx(sklearn.intercept_)
    assert ours.predict(*features(history)) == pytest.approx(
        float(sklearn.predict(scaler.transform([features(history)[1]]))[0])
        + features(history)[0]
    )


def test_constant_history_and_minimum_support() -> None:
    """Constant features remain finite, and a tie favors stronger shrinkage."""
    assert train([[100]] * 12) == (None, {})
    model, scores = train([[100]] * 13)
    assert model is not None
    assert model.alpha == 100
    assert model.predict(*features([[100]] * 13)) == pytest.approx(100)
    assert set(scores.values()) == {0}
    assert model.training_examples == 11
    with pytest.raises(ValueError):
        features([[100]])
    with pytest.raises(ValueError):
        fit([[100]] * 2, alpha=1)


def test_fallback_and_fitted_comparisons_are_paired() -> None:
    """Every method sees the same target groups; sparse groups only fall back."""
    result: dict[str, Any] = experiment(series())
    rows = result["results"]
    for session in range(3, 18):
        group = [r for r in rows if r["session"] == session]
        assert len(group) == 4
        assert len({r["shots"] for r in group}) == 1
        assert {r["fitted"] for r in group} == {session >= 14}
        if session < 14:
            assert next(
                r["prediction"] for r in group if r["model"] == "Ridge + fallback"
            ) == next(r["prediction"] for r in group if r["model"] == "Recent mean")
    assert len(result["diagnostics"]) == 4
    assert len(result["final_models"]) == 1
    assert "coverage" not in result["summary_fitted_only"]["Ridge + fallback"]


def test_other_sets_and_contexts_do_not_change_fit() -> None:
    """Separate physical sets and contexts cannot train each other's models."""
    first: dict[str, Any] = experiment(series())
    expanded: dict[str, Any] = experiment(
        series() + [replace(r, club=("set-z", "7i"), carry=600) for r in series()]
    )
    assert first["diagnostics"] == [
        r for r in expanded["diagnostics"] if r["context"] == "Context 1"
    ]


def test_serialized_model_preserves_prediction() -> None:
    """Numeric artifacts can reproduce inference without unpickling code."""
    from club_picker.learning import Model

    history = [[100 + i] for i in range(14)]
    fitted, _ = train(history)
    assert fitted is not None
    loaded = Model(**json.loads(json.dumps(asdict(fitted))))
    assert loaded.predict(*features(history)) == fitted.predict(*features(history))


def test_synthetic_report_and_provenance(tmp_path: Path) -> None:
    """Synthetic runs are reproducible, explicitly labeled and locally stored."""
    assert synthetic_exercise() == synthetic_exercise()
    result = write_experiment(None, tmp_path)
    html = (tmp_path / "report.html").read_text()
    assert "INVENTED LEARNING EXERCISE" in html
    assert result["data_kind"] == "invented"
    assert "2030-01" not in html
    assert "coefficients" in (tmp_path / "results.json").read_text()
    assert (
        json.loads((tmp_path / "manifest.private.json").read_text())["input_path"]
        is None
    )


def test_sparse_report_is_not_a_success_claim() -> None:
    """A short library shows no fitted results rather than manufactured success."""
    result = experiment(series(4))
    assert result["summary_fitted_only"] == {}
    assert "Not enough compatible dates" in render(result, synthetic=True)


def test_snapshot_cli_and_private_manifest(tmp_path: Path) -> None:
    """Exercise real-input routing and keep raw context solely in private provenance."""
    from club_picker.cli import main

    rows = [
        {
            "session_id": f"original-{i}",
            "shot_id": str(i),
            "set_id": "private-set",
            "club_id": "private-club",
            "club_label": "7 iron",
            "source": "manual",
            "session_date": f"2030-01-0{i}",
            "carry_m": 100 + i,
            "normalization_settings": "PRIVATE VENUE",
        }
        for i in range(1, 5)
    ]
    snapshot = tmp_path / "snapshot.json"
    snapshot.write_text(
        json.dumps(
            {
                "kind": "club-picker-explorer",
                "version": 1,
                "distance_unit": "m",
                "shots": rows,
            }
        )
    )
    output = tmp_path / "result"
    assert main(["learn", str(snapshot), "--output", str(output)]) == 0
    for name in ("report.html", "results.json"):
        text = (output / name).read_text()
        for secret in ("PRIVATE VENUE", "private-set", "2030-01", "original-1"):
            assert secret not in text
    assert "PRIVATE VENUE" in (output / "manifest.private.json").read_text()
    original = output / "results.json"
    before = original.read_bytes()
    assert main(["learn", str(original), "--output", str(output)]) == 2
    assert original.read_bytes() == before
