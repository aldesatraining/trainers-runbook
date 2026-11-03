# Trainer Runbook: shared setup (Firebase + GitHub Pages)

The app is static files. Sign-in and shared data live in Firebase (free Spark plan); GitHub Pages serves the files.
Until `js/firebase-config.js` is filled in, the app runs in **local mode** (data stays in each browser).

## 1. Firebase (console.firebase.google.com)
1. Create a project (no Google Analytics needed).
2. **Authentication → Get started → Sign-in method → Email/Password → Enable** (leave "Email link" off).
3. **Firestore Database → Create database** → pick a nearby location → **Production mode**.
4. **Project settings → Your apps → Web (`</>`)** → register (no Hosting) → copy the `firebaseConfig` values into `js/firebase-config.js`.
5. **Firestore → Rules**: paste the contents of `firestore.rules` and **Publish**.
6. (Optional) **Authentication → Templates** to edit the wording of the verification and reset emails.

## 2. Domain restriction
Only addresses at `allowedDomain` (`alder.com`) can sign up. It is set in two places and both must match:
- `js/firebase-config.js` → `allowedDomain` (friendly error on the sign-up form)
- `firestore.rules` → the `alder[.]com` pattern (this is what actually enforces it)

## 3. Run locally
`powershell -ExecutionPolicy Bypass -File serve.ps1`, then open http://localhost:5173.
(`localhost` is already an authorized Firebase domain.)

## 4. Publish on GitHub Pages
1. Put this folder in a GitHub repository (private repos need a paid plan for Pages; public repos expose the code, including `js/data/library.js`).
2. Repo **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root**.
3. Firebase **Authentication → Settings → Authorized domains → Add** `<your-account>.github.io`. Without this, sign-in fails on the live site.
4. Open the Pages link, create an account, confirm the email, and check an edit appears from a second browser.

## What is shared and what is personal
- Shared: outlines, edits, version history, archived/deleted state. Changes appear for others when they reload or return to the tab. Two people editing the same outline at once: the last save wins, and version history keeps the other copy.
- Personal (per account, synced across your devices): progress, checklists, notes, calendar start dates.
- Built-in outlines (Cove Inbound) ship in the code. They only get a shared copy once someone edits or archives them. After that, later edits to the shipped content are hidden for everyone until someone presses "Reset to original".
