# Call Script Builder — HTML + Firebase + GitHub Pages

This version is ready to host on **GitHub Pages** while using **Firebase Authentication** and **Cloud Firestore** for login and saved data.

## What it does

- Email + password login
- Firestore-backed flows and steps
- One floating edit button
  - **Pencil** = enter edit mode
  - **Checkmark** = save all draft changes
- UI management for:
  - call types / flows
  - steps
  - order
  - branches
  - guarantees
  - follow-up blocks
  - key points
  - extra reference blocks
- Theme toggle
- First-login workspace seeding

## Hosting model

- **GitHub Pages** hosts the static app
- **Firebase Auth** handles login
- **Cloud Firestore** stores your workspace data

That means you can keep evolving your flows inside the UI without redeploying the site every time you change content.

## Main files

- `index.html` — app entry
- `404.html` — fallback page for static hosting
- `styles.css` — UI styles
- `js/defaults.js` — seed data
- `js/app.js` — main UI logic
- `js/firebase-service.js` — auth + Firestore persistence
- `js/firebase-config.js` — paste your real Firebase config here
- `js/firebase-config.example.js` — config template
- `firestore.rules` — Firestore rules starter
- `.github/workflows/deploy-pages.yml` — GitHub Pages deployment workflow
- `DEPLOY_GITHUB_PAGES.md` — full setup guide

## Fast start

1. Paste your Firebase config into `js/firebase-config.js`
2. Enable **Email/Password** in Firebase Authentication
3. Create Firestore
4. Publish `firestore.rules`
5. Push this repo to GitHub
6. In **GitHub → Settings → Pages**, set **Source = GitHub Actions**
7. Add your GitHub Pages domain to Firebase **Authorized domains**

Then open the deployed site and sign up.

## Local run

Any static server works:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Full instructions

Read:

- `DEPLOY_GITHUB_PAGES.md`

## Notes

- Theme changes save immediately when you're **not** in edit mode.
- Content changes save when you click the floating **checkmark**.
- Flow IDs and step IDs are generated and kept stable to protect internal references.
- Branch targets are stored by step ID.

## Suggested next upgrades

- Password reset
- Invite-only user creation
- Role-based permissions
- Import/export backup
- Drag-and-drop ordering
- Rich text editor for scripts
