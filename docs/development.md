# Development Setup

The current repository contains an installable Python package scaffold and
development tools. It does not yet provide a shot importer, recommender, or
application interface.

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
- pre-commit runs Ruff and Pyright before a commit.
- pytest and coverage tools are installed for future behavior tests.
- GitHub Actions checks the scaffold on pull requests and pushes to `main`.

VS Code settings select `.venv/bin/python`, enable strict type checking, and
use Ruff for formatting and import organization. The recommended extensions
are Python, Pylance, and Ruff.

## Verification

```bash
uv run ruff format --check .
uv run ruff check .
uv run pyright
uv build
uv run python -c "import club_picker"
```

CI also imports the built wheel in a clean environment. There are no behavior
tests yet, so these checks verify the foundation, not recommendation accuracy.
The first implementation should add meaningful synthetic tests under `tests/`
and enable the full pytest suite in CI and pre-commit in the same change.

## Data and contributions

Numerical shot data prepared under the [data policy](data-policy.md) can be
tracked in `data/public/` and used in examples and experiments. Original exports
with location/account information, course records, credentials, and unreviewed
artifacts stay local. Prefer invented fixtures for focused automated tests.
See [AGENTS.md](../AGENTS.md) for the repository's working conventions.

Use focused branches and descriptive conventional commits. Keep the public
project story up to date when an implementation or experiment produces a
meaningful result.
