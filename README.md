# tinggeorge.github.io

Source for my personal site, <https://tinggeorge.github.io>.

A single static page with no framework and no dependencies. A small Node script fills in the GitHub section at build time, and GitHub Actions rebuilds and deploys the site on every push and every 6 hours.

## Layout

| Path | What it is |
| --- | --- |
| `src/template.html` | The page. All text content lives here. |
| `src/styles.css` | Styles. Colors are variables at the top. |
| `public/` | Files copied as-is (avatar, favicon). |
| `scripts/build.mjs` | Fetches GitHub data and writes `dist/`. |
| `.github/workflows/deploy.yml` | Build and deploy to GitHub Pages. |

## Run locally

Needs Node 20 or newer.

```sh
npm run build      # writes dist/
npm run preview    # builds, then serves dist/ locally
```

Without a token the build still works, but the contribution graph is left out and only the counts are shown. To include it locally:

```sh
GH_TOKEN=$(gh auth token) npm run build
```

## Editing

- Text: edit `src/template.html`.
- Accent color: change `--accent` in `src/styles.css`.
