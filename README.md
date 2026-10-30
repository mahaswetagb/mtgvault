# MTG Vault
Pure Angular 19 MTG collection manager. Login: email + password (local accounts, PBKDF2-hashed) or Google (Google Identity Services); per-account collection in browser localStorage; real card images and current prices from Scryfall (prices refresh on every dashboard visit or via "Refresh prices"). Hosted on GitHub Pages.

## 1. Google login setup (one time)
1. console.cloud.google.com → create project → APIs & Services → OAuth consent screen (External; add yourself as test user).
2. Credentials → Create credentials → OAuth client ID → Web application.
3. Authorized JavaScript origins (origin only, no path): `http://localhost:4200` and `https://<your-github-username>.github.io`
4. Copy the Client ID.

## 2. Run locally
Paste the Client ID into `src/app/config.ts`, then: `npm install` and `npm start`.

## 3. Git + GitHub Pages
    git init -b main
    git add . && git commit -m "Initial commit"
    git remote add origin https://github.com/<user>/<repo>.git
    git push -u origin main
GitHub: Settings → Pages → Source: GitHub Actions. Settings → Secrets and variables → Actions → Variables → `GOOGLE_CLIENT_ID` = your Client ID.
Every push to `main` deploys to `https://<user>.github.io/<repo>/` (open it on your phone).

## Notes
Login is client-side only (separates collections per Google account in each browser; no cross-device sync).

## Email/password login
Accounts live in the browser's localStorage on that device (passwords are salted + PBKDF2-hashed, never stored in plain text). There is no server, so there is no password reset and the same account does not exist on other devices. Needs HTTPS or localhost (Web Crypto).

## Card scanner
/scan opens the camera, reads the card title on-device (Tesseract.js), looks it up on Scryfall (fuzzy match), shows the card + printings + price and asks for confirmation. The camera stays open for continuous scanning. Needs HTTPS (GitHub Pages is fine) or localhost. First scan downloads ~2–4 MB of OCR data. If the camera isn't available, use "Upload photo" or type the name.
