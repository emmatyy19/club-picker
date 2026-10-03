# What I Share and What I Keep Private

I am comfortable sharing my numerical golf performance data. How far I hit a
7-iron, how widely my shots spread, or whether a model predicts them well can
be part of the public project story. Where I practice or play stays private.

This distinction applies even while the GitHub repository itself is private.

## Public measurements

Prepared datasets may contain real shot measurements such as:

- Club labels, shot intent, distance units, carry, and total distance.
- Left/right miss distances measured relative to the target line.
- Ball speed, club speed, spin, launch angle, apex, and landing angle.
- Generic source names such as Trackman, Toptracer, or manual input.
- Normalization status and other settings that do not reveal a location.
- Locally assigned shot and session labels, session order, and relative elapsed
  days without a calendar-date anchor or provider identifiers.

Performance summaries, distribution plots, model predictions, evaluation
metrics, and experiment walkthroughs derived from those fields may also be
public. They must follow the same rules for labels and metadata.

These are my own published measurements, not a promise that the golfer's identity
is anonymous. The boundary is the information included: performance can be
shared; accounts, visits, and places are excluded.

## Private information

Keep the following in ignored local storage:

- Range, simulator facility, coach venue, golf course, or other location names
  and addresses, including where I used Trackman or Toptracer.
- GPS coordinates, geotags, routes, map links, course IDs, identifiable hole
  layouts, and other information derived from a specific playing location.
- Exact session dates, visit times, timezones, bookings, and location-linked
  weather or elevation records.
- Account names, emails, user IDs, provider shot/session IDs, report URLs,
  credentials, and any mapping back to the original session or venue.
- Photographs, screenshots, and files whose visible content or embedded metadata
  reveals a place, visit, or account.
- Original exports containing any of these fields, private databases, working
  notes, and generated artifacts that have not been checked for such content.

A distance relative to a target is a performance measurement. A target's GPS
position or a shot plotted on a named course is location information. Removing
the course name alone does not make a georeferenced plot public.

## Preparing a public dataset

Keep source exports intact in ignored storage. Create a separate public copy
using an explicit set of allowed measurement columns. Unknown fields stay out
until their meaning is understood. Replace provider identifiers with local
labels such as `session_001`; keep the lookup to the originals private.

Preserve useful session grouping and order without publishing the original
calendar dates. Record units, field definitions, source type, and the numerical
transformations applied so an analysis can be reproduced. A fingerprint of the
public copy is fine; private-file fingerprints and mappings stay private.

Check the whole output, including filenames, free-text notes, plot labels,
notebook outputs, embedded image metadata, and model metadata. A clean CSV
does not make its accompanying source screenshot safe to share.

The owner has authorized sharing measurements that meet this policy. Reviewing
the fields is a normal preparation step, not a new permission request for each
dataset. Git commits and remote publication still follow the repository's
authorized workflow. Do not infer permission to share location information.

## Storage conventions

| Path | Contents | Git |
| --- | --- | --- |
| `data/public/` | Prepared real measurements with a field description | May be tracked |
| `data/synthetic/` | Clearly labeled invented examples and test fixtures | May be tracked |
| `data/raw/`, `data/private/` | Original exports, locations, and private ID mappings | Ignored |
| `data/interim/`, `data/processed/` | Local working datasets before public preparation | Ignored |
| `private/` | Planning, session notes, and internal experiment records | Ignored |
| `artifacts/`, `models/`, `runs/` | Generated outputs awaiting content review | Ignored |

Summaries and charts meeting this policy can be added to public documentation.
Raw working artifacts stay ignored; any intentionally shared model or result
must also be free of location and identity metadata.
