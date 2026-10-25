# MyFloorball

MyFloorball is a phone-first, offline-capable floorball team and game tracker. It is a static client-side app with no account, server, dependencies, or external assets. Team and game information stays in this browser's `localStorage`; it does not sync between devices.

## Run locally

Serve this folder with any static HTTP server, then open its URL. For example:

```sh
python -m http.server 8000
```

Open `http://localhost:8000`. Service workers require HTTPS (localhost is treated as secure); opening `index.html` directly with `file://` works for basic use but cannot provide offline shell caching.

## Use the app

1. Open **Team** and add players. Player order sets the numbered roster and substitution rotation order. You can rename the team at the top of the page.
2. In **Game**, choose **Set up a game**. Select at least five available players, mark five starters, and select the goalkeeper from the starting group.
3. Set the half length, substitution interval, substitution approach, and optional goalkeeper rotation. The initial half is 15 minutes and the initial interval is 2 minutes.
4. Start or pause the timer. When a swap is due, review the proposed players and confirm once it has happened. The half timer counts down; the app tracks the remaining time across reloads.
5. Use the plus/status controls to add a fill-in or record a card, injury, send-off, or cleared status. Additions during a game enter the available squad on the bench.

Group swaps rotate as many outfield players as there are available substitutes, leaving the goalkeeper in place unless rotation is enabled. One-at-a-time swaps cycle through the on-court outfield players in roster order and bring on the first bench player. Goalkeeper rotation advances in available roster order and is applied when the proposed keeper enters the court. The operator confirms the complete proposed swap.

The **Start 2nd half** control starts the second half at the configured duration; **End game** finishes and clears the active game. **Disband game** clears the active game before it is finished and asks for confirmation first. Both actions keep the team roster. Only the current team and game are retained, not a history of completed games.

## Backup and restore

Use the top-right backup button to export a versioned JSON file or import one. Import validates the data before replacing current saved data. Keep exports somewhere safe: clearing browser data can erase the local copy.

## Offline and GitHub Pages

The service worker caches the app shell after its first HTTPS load. The relative asset paths and manifest scope support both a root domain and a GitHub Pages project path. The workflow in `.github/workflows/pages.yml` publishes the repository root from the `main` branch. Set the repository's Pages source to **GitHub Actions** in repository settings.

## Development

The app uses native browser modules and Node's built-in test runner; no install step is needed.

```sh
npm test
```

Saved data uses schema version `1`. If the structure changes, add a migration or update the validator before changing the version.
