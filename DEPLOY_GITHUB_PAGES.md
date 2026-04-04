# Deploy to GitHub Pages + Firebase (Full Setup)

This project can be hosted on **GitHub Pages** while using **Firebase Authentication** and **Cloud Firestore** for login and data.

You do **not** need Firebase Hosting for the website itself.

---

## 1) Create your Firebase project

1. Go to the Firebase console.
2. Create a new project.
3. In the project overview, add a **Web app**.
4. Copy the Firebase config object.

Then open:

- `js/firebase-config.js`

Replace the placeholder values with your real Firebase config.

---

## 2) Enable email/password login

In Firebase Console:

1. Open **Authentication**.
2. Go to **Sign-in method**.
3. Enable **Email/Password**.
4. Save.

You can create the first user in two ways:

- use the app's sign-up screen, or
- create users manually in Firebase Authentication.

---

## 3) Create Firestore database

In Firebase Console:

1. Open **Firestore Database**.
2. Click **Create database**.
3. Start in **production mode** or **test mode** temporarily.
4. Pick a region.

After the database exists, publish your Firestore rules.

---

## 4) Apply Firestore rules

This repo includes:

- `firestore.rules`

### Easy way: Firebase Console

1. Open **Firestore Database → Rules**.
2. Paste the contents of `firestore.rules`.
3. Click **Publish**.

### CLI way

If you prefer CLI:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

If `firebase init firestore` asks questions, point it at this repo and keep `firestore.rules` as the rules file.

---

## 5) Add your GitHub Pages domain to Firebase authorized domains

This matters for auth in production.

In Firebase Console:

1. Open **Authentication**.
2. Open **Settings**.
3. Find **Authorized domains**.
4. Add your GitHub Pages domain.

Examples:

- `yourusername.github.io`
- `yourusername.github.io/your-repo-name` → add **`yourusername.github.io`** as the domain
- custom domain like `scripts.yourdomain.com` → add that domain too

For local testing, `localhost` is usually already allowed.

---

## 6) Create your GitHub repository

Create a new GitHub repo, then upload this project.

Recommended structure:

- `index.html`
- `404.html`
- `styles.css`
- `js/...`
- `assets/...`
- `.github/workflows/deploy-pages.yml`

Then commit and push:

```bash
git init
git branch -M main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## 7) Turn on GitHub Pages

In your GitHub repository:

1. Open **Settings**.
2. Open **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

This repo already includes a workflow file:

- `.github/workflows/deploy-pages.yml`

Every push to `main` will deploy the static app to GitHub Pages.

---

## 8) Wait for first deploy

After pushing:

1. Open the **Actions** tab on GitHub.
2. Wait for **Deploy to GitHub Pages** to finish.
3. Open the URL GitHub gives you.

Typical URL:

- `https://YOUR_USERNAME.github.io/YOUR_REPO/`

If this is a special user site repo named exactly `YOUR_USERNAME.github.io`, then the URL is:

- `https://YOUR_USERNAME.github.io/`

---

## 9) First login and seeding

On first sign-up / first login:

- the app creates your personal workspace in Firestore
- if your account has no flows yet, it seeds the default workspace

From then on, your edits are saved to Firestore, not to GitHub Pages files.

That means:

- GitHub Pages hosts the app
- Firebase stores your content and login

---

## 10) Normal editing flow

- Click the floating **pencil** button to enter edit mode.
- Make changes anywhere in the UI.
- Click the floating **checkmark** to save everything.

You can create and manage:

- call types / flows
- steps
- step order
- branches
- key points
- guarantee stacks
- follow-up blocks
- extra reference blocks

---

## 11) Common production checklist

Before you rely on it daily, confirm these:

- Firebase config pasted correctly in `js/firebase-config.js`
- Email/Password enabled
- Firestore database created
- Firestore rules published
- GitHub Pages domain added to Firebase authorized domains
- First GitHub Pages deployment succeeded
- You can sign up
- You can create a flow
- You can reload and still see saved data

---

## 12) Important architecture note

Your content is in **Firestore**, not in the static files.

So:

- changing scripts inside the app does **not** require redeploying GitHub Pages
- changing app code / layout / features **does** require a new GitHub push

---

## 13) Optional: custom domain

If you later connect a custom domain to GitHub Pages:

1. set the custom domain in GitHub Pages
2. configure DNS with your domain provider
3. add that same domain to Firebase **Authorized domains**

If auth emails or sign-in links ever use your site domain, keep Firebase domain settings in sync.

---

## 14) Troubleshooting

### "Firebase is not configured yet"
Your `js/firebase-config.js` still has placeholders.

### Login works locally but not on GitHub Pages
Your production domain is probably missing from **Firebase Authentication → Settings → Authorized domains**.

### Data does not save
Usually one of these:

- Firestore database not created yet
- Firestore rules too strict or not published
- wrong Firebase `projectId`
- browser console contains Firebase permission errors

### Blank page after deploy
Check GitHub **Actions** for workflow errors and open browser dev tools for JS errors.

---

## 15) If you want zero CLI

You can do almost everything through the web UIs:

- Firebase Console for Auth + Firestore + Rules
- GitHub web UI for repo + Pages + Actions

The only manual code step you still must do is pasting your Firebase config into:

- `js/firebase-config.js`

---

## 16) Recommended next upgrades

- password reset
- invite-only account creation
- owner/admin roles
- export/import backup
- drag-and-drop step ordering
- richer branch target picker UI
