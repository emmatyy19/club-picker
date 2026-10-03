# Club Picker

A personal golf club recommendation project based on my own practice data.

I want to enter a distance while I am on the course and get a useful club
recommendation. I also want to understand the tradeoff: which club is the safe
choice, which gives me the best expected result, and which is worth trying when
I am willing to accept more risk.

My clubs do not have the same consistency. A single average distance does not
describe a club that sometimes comes up short or misses far to one side. I want
the recommendation to account for those outcomes and adapt when recent practice
shows a sustained change.

## Current status

This repository contains the project plans and a verified Python development
foundation. It does not yet import shots, recommend clubs, or run a web app.
The first task is to inspect an individual-shot Trackman CSV from a simulator
or coach session and confirm which fields and settings it contains.

`club-picker` is the repository name. The eventual app name is undecided.

## What I want to build

1. Import Trackman exports and support manual shot entry. Investigate Toptracer
   export options without making automatic account access a requirement.
2. Build a profile for each club: typical carry, short and long misses, sideways
   dispersion, substantial mishits, sample size, and recent changes.
3. Recommend a club for a target distance, with clear reasons and uncertainty.
4. Use target boundaries and hazards to compare safe, balanced, and aggressive
   choices. Include aim points and layups when the data supports them.
5. Validate the recommendations against later practice sessions and course
   outcomes. Keep practice performance distinct from course performance.
6. Add a phone interface and then concise display or spoken recommendations on
   my Meta Ray-Ban Display glasses.
7. Experiment with course photographs, measured distances, GPS, and course maps
   to describe hazards and shot corridors.

## How I want to work

I want the same disciplined foundation as my Cycle Forecast and Usagi Visual
Identifier projects: clear data contracts, strict types, small changes, useful
tests, reproducible evaluation, and design decisions recorded before large
implementations. Simple statistical baselines come before more complex models.

Personal shot exports, screenshots, course locations, and generated profiles
stay outside Git, even while this repository is private. Examples and tests use
invented data.

## Plans

- [Roadmap](docs/roadmap.md): milestones and exit criteria.
- [Feasibility investigation](docs/feasibility.md): verified capabilities,
  unresolved questions, and source links.
- [Initial design](docs/design/001-personal-club-recommendations.md): system
  boundaries, recommendation approach, and future clients.
- [Shot data contract](docs/data/shot-data-contract.md): proposed fields,
  import rules, and collection guidance.
- [Evaluation plan](docs/evaluation.md): baselines, chronological splits,
  uncertainty, and on-course validation.

## Development setup

Use Python 3.12 and [uv](https://docs.astral.sh/uv/):

```bash
uv sync --locked --all-groups
uv run pre-commit install
```

The repository uses an installable `src/club_picker/` package, Ruff for
formatting and linting, and strict Pyright for types. pytest and coverage tools
are available for the first behavior implementation. There are no behavior
tests yet, so CI currently verifies the scaffold rather than claiming model or
application correctness.

Run the current checks:

```bash
uv run ruff format --check .
uv run ruff check .
uv run pyright
uv build
uv run python -c "import club_picker"
```

GitHub Actions runs the same foundation checks and imports the built wheel in
a clean environment. Add the full pytest suite to CI and pre-commit when the
first data or recommendation behavior is implemented.

## License

Code and documentation use the [MIT License](LICENSE), matching my other
Python projects. Personal datasets and third-party material are not included.
