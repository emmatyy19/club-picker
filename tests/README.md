# Tests

The suite uses invented measurements and temporary private stores. It covers
validation, unit conversion, missing values, CSV errors, repeated imports,
identity conflicts, original-file retention, transactional rollback, session
chronology, compatible audit groups, and the command-line workflow.

Run `uv run pytest --cov=club_picker --cov-report=term-missing`. The same behavior
suite runs in CI and pre-commit. Shared fixtures check session-balanced carry
summaries and rangefinder targets against the browser implementation.

`npm test --prefix web` runs the frontend tests, including finish-distance
ranking, strict must-carry boundaries, inclusive landing windows, units, and
missing total measurements. These deterministic checks do not establish
predictive accuracy. Spatial hazard models and their tests remain future work.
