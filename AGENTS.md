# Agent Guidelines

These instructions apply to the entire repository.

## Purpose and scope

- Build a personal golf club recommender from the owner's shot data.
- Inspect real export formats before implementing provider-specific imports.
- Start with honest statistical baselines. Do not add model training, services,
  or infrastructure without a concrete need.
- Keep recommendation calculations independent of phone, browser, and glasses
  presentation. An LLM may interpret input or explain structured results, but
  must not invent shot probabilities or override calculated outcomes.
- Read the roadmap and relevant design documents before substantial work.
- Keep completed milestones distinct from plans and unverified assumptions.

## Python conventions

- Use Python 3.12 and manage dependencies exclusively with `uv`.
- Centralize package and tool configuration in `pyproject.toml`; commit the
  generated `uv.lock` and never edit it manually.
- Put reusable code under `src/club_picker/`. Notebooks are exploratory and
  must not become application dependencies.
- Use Ruff with NumPy-style docstrings and Pyright in strict mode.
- Fully type functions. Prefer modern built-in generics, `X | None`, and
  keyword-only arguments where they improve clarity.
- Choose the simplest data structures that preserve domain invariants. Use
  explicit validation at external data boundaries.

## Data and evaluation

- Never commit real shot exports, screenshots, photographs, GPS history,
  credentials, private databases, generated profiles, or experiment artifacts.
- Use independently invented fixtures for tests and committed examples.
- Retain genuine mishits; exclude measurement errors with recorded reasons.
- Preserve club identity, session, source, units, shot intent, and normalization
  settings. Missing information is unknown, not zero or an invented value.
- Separate chronological sessions for training and evaluation. Do not randomly
  split neighboring shots and describe the result as future performance.
- Fit trend weights and thresholds using development data only.
- Do not describe simulated golf outcomes as demonstrated scoring improvement.
- Report sample support and uncertainty alongside risk estimates.

## Git workflow

- The initial repository bootstrap may establish `main`. Subsequent changes
  use focused branches such as `feat/<topic>`, `docs/<topic>`, or `fix/<topic>`.
- Preserve unrelated working-tree changes. Stage only the intended files and
  use descriptive conventional commits.
- Commit, push, and open or merge pull requests only within user authorization.
  An authorized repository bootstrap includes its initial commit and push.
- Prefer pull requests for subsequent work and wait for CI before merging.

## Writing

Write project narrative in a direct first-person voice matching the owner.
Prefer short sentences and familiar words. Avoid em dashes and sentence
punctuation made from hyphens. Keep source links next to factual claims, and
label engineering proposals separately from verified vendor capabilities.

## Verification

For the current scaffold, run:

```bash
uv run ruff format --check .
uv run ruff check .
uv run pyright
uv build
uv run python -c "import club_picker"
```

When implementing the first behavior, add meaningful deterministic tests under
`tests/`, mirroring `src/club_picker/`, and enable full pytest execution in CI
and pre-commit in the same change. Test data validation, unit conversion,
duplicate imports, chronology, and recommendation boundary cases. Do not add
placeholder tests solely to make an empty test suite pass.
