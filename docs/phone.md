# My shots on my phone

I mostly practice, so the useful first step is taking my library and club
comparisons with me. The phone build opens synthetic data by default. I can
explicitly import my prepared library and use the same charts and picker.
It does not need an account or a personal-data server.

## First setup, after the phone build is deployed

1. On my computer, open the local app and choose **Data settings → Export backup**.
   Process new provider sessions first; a report link, PDF, or screenshot is not
   a prepared library file.
2. Transfer that private JSON file to my phone using my preferred file-transfer
   method. Keep a backup on my computer.
3. Open the hosted app online and add it to the home screen. On iPhone, use
   Safari's Share menu and **Add to Home Screen**, as described in
   [Apple's instructions](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).
   On Android, use the browser's install or home-screen option.
4. Open the app from its new icon. In **Data & offline**, wait for **Ready for
   offline use**, then choose **Import my library** and confirm the club sets.
   Import into the installed app itself; do not assume it shares storage with a
   normal browser tab.
5. Turn on airplane mode, close and reopen the app, and check that the library,
   charts and picker work before relying on it away from home.

After adding practice sessions on the computer, export and import a fresh whole
library. This replaces the phone copy; it does not merge shots or fetch provider
reports. The optional course log has its own private backup and stays separate.
The computer's localhost address cannot be used from a phone away from it.

## What stays private

The file picker reads the library on the device. No shot data is sent to GitHub
or a backend. The deployment includes only application assets and invented demo
data. The service worker caches a fixed list of build assets, not imported files,
raw exports, or the local private-data endpoint. The library is stored separately
in browser storage and loaded again when the app opens.

This is local storage, not encrypted account storage. Other scripts on the same
origin share the browser's security boundary, even when they use different paths.
Keep the hosting account and deployed code trusted. Clearing browser/site data,
removing the app, or device storage cleanup can remove local copies. Keep private
backups. Dates and measurement context in those backups must not go into public
Git files.

## Offline and updates

The initial installation and app updates need internet access. Once the complete
build has been cached, ordinary charts and recommendations run locally. The
**Update app & reload** button applies an available update when I choose; save
unfinished input first. Updating application code does not replace the library.
Offline readiness confirms a completed cache installation, not permanent storage.

Desktop browser verification covered a repository subpath, importing an invented
library, preserving it across a service-worker update, stopping the HTTP server,
reloading the page, and calculating a recommendation offline. Actual iPhone and
Android installation and airplane-mode checks remain to be done on those devices.

## Development and publishing

`npm run build:phone --prefix web` creates the static installable build in
`web/dist`. Serve that folder over localhost for testing, or HTTPS in production.
The normal dev server does not register a worker, avoiding stale development
assets. The separate `build:showcase` remains a synthetic-only preview.

The Pages workflow now builds the phone version, with synthetic data as its
initial library. Pushes to main, including merged PRs, trigger deployment after
the workflow passes frontend checks and builds the app. A manual run remains
available for retries. CI builds both variants. Public deployment never reads
`data/private`.
