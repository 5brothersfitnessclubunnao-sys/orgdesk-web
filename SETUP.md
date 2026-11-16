# OrgDesk — one-time setup (product owner)

You do this ONCE. Every customer organisation afterwards only opens `setup.html` and registers itself.

## 1. Firebase project
1. console.firebase.google.com → Add project (any name).
2. Build → **Authentication** → Get started → enable **Email/Password**.
3. Build → **Firestore Database** → Create database (production mode, nearest region).
4. Firestore → **Rules** → paste the whole `firestore.rules` file → Publish.
5. Project settings → Your apps → **Web app (</>)** → copy the `firebaseConfig` values.
6. Authentication → Settings → **Authorized domains** → add the domain where you host the files (e.g. `yourname.github.io`).

## 2. Put your config in the app
Open `firebase-config.js`, replace every `PASTE_...` value, and set the product name in `ORG_APP`.

## 3. Host
Upload ALL files in this folder to a GitHub repository (Add file → Upload files) and enable GitHub Pages (Settings → Pages → main branch). Keep the file names exactly as they are.

## 4. Use
- New organisation: open `https://<your-site>/setup.html`
- Organisation owner signs in at `/admin.html`
- Admission link (shared with students/members): `/join.html?o=<organisation-id>` — shown after setup and on the Home tab
- Member card: `/card.html?o=<org>&m=<id>` — shown to the member after submitting the form

## Notes
- All organisations share this one Firebase project; the rules keep each organisation's data separate.
- Do not reuse the old 5 Brother's Firebase project for this — create a new one.
