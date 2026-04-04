# GitHub Pages + Firebase deployment instructions

This is the simple version.

---

## 1. Create the Firebase project

Go to Firebase Console and create a project.

Inside that project:

- add a **Web App**
- enable **Authentication > Email/Password**
- create **Firestore Database**

---

## 2. Check `js/firebase-config.js`

This project already contains your Firebase web config.

Open this file and confirm the values are correct:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

If you ever switch Firebase projects, this is the file you replace.

---

## 3. Add your GitHub Pages domain to Firebase Authentication

After you know your GitHub Pages URL, add that domain in:

**Firebase Console > Authentication > Settings > Authorized domains**

Examples:

- `yourusername.github.io`
- `yourusername.github.io/repo-name` uses the domain `yourusername.github.io`

Important: Firebase authorized domains use the domain, not the full path.

---

## 4. Publish Firestore rules

Open:

**Firebase Console > Firestore Database > Rules**

Paste the contents of `firestore.rules` and publish them.

Current rules mean:

- signed-in users can only read and write their own workspace
- one user cannot see another user's data

---

## 5. Create the GitHub repository

Create a new GitHub repository.

You can name it anything.

Then upload the full project folder contents.

Important files to keep:

- `index.html`
- `styles.css`
- `js/`
- `.github/workflows/deploy-pages.yml`
- `.nojekyll`
- `404.html`

---

## 6. Turn on GitHub Pages

In the repo:

- go to **Settings**
- open **Pages**
- set **Source** to **GitHub Actions**

That is required because this project already includes a Pages workflow.

---

## 7. Push to `main`

Every push to the `main` branch triggers deployment.

Then:

- open the **Actions** tab
- wait for the Pages workflow to finish
- open the site URL shown in **Settings > Pages**

---

## 8. Create your first account

On the live site:

- click **Create account**
- enter email + password
- sign in

The app seeds your workspace automatically if it is empty.

---

## 9. First test checklist

After first login, test this exact list:

1. create an account
2. sign out
3. sign back in
4. open edit mode with the pencil
5. create a new top nav group
6. create a new call type
7. create a new step
8. hit the checkmark to save
9. refresh the page
10. confirm everything stayed there

If all 10 work, deployment is good.

---

## 10. If the normal browser tab acts weird but anonymous works

Use the built-in button on the login screen:

**Reset browser data for this app**

That tries to clear local app state, caches, and browser storage for this site.

If that still fails, clear the site data manually in your browser settings.

---

## 11. Updating the live site later

Two kinds of updates exist:

### Content / structure updates inside the app
No redeploy needed.

Examples:

- new group
- new call type
- new step
- new script text
- new branch

Those save to Firestore.

### Code / layout updates
Redeploy required.

Examples:

- changing CSS
- changing app behavior
- changing builder features
- changing Firebase logic

For those, edit the repo files and push to `main` again.

---

## 12. Safe operating habit

Before major changes inside the builder:

- enter edit mode
- click **Export JSON**
- save a backup file
- then make big structural changes

That gives you a manual restore point.
