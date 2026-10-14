"""Generate illustrative shots from the public aggregate profile, never raw rows."""

import json
import math
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def generate() -> None:
    """Sample correlated distance/roll/side values and invent all session metadata."""
    profile = json.loads((ROOT / "data/public/showcase-profile.json").read_text())
    rng = random.Random(413)
    shots: list[dict[str, object]] = []
    for group_index, group in enumerate(profile["groups"]):
        covariance = group["covariance"]
        lower = [[0.0] * 3 for _ in range(3)]
        for i in range(3):
            for j in range(i + 1):
                value = covariance[i][j] - sum(
                    lower[i][k] * lower[j][k] for k in range(j)
                )
                lower[i][j] = (
                    math.sqrt(max(value, 1e-8)) if i == j else value / lower[j][j]
                )
        for session in range(6):
            # Dates, counts, order and within-session variation are all invented.
            day = (date(2030, 1, 6) + timedelta(days=session * 7)).isoformat()
            for index in range(20):
                noise = [rng.gauss(0, 1) for _ in range(3)]
                carry, roll, side = [
                    group["mean"][i] + sum(lower[i][j] * noise[j] for j in range(3))
                    for i in range(3)
                ]
                carry = max(1, carry)
                total = carry + max(0, roll)
                side = max(-total * 0.8, min(total * 0.8, side))
                shots.append(
                    {
                        "session_id": f"synthetic-{session + 1}-{group['set_id']}",
                        "shot_id": f"synthetic-{group_index + 1}-{session + 1}-{index + 1}",
                        "club_id": group["club_id"],
                        "club_label": group["club_label"],
                        "set_id": group["set_id"],
                        "source": "manual",
                        "source_unit": "m",
                        "session_date": day,
                        "carry_m": round(carry, 2),
                        "total_m": round(total, 2),
                        "total_side_m": round(side, 2),
                        "total_distance_geometry": "radial",
                        "carry_side_m": None,
                        "intent": "unknown",
                        "normalization": "unknown",
                        "compensation": "unknown",
                        "carry_basis": "modeled",
                        "total_basis": "modeled",
                        "quality": "usable",
                        "exclusion_reason": "",
                        "session_mode": "synthetic showcase",
                        "normalization_settings": "unknown",
                        "ball_type": "unknown",
                        "surface": "unknown",
                    }
                )
    output = {
        "kind": "club-picker-explorer",
        "version": 1,
        "distance_unit": "m",
        "shots": shots,
    }
    (ROOT / "data/synthetic/showcase.json").write_text(
        json.dumps(output, indent=2) + "\n"
    )


if __name__ == "__main__":
    generate()
