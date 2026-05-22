# JavaBot – Adaptive Java OOP Trainer 🤖

An AI-powered, adaptive coding practice tool that generates Java OOP exercises, evaluates your submissions with live streaming feedback, and tracks your knowledge across topics — automatically adjusting difficulty as you improve.

---

## Features

- **AI-Generated Questions** — Each question is generated on the fly by the Groq API (`llama-3.3-70b-versatile`) tailored to your current level and topic history.
- **Adaptive Difficulty** — Automatically levels up (Beginner → Intermediate → Advanced) after 2 consecutive good scores, and levels down after 2 consecutive poor scores or skips.
- **Smart Topic Selection** — Topics marked "needs practice" (due to low scores or skips) are prioritised in a round-robin queue, worst first.
- **Live Streaming Feedback** — AI feedback streams token-by-token into the panel as it's generated, including a verdict, score (/10), corrected code, and an OOP tip.
- **Knowledge Profile** — A live sidebar panel shows all 11 OOP topics with per-topic level badges, score history dots, and status labels (Not started / In progress / Needs practice / Good).
- **CodeMirror Editor** — Full-featured Java editor with Dracula theme, line numbers, bracket matching/closing, smart indent, comment toggling (`Ctrl+/` / `Cmd+/`), and identifier-based autocomplete (`Ctrl+Space` or auto-triggered on keyup).
- **Skip & Practice Loop** — Skipping a topic marks it for extra practice without ending the session.
- **Firebase API Key Store** — The Groq API key is fetched securely at runtime from Firestore (`config/api_keys`) instead of being hard-coded.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript (ES Modules) |
| Code Editor | [CodeMirror 5](https://codemirror.net/5/) (Java mode, Dracula theme) |
| AI / LLM | [Groq API](https://console.groq.com/) — `llama-3.3-70b-versatile` |
| Key Storage | [Firebase Firestore](https://firebase.google.com/docs/firestore) |
| Fonts | JetBrains Mono + Outfit (Google Fonts) |

---

## OOP Topics Covered

1. Basic Syntax
2. Classes and Objects
3. Encapsulation
4. Inheritance
5. Polymorphism
6. Abstraction and Abstract Classes
7. Interfaces
8. Static Members
9. Constructor Overloading
10. The `super` Keyword
11. Collections and OOP

---

## Project Structure

```
JavaBot/
├── index.html      # App shell — layout, CodeMirror script tags
├── style.css       # All styling (dark theme, responsive layout)
├── app.js          # Core logic — question gen, evaluation, adaptive engine
└── README.md
```

---

## Setup

### 1. Firebase

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Firestore** in the project.
3. Create a document at the path **`config/api_keys`** with a field:
   ```
   groq: "<your-groq-api-key>"
   ```
4. Copy your Firebase project config from **Project Settings → Your apps → SDK setup** and replace the `firebaseConfig` object in `app.js`:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

### 2. Groq API Key

Sign up at [console.groq.com](https://console.groq.com) and generate an API key. Store it in Firestore as described above — **do not commit it to source control**.

### 3. Run Locally

Since `app.js` uses ES Modules, open the project through a local server (e.g. VS Code Live Server, or):

```bash
npx serve .
```

Then open `http://localhost:3000` (or the port shown).

---

## How It Works

```
Boot
 └─ Fetch GROQ_API_KEY from Firestore
     └─ loadNextQuestion()
         ├─ selectNextTopic()   → picks topic by adaptive priority
         ├─ generateQuestion()  → Groq API call (non-streaming, JSON)
         └─ renderQuestion()    → populates editor + question panel

Submit
 └─ evaluateCode()
     ├─ Groq API call (streaming SSE)
     ├─ renderFeedbackHTML()   → streams markdown → HTML into panel
     └─ updateKnowledgeAfterAttempt()
         ├─ Adjusts level (up/down)
         ├─ Sets needsPractice flag
         └─ Updates score chips + knowledge profile
```

### Difficulty Levels

| Score | Effect |
|---|---|
| ≥ 7 (×2 in a row) | Level up; clears `needsPractice` |
| < 7 (×2 in a row) | Level down |
| Skip | Marks `needsPractice = true`; may trigger level down |

---

## Editor Shortcuts

| Shortcut | Action |
|---|---|
| `Tab` | Indent (4 spaces) |
| `Shift+Tab` | Unindent |
| `Ctrl+/` / `Cmd+/` | Toggle line comment |
| `Ctrl+Space` | Trigger autocomplete |
| Auto (300ms debounce) | Identifier autocomplete on letter keyup |

---

## Firestore Security

The `config/api_keys` document should be locked down in Firestore Security Rules so only authenticated users (or server-side code) can read it. Example rule:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /config/{doc} {
      allow read: if false; // Or: if request.auth != null;
      allow write: if false;
    }
  }
}
```

---

## License

Part of the **CodeBase Beta** project.
Nethsara Rahiru
