# An Interactive Demo

The charts are more useful when I can move the date range, compare clubs, and
inspect a shot. I want visitors to try that themselves, alongside the screenshots.
The synthetic-only GitHub Pages build is ready locally, but not deployed yet.

## Try the synthetic version locally

Use Node 22.12+ or Node 24. From the repository root:

```bash
npm ci --prefix web
npm run showcase --prefix web
```

Open <http://127.0.0.1:5174>. This mode loads the committed synthetic library and
disables the local private-snapshot endpoint. Python and private files are not
needed. The [showcase notes](showcase.md) explain how invented shots and dates
are generated from my published aggregate performance statistics. They do not
reconstruct actual sessions or demonstrate recommendation accuracy.

To build static demo assets:

```bash
npm run build:showcase --prefix web
```

The output is `web/dist/`. Relative asset paths support a repository subpath as
well as a standalone site. The normal `build` command produces the app without
the bundled demo library. Neither build includes original exports or private
shot history. A static build does not provide an installable offline app.

## GitHub Pages

The prepared [deployment workflow](../.github/workflows/pages.yml) builds and
tests the synthetic version, then uploads only `web/dist`. It runs manually
from `main`, with deployment permissions limited to the deploy job. Pull
requests run both normal and showcase builds in CI without publishing a site.

To launch after these changes are merged:

1. Make the repository public when ready to share its code and history.
2. In repository **Settings → Pages**, choose **GitHub Actions** as the source.
3. In **Actions → Deploy synthetic demo**, choose **Run workflow** on `main`.
4. Open the deployment URL reported by the workflow and check the explorer and
   Approach picker. Use the same workflow to publish later updates.

The expected address is `https://emmatyy19.github.io/club-picker/`. It is not a
live demo link yet. GitHub supports a project site per repository alongside a
personal site, and public repositories can use Pages on GitHub Free.
See [GitHub's Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
and [custom workflow setup](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Demo data and controls

The demo always opens the committed invented library. **About this demo**
explains its source, links to the project, and offers **Reset demo**. Personal
file restore and backup controls are absent. The demo does not read or write
the local app's saved shot library; its preferences and saved filters use
separate keys. Reset clears those demo settings and reloads the page.

This key separation avoids accidental collisions; it is not a security boundary.
Apps under different paths on the same hostname share browser storage. A future
personal-data version should use a separate origin if isolation from other apps
on the personal-site host is needed.
See [localStorage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

## Trying personal data later

The current app can read and validate an explorer JSON snapshot in the browser.
This does not require uploading shot contents to a server. It is not a general
Trackman PDF or Toptracer screenshot upload feature: those formats still need
the [local import and review workflow](data-import.md).

Before offering personal files in a hosted app, I want a clear switch between
synthetic and personal data, an explicit choice about browser persistence, and
a way to clear personal data and return to the demo. The local importer already
validates snapshots and limits files to 20 MB. A public version still needs its
own workflow and large/invalid-file checks. No accounts or server database are
needed for browser-only snapshot import.
