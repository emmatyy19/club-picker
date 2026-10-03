# From Shots to Advice

This is the approach I am starting with. The ideas here have not yet been
validated on my own data. I will update the explanations as the experiments
give me evidence to work with.

## Describe the shot I might hit

A club's average distance is useful, but it leaves out how often I finish short,
long, left, or right. I want to keep those outcomes together so that a short
shot that also misses right remains one observed outcome.

My first baseline will use typical carry and the spread of my recorded shots.
Actual mishits belong in that picture. Different shot intents, such as a full
swing and a deliberate punch, need separate treatment.

## Decide what that outcome means here

The same club can be a reasonable choice for an open approach and a poor one
when its usual miss reaches a hazard. I want to compare possible outcomes
against a target area and an explicit preference for risk.

The first version will use simple costs for landing regions. A later system
could estimate expected strokes, but that would need evidence about the shots
I play afterward. Carry and total distance also answer different questions:
clearing a hazard is not the same as predicting where the ball stops.

## Train models around useful questions

| Question | Planned comparison | What I want to learn |
| --- | --- | --- |
| Is recent form useful for predicting the next session? | Stable club profiles and recency weighting versus regularized regression | Feature engineering, fitting, and whether there is a repeatable signal |
| Can I predict the short and long ends of my carry range? | Historical quantiles versus linear quantile models, then small boosted trees if warranted | Training for uncertainty, interval coverage, and asymmetric errors |
| Can related clubs share useful evidence? | Separate club estimates versus a Bayesian hierarchical model | Partial pooling and the distinction between uncertain averages and variable shots |

Quantile regression estimates conditional percentiles, which makes it a useful
candidate for learning carry ranges. The predicted ranges still need testing.
See the [scikit-learn example](https://scikit-learn.org/stable/auto_examples/ensemble/plot_gradient_boosting_quantile.html).

Bayesian partial pooling is an optional deeper study. The idea is to share
evidence where it helps while preserving club-specific differences. The
[PyMC example](https://www.pymc.io/projects/examples/en/latest/case_studies/hierarchical_partial_pooling.html)
illustrates the general technique; whether it helps my golf data is an open
question.

## Keep the comparison honest

The model needs to work before I hit the ball. Current-shot ball speed, spin,
and launch angle are therefore unavailable inputs, even if they appear in the
practice export. Historical measurements can inform future predictions.

I will train on earlier sessions and evaluate on later ones, keeping all shots
from a session together. I want to look at bias, range coverage, and failure
cases as well as average error. A point-distance improvement alone would not
prove better predictions of sideways misses or lower scores on the course.

## Explore vision later

Course photographs could help identify visible fairway, bunker, water, and tree
regions. I would start with a pretrained model and investigate limited training
only after seeing where it fails. This would offer a separate opportunity to
learn computer vision.

Recognizing a tree does not tell me whether I can clear it. Measured geometry
and a model of the ball's flight would still be needed for that decision.
