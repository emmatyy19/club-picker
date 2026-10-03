# Direction and Milestones

I want to grow this from a small distance helper into a caddie that understands
my consistency and recent form. This page records the broad direction and
milestones. The [project journey](README.md) will explain what I learn along
the way.

## Current position

The repository, Python package scaffold, development tools, and automated
checks are in place. No personal shot data has been imported and no models or
recommendations have been evaluated yet.

## From practice data to a phone app

The first milestone is a usable club profile built from individual shots.
Trackman exports and manual entry are the starting routes. I will begin with
three adjacent irons so I can understand the data and test the full experience
before expanding to the rest of the bag.

The next milestone is a small phone app that accepts a distance, compares
clubs, and explains its recommendation. It should work from a downloaded
profile when there is no connection on the course.

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
