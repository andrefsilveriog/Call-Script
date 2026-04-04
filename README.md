# Call Workflow Studio

A static HTML/CSS/JS app for managing call workflows with Firebase Auth + Firestore and GitHub Pages.

## What changed in this pass

- cleaner, more polished shell
- grouped top navigation with dropdown menus
  - example: `Inbound` -> `No Quote`, `Has Quote`
- one floating button only
  - pencil = enter edit mode
  - checkmark = save everything
- stronger builder panel for creating and managing:
  - top navigation groups
  - call types / flows
  - steps
  - branches
  - special step templates
- import/export JSON backup
- browser reset action for weird cached-state issues
- current Firebase web config already wired in

## Folder structure

- `index.html` — entry page
- `styles.css` — all styling
- `js/app.js` — UI, builder, navigation, edit mode
- `js/defaults.js` — seeded flows and step defaults
- `js/firebase-config.js` — your Firebase web config
- `js/firebase-service.js` — auth + Firestore layer
- `firestore.rules` — Firestore security rules
- `.github/workflows/deploy-pages.yml` — GitHub Pages deployment workflow
- `DEPLOY_GITHUB_PAGES.md` — step-by-step deployment guide

## Local note

You do not need a bundler. This is a plain static site.

A simple local server is enough, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Firebase data model

Each authenticated user gets a private workspace under:

- `users/{uid}/meta/settings`
  - theme
  - top navigation groups
- `users/{uid}/flows/{flowId}`
  - flow metadata
- `users/{uid}/flows/{flowId}/steps/{stepId}`
  - step content and structure

## Recommended next pass after this one

- password reset
- drag-and-drop step ordering
- richer branch editing UX
- duplicate group
- optional autosave with undo
