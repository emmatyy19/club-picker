# Tests

The suite uses invented measurements and temporary private stores. It covers
validation, unit conversion, missing values, CSV errors, repeated imports,
identity conflicts, original-file retention, transactional rollback, session
chronology, compatible audit groups, and the command-line workflow.

Run `uv run pytest --cov=club_picker --cov-report=term-missing`. The same behavior
suite runs in CI and pre-commit. Recommendation and hazard-boundary tests belong
with their future implementations.
