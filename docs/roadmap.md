# Direction and Milestones

I want to grow this from a small distance helper into a caddie that understands
my consistency and recent form. This page records the broad direction and
milestones. The [project journey](README.md) will explain what I learn along
the way.

## Current position

The local manual importer, private storage, and data audit are implemented.
I have reviewed my first Trackman and Toptracer exports and explored an
interactive prototype using those shots. The first local explorer now works,
including browser persistence, private snapshot backup/restore, and descriptive
session trends for distance, speed, sideways consistency, and available flight
measurements. The overhead view includes a 40-yard fairway reference. No models or
recommendations have been evaluated yet. The
[import guide](data-import.md) describes the working data path.

## See my shots together first

The first local shot explorer lets me see my practice data in
one place, switch between carry and total, combine tags, and move through
sessions on a timeline. Distances, dispersion, and individual shots should be
easy to inspect, with my two physical club sets kept distinct.

This comes before recommendations. It is useful with the data I already have
and lets me check what the data can actually support. Missing measurements
should be visible, and a single session should not look like evidence of a trend.

It starts on my computer, with local data import, storage, and backup. Next
I want an installable phone experience that can reopen with my saved data and
work without a connection. Hosting, accounts, and automatic sync can wait.
Private shot history does not need to be published to make the app useful.

## From the explorer to a caddie

The local [approach picker](journey/004-a-first-approach-picker.md) now accepts
a target distance and optional rangefinder plays-like yardage and slope angle.
It compares typical carry and shows alternatives with observed ranges.
Chronological prediction evaluation remains ahead. Three adjacent
irons are a useful starting comparison when I have suitable data; they do not
limit which clubs I can explore now.

The recommendation should run locally from a saved profile, including when
there is no connection on the course.

## From yardage to risk

Once that works, I want to plot my shots around a target and see what happens
when I move a hazard or change how much risk I am willing to take. This should
make the difference between a typical shot and a costly miss easier to see.

Later practice sessions and course outcomes will help test whether those
predictions hold up outside the data used to build them.

## Learning to model my game

Alongside the app, I plan to train and compare models for recent form and carry
ranges. Bayesian modeling is a possible deeper exploration. The
[modeling approach](approach.md) explains the questions behind these experiments.

The app can remain useful while those experiments are underway. A model earns
its place through results on later data, and an experiment can still teach me
something when it does not beat the baseline.

## Longer-term ideas

I would like to bring concise recommendations to my Meta Ray-Ban Display
glasses and investigate whether course photographs can add useful context.
That may lead to a separate computer-vision experiment. Maps, measured
distances, and trajectory data will matter before I can trust advice about
fairway width or clearing a tree.
