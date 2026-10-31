# Project Journey

I am using this project to explore whether my practice data can help me make
better decisions on the course. These pages follow the work as it develops:
the questions I start with, the approaches I try, the results, and the choices
I make afterward.

## So far

| Entry | Stage | What it covers |
| --- | --- | --- |
| [From yardages to outcomes](journey/001-from-yardages-to-outcomes.md) | Starting point, October 2026 | Why I want a personal caddie, what I investigated, and why I am starting small |
| [A place for the shots](journey/002-a-place-for-the-shots.md) | Data foundation, October 2026 | Private imports, repeatable history, and an audit tested with invented data |
| [Seeing my shots together](journey/003-seeing-my-shots-together.md) | Local explorer, October 2026 | Unified views, physical club identity, missing measurements, and private backups |
| [A first approach picker](journey/004-a-first-approach-picker.md) | Local baseline, October 2026 | Finish targets, carry constraints, rangefinder inputs, and observed ranges |
| [Testing against later practice](journey/005-testing-later-sessions.md) | Development backtest, October 2026 | Stable and recent carry predictions, coverage, and limits |
| [A small model that did not win](journey/006-a-small-model-that-did-not-win.md) | First ML experiment, October 2026 | Ridge training, chronological tuning, and a negative result |
| [Understanding the range misses](journey/007-understanding-the-range-misses.md) | Range diagnostics, October 2026 | Club weighting, limited history, and short versus long misses |

The first baseline backtest and Ridge experiment are complete. The trained model
has not been adopted into recommendations.
As experiments happen, I will add walkthroughs with comparisons, mistakes, and
what I learned, including results that favor a simpler approach.

## More detail

- [Direction and milestones](roadmap.md) gives a short view of progress.
- [Modeling approach](approach.md) explains the main technical ideas and their
  limits. These are proposals until evaluated.
- [Interactive demo](demo.md) explains the synthetic build and proposed hosting.
- [Development setup](development.md) describes the current repository tools.
- [Shot explorer](explorer.md) explains the local UI and backup workflow.
- [Local shot imports](data-import.md) explains the working format and commands.
- [Data-sharing policy](data-policy.md) explains which measurements I can publish
  and which location and session details stay private.

Real shot measurements and performance results can be part of this journey.
Where and when I practice or play, along with account information, stays private.
Public examples can use prepared real measurements or clearly labeled invented
data.

- [Explorer showcase](showcase.md): screenshots with synthetic shots generated from my private performance summaries.

- [Using My Caddie on my phone](phone.md): device-local imports, offline setup, backups, and verification limits.

Latest interface milestone: [A softer caddie](journey/008-a-softer-caddie.md).
