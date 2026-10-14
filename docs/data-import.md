# Local Shot Imports

I can now preview individual shots, keep a private copy of the original file,
and inspect what evidence I have for each club. This first path uses a small
manual CSV format. A separate shared Trackman report importer now feeds the
local explorer, verified against a real browser report. Toptracer screenshots
still use reviewed extraction.

## Try the workflow

Run these commands from the repository root after `uv sync --locked --all-groups`:

```bash
uv run club-picker --data-dir data/private/demo preview data/synthetic/shots.csv
uv run club-picker --data-dir data/private/demo import data/synthetic/shots.csv
uv run club-picker --data-dir data/private/demo import data/synthetic/shots.csv
uv run club-picker --data-dir data/private/demo audit --unit yd
```

The first preview proposes eight shots. The first import adds eight; the second
adds zero and reports eight duplicate rows. The audit describes three clubs
across two invented sessions. These are software checks, not measured golf results.

`python -m club_picker` exposes the same commands as `club-picker`.

## Prepare manual data

Create a file in ignored storage with the supported header:

```bash
mkdir -p data/raw/manual
uv run club-picker template > data/raw/manual/shots.csv
```

Fill in one row per shot. Use UTF-8 CSV and quote values containing commas.
The template prints all supported columns; optional columns can be blank or
omitted. Header names and enumerated values are case-sensitive.

| Required column | Meaning |
| --- | --- |
| `session_id` | Stable session label, reused on repeated exports |
| `shot_id` | Stable identity within that session; do not renumber overlapping exports |
| `club_id` | Physical club/setup identity, such as `iron-7-v1` |
| `club_label` | Display name such as `7 iron` |
| `source` | `manual`, `trackman`, or `toptracer`; origin of measurements, not a provider adapter selector |
| `distance_unit` | `yd` or `m`, applying to all distance fields in that row |
| `carry` | Individual carry distance, finite and nonnegative |

| Optional column | Values and interpretation |
| --- | --- |
| `session_date` | `YYYY-MM-DD`; blank remains undated |
| `shot_intent` | `full`, `partial`, `punch`, `experiment`, or `unknown` |
| `normalization` | `unadjusted`, `normalized`, or `unknown` |
| `ball_compensation` | `on`, `off`, or `unknown` |
| `carry_side` | Signed lateral distance at landing: negative left, positive right |
| `total` | Distance to the reported final resting position |
| `total_side` | Signed lateral distance at rest; requires `total` |
| `carry_basis`, `total_basis` | `measured`, `modeled`, or `unknown` |
| `quality` | `usable` (default), `suspected_error`, or `excluded` |
| `exclusion_reason` | Required for either flagged state; blank for usable shots |
| `session_mode` | Source mode such as `shot_analysis`, or `unknown` |
| `normalization_settings` | Consistent text describing known adjustment settings, or `unknown` |
| `ball_type`, `surface` | Known ball and hitting surface, or `unknown` |

Blank intent, normalization, compensation, basis, and contextual fields become
`unknown`. Blank distances stay missing. A blank lateral measurement never
becomes a straight shot. Curve, launch direction, carry-side distance, and
total-side distance are different measurements; do not substitute one for another.
Keep ordinary mishits usable. Flag tracking errors with reasons instead of
removing inconvenient outcomes. This version requires carry on each imported row;
the intact provider original should retain shots missing that measurement.

Distances are converted to meters in the domain model. The database retains
validated source fields and units, and the byte-for-byte original is archived.
No wind, elevation, or range-ball correction is inferred or applied.

## Preview before importing personal data

```bash
uv run club-picker preview data/raw/manual/shots.csv
uv run club-picker import data/raw/manual/shots.csv
uv run club-picker audit --unit m
```

The default private store is `data/private/club-picker/`, relative to the current
directory. Preview does not create a store. It reports proposed additions,
duplicate rows, flagged rows, errors, and missing-context warnings. Exit status
`2` means the operation failed; `0` means it succeeded. Any validation or identity
conflict prevents the entire file from being imported. `new_shots` is a proposed
count; only `written_shots` confirms additions.

Unknown columns are rejected so that a provider field cannot silently acquire
the wrong meaning. Keep original provider exports intact. Do not delete their
extra columns to make this importer accept them; prepare a separate manual file
only when the mapping is understood. The Trackman command below handles the
verified shared-report format separately.

## Identity and corrections

Club identity is independent of the service used to measure a shot. Two sets
can both contain a 7-iron, so use distinct identities such as `set-a-7i-v1` and
`set-b-7i-v1` while keeping `source` separate. The current CSV stores the physical
club identity in `club_id`; set membership can be kept in a private registry.
Changing providers does not change a physical club's identity.

For ongoing sessions, confirm the set used before import or use an explicitly
owner-authorized standing default. A historical mapping
from provider to set is not a standing default for future sessions. A PDF and
browser link for the same session must share shot identities and be reconciled,
not appended as two sessions.

