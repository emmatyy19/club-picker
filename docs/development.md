# Development Setup

The app is called **My Caddie**. The repository, Python package, CLI, and snapshot
format keep their `club-picker` / `club_picker` identifiers for compatibility.

The package provides a local manual CSV importer, private SQLite storage, and
a shot-data audit. See the [import guide](data-import.md) for a runnable synthetic
walkthrough. The [local explorer](explorer.md) adds a React/TypeScript UI over
reviewed snapshots and a descriptive approach picker. Shared Trackman reports
also have a reusable importer. Toptracer screenshot extraction still needs
review; provider account sync and phone installation are not implemented.

## Environment

Use Python 3.12 and [uv](https://docs.astral.sh/uv/) to create the locked
environment and install the Git hooks:

```bash
uv sync --locked --all-groups
uv run pre-commit install
```

Reusable code lives under `src/club_picker/`. Configuration is centralized in
`pyproject.toml`, and exact dependency versions are recorded in `uv.lock`.

## Explorer development

Use Node 22.12+ or Node 24. Frontend dependencies live in `web/package.json` and
`web/package-lock.json`; use `npm ci --prefix web` for reproducible installs.
Run `npm run dev --prefix web`, then open <http://127.0.0.1:5173>.
The [explorer guide](explorer.md) covers sample data, backups, and local storage.

Run `npm run format:check --prefix web`, `npm test --prefix web`, and
`npm run build --prefix web` before proposing frontend changes. TypeScript is
strict; Vitest tests use invented shots. Frontend checks run in CI.

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
Frontend tests also check session-balanced summaries, finish ranking, carry
boundaries, and missing-data behavior. Python reference fixtures check shared
summary and target calculations. Passing these checks establishes calculation
behavior, not recommendation accuracy on future shots.

## Data and contributions

Numerical shot data prepared under the [data policy](data-policy.md) can be
tracked in `data/public/` and used in examples and experiments. Original exports
with location/account information, course records, credentials, and unreviewed
artifacts stay local. Prefer invented fixtures for focused automated tests.
See [AGENTS.md](../AGENTS.md) for the repository's working conventions.

Use focused branches and descriptive conventional commits. Keep the public
project story up to date when an implementation or experiment produces a
meaningful result.
