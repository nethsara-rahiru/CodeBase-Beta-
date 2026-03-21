# CodeBase — University Learning Hub

A secure, Firebase-powered learning management platform for university students.  
Provides course materials, organization management, and community resources.

---

## Features

- Google OAuth login (restricted to approved university domains)
- Role-based access control (student / editor / admin / owner)
- Course content viewer (video, PDF, links)
- Organization management
- Admin dashboard (user management, course editing, access control)
- Offline-first Firestore persistence

---

## Project Structure

```
.
├── index.html            ← Main login page (Google OAuth)
├── login.html            ← Alternate login page
├── register.html         ← First-time user registration
├── dashboard.html        ← Student dashboard
├── admin.html            ← Admin control panel
├── about.html            ← About / team page
├── resources.html        ← Resource listings
├── course-editor.html    ← Course management
├── content.html          ← Course content viewer
├── org.html              ← Organization details
├── player.html           ← Video player
├── reader.html           ← PDF reader
├── loading.html          ← Loading screen
├── login-access.html     ← Admin access control
├── access-denied.html    ← 403 error page
├── privacy.html          ← Privacy policy
├── assets/
│   ├── img/              ← Logo images
│   └── js/
│       └── firebase.js   ← Core Firebase initialization & auth logic
├── css/
│   └── style.css         ← Main stylesheet (used by login.html)
├── js/
│   ├── login.js          ← Login handler for login.html
│   └── app.js            ← Legacy email/password auth (reference only)
└── FireBase/
    ├── config.txt              ← Setup notes
    └── firebase-config.example.js  ← Config template (copy & fill in)
```

---

## Firebase Setup

> **Never commit real API keys or credentials.**

1. Create a Firebase project at <https://console.firebase.google.com/>.
2. Enable **Google Sign-In** under Authentication → Sign-in method.
3. Enable **Firestore Database** and set appropriate security rules.
4. Copy `FireBase/firebase-config.example.js` → `FireBase/firebase-config.js` and fill in your project values.
5. Update `assets/js/firebase.js` with the same config values (the file currently has placeholder-style inline config — replace them with your own).

### Required Firestore Collections

| Collection path | Purpose |
|---|---|
| `users/{uid}` | User profiles |
| `login_control/access/allowedEmails` | Email whitelist |
| `login_control/access/bannedReg` | Banned registration numbers |
| `system/settings` | Maintenance mode & registration toggle |
| `courses` | Course data |
| `organizations` | Organisation data |
| `community_resources` | Shared resources |

---

## Login Flow

1. User visits `index.html` (or `login.html`).
2. Clicks **Continue with Google** → Firebase Google OAuth popup.
3. Domain is checked against `ALLOWED_DOMAINS` in `assets/js/firebase.js`  
   (currently `@std.uwu.ac.lk` and `@stu.vau.ac.lk`) — or the email must be in the Firestore `allowedEmails` whitelist.
4. First-time users are redirected to `register.html` to complete their profile.
5. Returning users are redirected to `dashboard.html`.

---

## Running Locally

This is a purely static front-end project — no build step required.

```bash
# Any static file server works, e.g.:
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

> Note: Firebase OAuth requires the page to be served over HTTP/HTTPS (not `file://`).

---

## Issues Fixed in This PR

- **Issue #1 — Login issue:**  
  `login.html` pointed to `js/login.js` which did not exist, causing the Google login button to be completely non-functional.  
  The new `js/login.js` imports `assets/js/firebase.js`, wires up the `#googleLogin` button, and surfaces error messages in the `#message` element.

- **Issue #2 — Missing assets / empty directories:**  
  Created `js/login.js` (referenced by `login.html` but previously absent).  
  Added `.google-btn` CSS class to `css/style.css` (used by `login.html`).  
  Replaced `FireBase/config.txt` real credentials with a documented template (`firebase-config.example.js`).

---

## Security Notes

- Firebase client-side API keys are **not secret** — they are safe to include in front-end code.  
  Security is enforced by **Firebase Security Rules** on the Firestore database.
- Ensure Firestore security rules are properly configured before deploying to production.
- The `ALLOWED_DOMAINS` list in `assets/js/firebase.js` provides an additional authentication gate.
