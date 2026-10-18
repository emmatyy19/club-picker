# Public Shot Measurements

This directory is for real numerical shot data prepared under the
[data-sharing policy](../../docs/data-policy.md).

`showcase-profile.json` contains real aggregate performance summaries for 11
physical clubs, not individual shot rows. Each group has a mean vector and
covariance matrix for carry, roll (total minus carry), and final sideways offset.
Means are in meters; covariance entries are in square meters. Club IDs are demo
labels. Provider and measurement contexts are pooled for illustration, so this
profile is not a recommendation or evaluation dataset.

The [showcase generator](../../docs/showcase.md) uses these summaries to invent
shots. Original dates, session identities, locations, and source mappings are
absent. No real individual-shot dataset has been published here.

Each dataset should describe its fields, units, source type, and transformations.
Use local session labels and relative chronology. Exclude locations, original
visit dates/times, provider or account identifiers, report links, and mappings
to the source export.

Keep the original source file in ignored storage. Invented data belongs under
`data/synthetic/` and must be labeled as synthetic.
