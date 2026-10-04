# Invented Shot Data

Every value in `shots.csv` is invented, including dates and identifiers. This
is a software fixture, not my performance history or a Trackman/Toptracer export.
It includes three irons, two sessions, one short mishit, one missing lateral
measurement, and one genuinely zero lateral measurement.

Use a separate demo store so these observations never mix with personal data:

```bash
uv run club-picker --data-dir data/private/demo preview data/synthetic/shots.csv
uv run club-picker --data-dir data/private/demo import data/synthetic/shots.csv
uv run club-picker --data-dir data/private/demo audit
```

See the [import guide](../../docs/data-import.md) for field meanings and limits.
