# Do my 7-iron shots form repeatable groups?

I wanted to know whether grouping shots by ball speed and launch angle would
show me something worth practising. My Set A Trackman 7-iron had both readings
on four dates. My Set B Toptracer 7-iron had 27 eligible dates, so I used that
club for this experiment. I kept shots from one measurement context and required
five usable, paired measurements per date.

I fitted two descriptions on 368 shots from the first 24 dates. One split shots
at the training median ball speed and averaged both measurements in each group.
The other used two-cluster k-means on both measurements. I scaled each feature
using training data and gave each practice date equal weight throughout.

On the next three historical dates (63 shots), I measured the average squared
distance from a shot to its assigned center in standardized speed and launch.
Lower means the group center described the observed shot more closely.

| Description | Later error |
| --- | ---: |
| Split at 38.9 m/s ball speed | 0.525 |
| Two speed and launch clusters | 0.861 |

The two fitted centers were about 37.6 m/s at 21.5° and 40.0 m/s at 17.2°.
The slower, higher-launch group contained 4 of 20, 5 of 20 and 0 of 23 shots
on successive later dates. Leaving out one training date at a time gave 99.6%
average agreement with the original later assignments after aligning group
labels. The fit was stable, but the simple speed split described these later
shots better.

I’m keeping the existing shot relationships chart. These historical dates were
already available during project development. A future claim about new practice
would need a fresh set of dates. The experiment describes flight after impact.

To rerun on a local snapshot, supply the physical club ID and provider:

```sh
uv run --extra ml python scripts/compare_shot_patterns.py SNAPSHOT --club CLUB_ID --source toptracer
```
