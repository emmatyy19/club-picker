# Understanding the Range Misses

The first backtest's 71% coverage made me wonder whether all my carry ranges
were too narrow. Looking more closely changed that interpretation.

The 71% figure gives each physical club equal weight, after balancing dates and
measurement contexts. Counting every evaluated shot equally gives **79.7%**.
The heavily practiced clubs contribute many more shots to that second number.
Both are useful, but they answer different questions. An overall shot count
close to 80% does not mean every club has a dependable range.

## Where the weak results are

This diagnostic reuses the exact baseline P10 to P90 ranges and eligibility
rules. No parameters were tuned and no shots were removed to improve coverage.
There are 1,515 evaluated shots, 130 club/context/date groups, 35 distinct dates,
and 13 physical clubs.

| Earlier compatible practice dates | Club-balanced stable coverage | Clubs | Evaluated shots |
| --- | ---: | ---: | ---: |
| 2 to 4 | 63.0% | 13 | 384 |
| 5 to 9 | 82.1% | 9 | 417 |
| 10 or more | 81.2% | 5 | 714 |

These bands were specified before the breakdown. Different clubs and dates
appear in each band, so this is an association with limited history, not proof
that more practice alone causes better coverage. A larger shot bucket is also
not equivalent to more independent practice dates.

The low-coverage groups often have very little evaluation support. For example,
one 3-wood context covers about 31% on a single later date containing 13 shots.
Its actual session median was 12.8 m shorter than the earlier historical median.
That shows a shift occurred in this sample; it cannot tell me whether the cause
was swing intent, conditions, form, or something else. I have not removed it.

Across the bag, the stable ranges miss **18.8% short** and **9.9% long**, using
the same club-balanced weighting. That asymmetry deserves attention before
simply widening every range equally. Different clubs can have the opposite
pattern, which is why the report keeps them separate.

## What recency changes

| Range | Club-balanced coverage | Pooled-shot coverage | Mean width (m) | Interval score |
| --- | ---: | ---: | ---: | ---: |
| Stable | 71.4% | 79.7% | 25.1 | 44.6 |
| Recent | 70.3% | 77.3% | 24.0 | 43.7 |

The recent range is narrower and covers slightly fewer shots. It has a slightly
lower interval score, which accounts for both width and how far missed shots
fall outside. For this nominal 80% range the score is width plus ten times the
miss distance, averaged over evaluated shots and then balanced by date,
context and club. Lower is better; it is not a golf score or a safety probability.
That small difference does not establish calibrated future-shot ranges.

On the history used to construct them, stable ranges cover about 84.3% on
average. Discrete measurements, ties and finite samples mean empirical P10 to
P90 ranges need not contain exactly 80% of their training data. In-sample
coverage is not evidence that the range will transfer to a later date.

## What I will change next

I am not applying a blanket range expansion. The stronger product lesson is to
make the amount of compatible history clear when showing a club's range.
A sparsely supported range should remain a description of recorded shots,
not a confident prediction for clearing a hazard.

The app has not changed in this step. These diagnostics are development
evidence, with repeated training history and shared practice dates. I report
support and observed per-date variation, not confidence bounds that pretend
every shot is independent. No coverage result establishes course safety,
sideways risk, or rollout accuracy.

Any calibrated adjustment needs its own chronological experiment. For now,
these results suggest examining the weak clubs and collecting more compatible
sessions before treating the whole bag as equally predictable.

## Rerun the investigation

```bash
uv run club-picker ranges data/private/explorer/snapshot.json --output runs/carry-ranges
```

Open `runs/carry-ranges/report.html`. The report contrasts the two weighting
schemes, shows short/inside/long shares for each club/context, breaks down earlier
history, and lists low-coverage dates for inspection. Those selected worst dates
are diagnostic examples, not a representative sample. `results.json` contains
all folds, configuration and exclusions. Reusing an output directory replaces
the two files; the input snapshot stays unchanged.

A fresh clone can use `data/synthetic/showcase.json` as the input to exercise the
same code. Generated data cannot establish real practice coverage. Reports use
ordinal dates and generic labels, omit raw identifiers and settings, and stay
in ignored storage. Public results here contain only eligible aggregate measurements.
