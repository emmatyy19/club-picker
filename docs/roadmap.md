# Direction and Milestones

I want a caddie that understands my consistency and recent form, and a project
that gives me a reason to learn model training. The working app starts with
transparent statistics. More complicated models need to earn their place.

## Working now

| Area | Current behavior |
| --- | --- |
| Data foundation | Validated manual CSV imports, private SQLite storage, duplicate checks, and a data audit |
| Trackman | Reusable shared-report importer with review and repeat-import handling; no account sync |
| Toptracer | Reviewed screenshot extraction into numeric records; no general automated screenshot importer |
| My Shots | Carry/total charts, overhead view, dispersion, tag filters, date ranges and playback, trends, rankings, and shot inspection |
| Club identity | Two physical sets remain distinct, with explicit options to combine selected data for exploration |
| Approach picker | Finish target against reported total, optional must-carry and landing window, full/recorded partial swings, observed ranges and support |
| Showcase | Invented shots generated from published performance aggregates, local demo mode, and screenshots |

The [import guide](data-import.md), [explorer guide](explorer.md), and
[approach milestone](journey/004-a-first-approach-picker.md) describe these paths.
The app runs locally. A laptop development server is not an installed offline
phone app. No recommendation has been validated as a future-shot prediction,
and no trained model or scoring improvement has been demonstrated.

## Next: make it useful and test it

I want to try the approach workflow with real decisions and evaluate the
baseline on later practice sessions. That means checking distance error, range
coverage, and failure cases, with sessions kept together chronologically.
Observed clearance percentages are a starting description, not a safety claim.

An [interactive synthetic demo](demo.md) now has a static GitHub Pages build
and a manual deployment workflow, without an account system. Deployment is
still pending. Personal-file import needs clearer demo/data labeling and storage
controls before I advertise it as a public feature.

## From distance to risk

The current carry window is one-dimensional. Next I want to compare paired
landing outcomes against a target area, with explicit costs for short, long,
left, and right misses. Missing lateral landing measurements limit what I can
claim. Reported total does not model today's ground conditions.

Course feedback will matter before I trust practice-to-course adjustments or
claim better scoring. Expected strokes requires evidence about the shots that
follow, not just a distance chart.

## Learning to model my game

I plan to compare stable and recent-session baselines with regularized
regression and quantile models. Bayesian partial pooling is an optional deeper
experiment. The [modeling approach](approach.md) explains these questions.

Training and tuning use earlier sessions; later evaluation stays separate.
A model that loses to a simpler baseline can still be a useful learning result.
There are no completed model experiments yet.

## Delivery and longer-term ideas

An installable phone experience needs saved data, cached assets, and a tested
cold start without a connection. Hosting a demo alone does not provide that.
Accounts and automatic sync are optional, separate work.

I would also like to try concise advice through my Meta Ray-Ban Display glasses.
Course photos might support a later vision experiment, but recognizing a tree
or fairway does not establish its distance, width, or required clearance.
Measured geometry and supported flight information must come first.
