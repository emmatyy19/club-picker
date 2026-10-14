# Seeing My Shots Together

October 2026. First local explorer implemented; recommendations are still ahead.

Before asking the app to choose a club, I wanted to see the shots behind that
choice. My practice history lives in two different apps, and a remembered yardage
does not tell me much about a club's spread or the shape of its misses.

The first explorer brings reviewed measurements together with carry and total
views, tag filters, a session timeline, and individual shot details. I can select
all my 7-irons without pretending that two different physical clubs are the same
one. The statistics also keep measurement settings apart.

That separation initially made the chart confusing: two clubs in the color
legend could have three ellipses when one club appeared on both platforms. I
added labels for the individual ellipses and a Combined selection option. Now I
can also ask how all my selected 7-iron shots look together, while keeping each
physical club's identity and separate summaries.

As the history grew, the session chips took up too much room. I replaced them
with a collapsible list grouped by month, with aligned rows and a year selector.
I can browse older sessions without changing the shots on the chart until I
select one. The timeline still handles date ranges.

The missing data turned out to matter as much as the available numbers. A final
resting position does not tell me where the ball first landed. When a shot lacks
the lateral measurement for the selected distance, it stays in the distance view
but does not become a made-up point in the dispersion plot.

The saved overviews also helped settle how to draw Toptracer totals. I compared
two identifiable dots with their reported total and offline values. Their plotted
positions fit radial distance, so totals now appear in overhead without an
assumption toggle. That check still does not locate the carry endpoint.

I started with local files and browser storage. A reviewed snapshot can be backed
up and restored, and the app build contains no private history. Hosting and
accounts can wait while I learn what is useful in the interface.

The ellipses describe the shots I have, not guaranteed outcomes for my next swing.
After bringing in more sessions, I added a Trends view for session medians,
observed spread, and optional individual shots. I can look at ball speed,
left/right tendencies, and flight measurements for one physical club and
measurement context at a time. Gaps stay empty; these summaries do not establish
why a change happened or predict my next swing. The overhead view also has a
40-yard fairway reference so I can put sideways misses in perspective.
I also added club rankings to compare repeatability. Absolute yardage spread,
spread relative to club length, and typical sideways miss answer different
questions. Shot and session counts stay visible so a small sample does not look
like a settled result.
The chart views now have their own main row, with the relevant controls below.
I replaced the combined-dispersion dropdown with a checkbox and added the same
choice to Trends. I can look at daily summaries of the whole selection, or keep
one physical club and its measurement groups separate. The setup details are
still available without taking over the controls.

I also added Play dates to step through my selected practice history. The shot
charts show one date at a time, while Trends reveals the history as it plays.
Pause and manual stepping help me stop at a session I want to examine.

Using the explorer also showed me how distracting small layout changes can be.
I kept the shot inspector beside every view, gave playback controls fixed space,
and put Clear in the inspector header. Rankings now scrolls inside the panel.
Setup details and short-history explanations stay available without crowding
the table. I checked the controls with long shot labels and at phone width.

I then moved the visualization just below the library totals. Filters and dates sit below it,
closed until I need them. Small shortcuts show the current selection and help
me move between editing it and looking at the chart. Closing the controls keeps
my choices and zoom.

Phone offline installation and the distance recommender are separate next steps.

The [explorer guide](../explorer.md) explains how to run it and what the numbers mean.
