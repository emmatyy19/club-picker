# A Softer Caddie

October 2026. The Green visual direction is implemented locally.

The explorer had become useful, but its appearance still felt plain. I wanted
the same softer, pastel feeling I like on my personal website: cream, sage,
muted blush, and typography with more personality.

I compared three visual concepts and chose The Green. I first tried it with
real Mantine controls and synthetic shots, then brought the theme into the full
app. The bunny and rounded wordmark sit beside the workspace navigation. The
library totals stay above the charts. Each chart mode has a labelled icon,
and the units control keeps its position when the view changes.

The approach picker uses a pale sage card for the leading suggestion, with
carry, reported total, and observed history still visible. Its visual emphasis
does not make a practice result a validated prediction. Club sets, measurement
contexts, missing data and numerical calculations retain their existing meaning.

Nunito Sans is bundled with the app, rather than fetched from a font service.
The phone build includes its font files in the offline asset list. I checked
desktop and narrow phone layouts in the browser; actual iPhone installation
and update behavior still need a device check after deployment.

The [showcase](../showcase.md) includes updated synthetic examples. The original
design proof remains available during local development for comparison.

I added generated bunny illustrations as small accents: a scorecard caddie
in the empty shot inspector, a club-holding bunny beside the picker title, and
a bunny peeking over a ball as the logo and empty-library illustration. They stay outside the plots. The images are bundled locally,
including in the phone's offline cache, and do not add external requests.
