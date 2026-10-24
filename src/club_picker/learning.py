"""Bounded Ridge experiment using only lagged, compatible carry sessions."""

from collections import defaultdict
from dataclasses import asdict, dataclass
from math import sqrt
from statistics import fmean
from typing import Any

from club_picker.evaluation import Observation, backtest, distribution

FEATURES = (
    "recent_minus_stable_m",
    "last_minus_stable_m",
    "last_change_m",
    "historical_sd_m",
)
ALPHAS = (0.1, 1.0, 10.0, 100.0)
MIN_FIT = 8
TUNING_FOLDS = 3


def features(history: list[list[float]]) -> tuple[float, list[float]]:
    """Build exactly the same pre-session inputs for training and prediction."""
    if len(history) < 2:
        raise ValueError("Features need two earlier compatible dates.")
    stable = distribution(history)
    mean = fmean(fmean(session) for session in history)
    recent = sum(v * w for v, w in distribution(history, half_life=3))
    last, previous = fmean(history[-1]), fmean(history[-2])
    spread = sqrt(sum(w * (v - mean) ** 2 for v, w in stable))
    values = [recent - mean, last - mean, last - previous, spread]
    return mean, [0.0 if abs(value) < 1e-10 else value for value in values]


@dataclass(frozen=True)
class Model:
    """Portable numeric fit; no pickle or dependency on sklearn at inference."""

    alpha: float
    center: list[float]
    scale: list[float]
    coefficients: list[float]
    intercept: float
    training_examples: int

    def predict(self, baseline: float, values: list[float]) -> float:
        """Predict carry, respecting the physical lower bound of zero."""
        if len(values) != len(FEATURES):
            raise ValueError("Unexpected feature vector.")
        return max(
            0.0,
            baseline
            + self.intercept
            + sum(
                coefficient * (value - center) / scale
                for value, center, scale, coefficient in zip(
                    values, self.center, self.scale, self.coefficients, strict=True
                )
            ),
        )


def fit(history: list[list[float]], *, alpha: float) -> Model:
    """Fit date-balanced residuals; scaling sees only earlier training dates.

    Session-mean residual squared loss differs from equal-session individual-shot
    squared loss only by a constant within-session variance term.
    """
    # sklearn's untyped API is contained at this fitting boundary.
    try:
        from sklearn.linear_model import (  # pyright: ignore[reportMissingTypeStubs]
            Ridge,
        )
        from sklearn.preprocessing import (  # pyright: ignore[reportMissingTypeStubs]
            StandardScaler,
        )
    except ImportError as error:
        raise ValueError("Install ML dependencies with uv sync --extra ml.") from error
    if len(history) - 2 < MIN_FIT or alpha not in ALPHAS:
        raise ValueError("Insufficient training dates or unsupported alpha.")
    inputs: list[list[float]] = []
    targets: list[float] = []
    for i in range(2, len(history)):
        baseline, values = features(history[:i])
        inputs.append(values)
        targets.append(fmean(history[i]) - baseline)
    scaler: Any = StandardScaler()
    transformed: Any = scaler.fit_transform(inputs)
    estimator: Any = Ridge(alpha=alpha, solver="svd")
    estimator.fit(transformed, targets)
    return Model(
        alpha,
        list(map(float, scaler.mean_)),
        list(map(float, scaler.scale_)),
        list(map(float, estimator.coef_)),
        float(estimator.intercept_),
        len(inputs),
    )


def train(history: list[list[float]]) -> tuple[Model | None, dict[str, float]]:
    """Select alpha on three earlier expanding folds, then refit all history."""
    if len(history) < 2 + MIN_FIT + TUNING_FOLDS:
        return None, {}
    scores: dict[str, float] = {}
    for alpha in ALPHAS:
        errors: list[float] = []
        for i in range(len(history) - TUNING_FOLDS, len(history)):
            model = fit(history[:i], alpha=alpha)
            prediction = model.predict(*features(history[:i]))
            errors.append(sqrt(fmean((prediction - v) ** 2 for v in history[i])))
        scores[str(alpha)] = fmean(errors)
    selected = min(ALPHAS, key=lambda alpha: (scores[str(alpha)], -alpha))
    return fit(history, alpha=selected), scores