For my reviewed local history, I group reports and games on the same displayed
calendar date into one session per provider and physical set. Exiting and
reopening a practice program does not create a second practice day. I preserve
original report/game identities in the private extraction ledger, so restarted
shot numbers do not collide. Screenshot dates take precedence over folder names.
This is an owner-approved preparation rule, not automatic date merging in the
CSV importer. Exact dates and the source mapping stay private.

A shot is identified by source, session ID, shot ID, normalization state, and
ball-compensation state. Reimporting the same records, even under a different
filename or in a different row order, adds no duplicates. Distinct shots with
identical distances are retained. Raw and adjusted variants stay separate.
Audit shot counts count these stored variants, not necessarily unique swings.

Changing an existing record's measurements or metadata is a conflict. Changing
a session's date or a club ID's label is also a conflict. Automatic corrections
and deletions are not implemented. Fix an unimported file before retrying; do not
invent new shot IDs to work around a conflict with stored data. A correction
workflow will need to preserve the original history.

## What the audit means

The JSON audit reports observed minimum, median, and maximum carry, sample and
session counts, and how many shots include carry-side data. It excludes flagged
records from carry summaries but counts them in the inventory.

Groups stay separate by club, source, intent, normalization, compensation,
carry basis, session mode, normalization settings, ball type, and surface.
Context strings must match exactly. Matching `unknown` values do not prove
conditions were comparable. This is an inventory for reviewing data, not a
trained profile, recommendation, or estimate of future hazard probability.

Known dates determine session order, independently of import order. Undated
shots remain unplaced. Sessions sharing a date have no established within-day
chronology. Minimum and maximum are observed values, not worst/best possible
future shots. Chronological model evaluation and recommendation rules come later.

## Private storage and backups

The store contains `shots.sqlite3` and `originals/<sha256>.csv`. The database
records adapter version, import time, input filename, fingerprint, and source-row
links. Database schema version 1 is checked before use; unsupported versions
are rejected. SQLite transactions prevent partially committed shot imports.
A failed database write can leave an unreferenced original archive, which is
safe to retain and can be reused on retry.

New database and archive files are owner-readable/writable (`0600`); new store
and archive directories use `0700`. This is local file protection, not encryption.
Close commands and back up the whole private store together. The default path
is Git-ignored and outside the built package. Custom `--data-dir` paths are your
responsibility to keep private. Audits include private session dates and labels,
so keep redirected output under ignored storage as well.

The CSV and database commands need no network connection or account credentials.
The Trackman command below fetches a shared report without account credentials.
Public datasets require a separate allowlisted transformation under the
[data policy](data-policy.md); there is no automatic public export yet.


## Shared Trackman reports

I can now import a Trackman shared activity report directly into my local
explorer. This uses the endpoint observed in Trackman's report page, not a
published, supported API. It worked with my supplied report; other report
formats may need another adapter. It does not search my account for sessions.

1. Create `data/raw/trackman/YYYY-MM-DD/` and put the shared URL in
   `report-link.txt`.
2. Configure the physical clubs in the ignored `data/private/trackman-import.json`.
   A default is only appropriate when the owner explicitly authorizes it:

   ```json
   {
     "version": 1,
     "default_set_id": "practice-bag",
     "club_sets": {
       "practice-bag": {
         "7Iron": {"club_id": "practice-bag-7i", "club_label": "7 iron"}
       }
     }
   }
   ```

3. Preview, then apply from the repository root:

   ```bash
   uv run club-picker trackman data/raw/trackman/YYYY-MM-DD
   uv run club-picker trackman data/raw/trackman/YYYY-MM-DD --apply
   ```

4. Refresh data in the explorer. This updates its private snapshot, not the
   separate SQLite store. No browser Import/Export step is needed.

`--set-id` overrides the configured default for another configured bag. Unknown
clubs stop the import until their physical identity is supplied. Group dates
inside the report determine sessions; same-date groups merge per provider/set.
The preview lists dates and sets so a mislabeled folder is visible before applying.

The first run downloads `trackman-report.json` beside the link. Later runs use
that cache offline; `--refetch` refreshes it. Keep the folder private: the response
contains identifying information beyond the measurements. Custom config, source,
and `--snapshot` paths are also the caller's responsibility to keep private.
Backups are created beside the snapshot before atomic replacement.

The importer follows the link's normalization choice, preserves full-precision
SI measurements, and keeps absent fields unknown. It includes carry, total,
both sideways offsets, ball speed, spin, launch, apex, landing angle, hang time,
and curve when available. Raw trajectories remain in the source cache.

Stable provider shot IDs prevent duplicates, including overlapping shared
reports. Changed measurements or identities stop the import. Older manually
extracted sessions need their private ID mapping reconciled before this importer
can revisit the same date and bag. It deliberately refuses that overlap rather
than guessing which shots match. PDFs still need a separate extraction route.
