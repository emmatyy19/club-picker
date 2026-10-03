# From Yardages to Outcomes

October 2026. This is the starting point of the project, before importing my
data or running model experiments.

## The question that started it

My handicap has stayed around 20 for a while. I generally know which club to
reach for at a given distance, but that knowledge is fairly approximate: a set
of yardages in my head and roughly 10 yards between clubs.

I already practice with Toptracer and Trackman. Their shot data could describe
more than those remembered numbers. I want to know whether a club is becoming
more consistent, whether my misses are tending left or right, and whether a
recent change is real enough to affect my next decision.

That is where the personalized caddie idea comes from. I am curious how much
of that judgment I can support with my own data, and what I can learn by
building the system myself.

## What I investigated first

I use Trackman in simulator or coach sessions. Its documentation describes
individual-shot CSV export from Performance Studio, which makes it a promising
starting route. I still need to inspect an actual export from my sessions.
See the [official export guide](https://support.trackmangolf.com/hc/en-us/articles/12985883274139-Shot-Analysis-How-To-Export-A-CSV-File-From-TPS).

Toptracer documents saved club-specific My Practice sessions, but I have not
confirmed a suitable personal export route. Manual entry gives the project a
way forward while I investigate that. See
[Toptracer's game-mode documentation](https://help.toptracer.com/article/64-game-modes-on-toptracer-range).

For the longer-term glasses idea, Meta documents display Web Apps and a mobile
toolkit with camera and audio capabilities. Those make a prototype plausible;
I have not tested this project's flow on the glasses yet. See
[Meta Web Apps](https://developers.meta.com/wearables/web-apps/) and the
[Device Access Toolkit](https://developers.meta.com/wearables/device-access-toolkit/).

These are findings from the initial October 2026 research, not guarantees about
every account, device, or software version.

## Why I am starting small

The first useful slice is a few clubs, a target distance, and a recommendation
I can understand on my phone. That will let me test the data and the experience
before combining hazards, changing conditions, and camera input.

I also want to make the uncertainty visible. If two clubs reach a similar
distance but one has a wider spread, I should be able to see why that matters
for a particular target.

## What I hope to learn

I want practical experience training models, but I also want a useful app.
That led me to keep a simple baseline available while experimenting with
recent-form regression and predicted carry ranges. I can learn from a fair
comparison even if a trained model does not outperform the baseline.

The next part of this story will depend on the data: what the exports actually
contain, what patterns are visible, and which questions there is enough
evidence to answer.
