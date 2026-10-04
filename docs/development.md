# Development Setup

The package provides a local manual CSV importer, private SQLite storage, and
a shot-data audit. See the [import guide](data-import.md) for a runnable synthetic
walkthrough. Provider adapters, the recommender, and phone interface are pending.

## Environment

Use Python 3.12 and [uv](https://docs.astral.sh/uv/) to create the locked
environment and install the Git hooks:

```bash
uv sync --locked --all-groups
uv run pre-commit install
```

Reusable code lives under `src/club_picker/`. Configuration is centralized in
`pyproject.toml`, and exact dependency versions are recorded in `uv.lock`.

## Tooling

- Ruff handles formatting, linting, import order, and NumPy-style docstrings.
- Pyright runs in strict mode.
- pre-commit runs Ruff, Pyright, and the full pytest suite before a commit.
- pytest checks import behavior using invented observations and temporary stores.
- GitHub Actions runs these checks on pull requests and pushes to `main`.

VS Code settings select `.venv/bin/python`, enable strict type checking, and
use Ruff for formatting and import organization. The recommended extensions
are Python, Pylance, and Ruff.

## Verification

```bash
uv run ruff format --check .
uv run ruff check .
uv run pyright
uv run pytest --cov=club_picker --cov-report=term-missing
uv build
uv run python -c "import club_picker"
```

CI also imports the built wheel in a clean environment. Tests cover invalid
inputs, unit conversion, missing values, repeated imports, conflicts, transaction
rollback, original-file integrity, grouping, chronology, and the CLI workflow.
They verify the data foundation, not recommendation accuracy.

## Data and contributions

Numerical shot data prepared under the [data policy](data-policy.md) can be
tracked in `data/public/` and used in examples and experiments. Original exports
with location/account information, course records, credentials, and unreviewed
artifacts stay local. Prefer invented fixtures for focused automated tests.
See [AGENTS.md](../AGENTS.md) for the repository's working conventions.

Use focused branches and descriptive conventional commits. Keep the public
project story up to date when an implementation or experiment produces a
meaningful result.