@dataclass(frozen=True)
class PointResult:
    """One pre-session point prediction; intervals are deliberately absent."""

    club: str
    context: str
    session: int
    shots: int
    history_sessions: int
    model: str
    prediction: float
    actual_mean: float
    rmse: float
    mae: float
    bias: float
    fitted: bool


def summarize(results: list[PointResult]) -> dict[str, dict[str, float]]:
    """Average dates within context, contexts within club, then physical clubs."""
    summary: dict[str, dict[str, float]] = {}
    for model in sorted({r.model for r in results}):
        summary[model] = {}
        for metric in ("rmse", "mae", "bias"):
            contexts: dict[tuple[str, str], list[float]] = defaultdict(list)
            for r in results:
                if r.model == model:
                    contexts[r.club, r.context].append(float(getattr(r, metric)))
            clubs: dict[str, list[float]] = defaultdict(list)
            for (club, _), values in contexts.items():
                clubs[club].append(fmean(values))
            summary[model][metric] = fmean(fmean(v) for v in clubs.values())
    return summary


def experiment(rows: list[Observation]) -> dict[str, object]:
    """Replay nested chronological fits alongside exactly matched baselines."""
    baseline, warmup = backtest(rows)
    days = {day: i + 1 for i, day in enumerate(sorted({r.day for r in rows}))}
    groups: dict[tuple[tuple[str, str], tuple[str, ...]], dict[int, list[float]]] = (
        defaultdict(lambda: defaultdict(list))
    )
    for row in rows:
        groups[row.club, row.context][days[row.day]].append(row.carry)
    results: list[PointResult] = []
    diagnostics: list[dict[str, object]] = []
    artifacts: list[dict[str, object]] = []
    for index, (_, dates) in enumerate(sorted(groups.items())):
        context = f"Context {index + 1}"
        history: list[list[float]] = []
        for session, actual in sorted(dates.items()):
            if len(history) >= 2:
                comparisons = [
                    f for f in baseline if f.context == context and f.session == session
                ]
                model, scores = train(history)
                for f in comparisons:
                    results.append(
                        PointResult(
                            f.club,
                            f.context,
                            f.session,
                            f.shots,
                            f.history_sessions,
                            f.model,
                            f.prediction,
                            f.actual_mean,
                            f.rmse,
                            f.mae,
                            f.bias,
                            model is not None,
                        )
                    )
                recent = next(f for f in comparisons if f.model == "Recent mean")
                prediction = (
                    model.predict(*features(history)) if model else recent.prediction
                )
                errors = [prediction - value for value in actual]
                results.append(
                    PointResult(
                        recent.club,
                        context,
                        session,
                        len(actual),
                        len(history),
                        "Ridge + fallback",
                        prediction,
                        fmean(actual),
                        sqrt(fmean(v * v for v in errors)),
                        fmean(abs(v) for v in errors),
                        fmean(errors),
                        model is not None,
                    )
                )
                if model:
                    diagnostics.append(
                        {
                            "context": context,
                            "session": session,
                            "fit": asdict(model),
                            "earlier_validation_rmse": scores,
                        }
                    )
            history.append(actual)
        final, scores = train(history)
        if final:
            artifacts.append(
                {
                    "context": context,
                    "fit": asdict(final),
                    "earlier_validation_rmse": scores,
                    "next_features": features(history)[1],
                    "next_baseline_m": features(history)[0],
                    "next_prediction_m": final.predict(*features(history)),
                }
            )
    fitted = [r for r in results if r.fitted]
    return {
        "schema_version": 1,
        "protocol": "ridge-carry-v1",
        "status": "development only; no model promotion",
        "unit": "m",
        "config": {
            "features": FEATURES,
            "alphas": ALPHAS,
            "min_training_examples": MIN_FIT,
            "tuning_folds": TUNING_FOLDS,
            "recency_half_life_sessions": 3,
        },
        "warmup_shots": warmup,
        "summary_all": summarize(results),
        "summary_fitted_only": summarize(fitted),
        "per_club_fitted": {
            club: summarize([r for r in fitted if r.club == club])
            for club in sorted({r.club for r in fitted})
        },
        "history_bands": {
            label: summarize([r for r in fitted if low <= r.history_sessions <= high])
            for label, low, high in (
                ("13-17 prior dates", 13, 17),
                ("18+ prior dates", 18, 100000),
            )
        },
        "results": [asdict(r) for r in results],
        "diagnostics": diagnostics,
        "final_models": artifacts,
    }
