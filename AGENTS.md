# Agent Guidelines

These instructions apply to the entire repository.

## Purpose and scope

- Build a personal golf club recommender from the owner's shot data.
- Inspect real export formats before implementing provider-specific imports.
- Start with honest statistical baselines. Bounded model-training experiments
  are explicitly part of the owner's learning goals; follow the ML learning
  plan and record negative results. Promote a candidate into the app only when
  evaluation supports it. Add services or infrastructure only for a concrete need.
- Keep recommendation calculations independent of phone, browser, and glasses
  presentation. An LLM may interpret input or explain structured results, but
  must not invent shot probabilities or override calculated outcomes.
- Read the public approach and relevant journey records before substantial work.
  If `private/README.md` exists locally, also read its index and the relevant
  working plans. Private notes are optional local context, not a dependency
  for building or understanding a fresh clone.
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

- Follow `docs/data-policy.md`. The owner permits public sharing of numerical
  shot measurements and derived performance results with identifying and
  location-related information removed. Do not require separate permission
  merely because eligible measurements came from real shots.
- Keep original mixed-content exports, venue/course information, coordinates,
  visit timestamps, provider/account IDs, location-bearing images, credentials,
  private databases, and unreviewed artifacts out of Git and package outputs.
- Put prepared public measurements in `data/public/`; keep original source
  files and private mappings in ignored storage. Export only explicitly allowed
  fields rather than assuming an unknown column is safe.
- Prefer invented fixtures for focused tests. Prepared public real-shot data
  can support examples, reproducible experiments, charts, and walkthroughs.
- Retain genuine mishits; exclude measurement errors with recorded reasons.
- Preserve club identity, session, source, units, shot intent, and normalization
  settings. Missing information is unknown, not zero or an invented value.
- Separate chronological sessions for training and evaluation. Do not randomly
  split neighboring shots and describe the result as future performance.
- Fit trend weights and thresholds using development data only.
- Construct model inputs from information available before the predicted shot.
  Current-shot launch measurements are not pre-shot features. Fit preprocessing
  within chronological training folds and keep the final test untouched.
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

### Documentation audiences

- Keep the README short and personal: motivation, the broad idea, honest
  current status, and links to details. Use the owner's stated experiences;
  do not invent results, golf history, or personal goals.
- Tracked `docs/` is the reader-facing project story: curated milestone
  summaries, decisions, experiments, lessons, and development instructions.
  Clearly distinguish proposed work from measured results.
- Put operational checklists, next actions, tentative schemas, detailed
  experiment protocols, unresolved decisions, and private results under the
  Git-ignored `private/` directory. Start at `private/README.md` when present.
- Public documentation must not link to or require ignored private documents.
  Summarize stable decisions and completed work into public records when useful,
  without copying raw working notes or location/identity information. Eligible
  performance results may be public under the data policy.
- Keep private planning excluded from both Git and distribution artifacts.
  Moving a tracked document does not erase its earlier Git history; do not
  rewrite history without explicit authorization.

### Voice

Write project narrative in a direct first-person voice matching the owner.
Prefer short sentences and familiar words. Avoid em dashes and sentence
punctuation made from hyphens. Keep source links next to factual claims, and
label engineering proposals separately from verified vendor capabilities.
Keep work-style sections and references to the owner's other projects out of
the README. Lead with the owner's golf experience and curiosity about a caddie
that understands their actual shots.

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
