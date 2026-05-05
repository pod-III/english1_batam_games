# KlassKit - Activity Hub for Teachers 🍎

A curated collection of **50+ interactive classroom tools and games** for English Language Teaching. Built for teachers, by teachers — designed to run in any modern browser with zero installation.

![Version](https://img.shields.io/badge/version-1.3.2-blue)
![Activities](https://img.shields.io/badge/activities-54-green)
![Status](https://img.shields.io/badge/status-Early%20Development-orange)
![Price](https://img.shields.io/badge/price-100%25%20Free-pink)

> **Live Demo:** [Open Activity Hub](https://klasskit.fun)

---

## 🚀 Choose Your Path

KlassKit now offers two distinct ways to experience the hub, allowing you to choose between professional synchronization or instant privacy.

### 🏠 KlassKit Cloud (Professional)
*   **Authentication**: Sign in via Supabase to keep your data safe.
*   **Cloud Sync**: Your tools, games, and lesson progress are synchronized across all your devices.
*   **Persistence**: Return tomorrow, and your dashboard will be exactly as you left it.

### 🧪 KlassKit Sandbox (Local)
*   **Zero Friction**: No account, no login, no waiting.
*   **100% Private**: Your data stays strictly on your browser's local storage.
*   **Safe Isolation**: No network requests are made to Supabase, keeping your experience air-gapped and fast.

---

## 🛠 What This Is

This hub is a **desktop-first, projector-optimized** teaching companion. It turns any browser into an interactive classroom command center — no downloads, no accounts (unless you want Cloud Sync), and zero friction. 

**Built for the real classroom:**
- **Large Interaction Targets**: Easy clicking from across the room using a remote or mouse.
- **OLED Dark Mode**: High-contrast, deep slate theme for dim projector environments.
- **Persistent State**: Lesson notes, scores, and configurations survive refreshes via `localStorage` and `IndexedDB`.

---

## 🎨 Design Philosophy: Soft Brutalism

Built using the **KlassKit Signature Palette**, the UI ensures branding consistency and a friendly, energetic atmosphere:

*   **Aesthetic**: Soft Brutalism meets glassmorphism.
*   **Chunky UI**: Bold borders (4px), hard block shadows, and pronounced rounded corners.
*   **Micro-Interactions**: Engaging entrance animations and subtle transitions.
*   **Fonts**: Fredoka (Headings) and Nunito (Body).

---

## 🧩 Activity Highlights

### 🏡 My Space (Personal Dashboard)
| App | Purpose |
|------|--------------|
| **My Schedule** | Weekly drag-and-drop lesson planner with automatic tracking |
| **Admin Tracker** | Track unit planning status and administrative deadlines |
| **My Task** | Personal teacher task manager with priority tracking |

### Classroom Tools
| Tool | What It Does |
|------|--------------|
| **Scoreboard** | Track team points with satisfying chunky buttons |
| **Class Tally** | Behavior tracking with stars & warnings |
| **Clock** | Multi-mode: clock, timer, stopwatch, calendar |
| **Flashcard Maker** | Design & print A4 flashcards with cut guides |
| **Bingo Maker** | Generate cards + digital caller mode |
| **Lesson Notes** | Auto-saving notepad for quick plans |

### 🛠 Workshop Tools
| Tool | What It Does |
|------|--------------|
| **Text Workshop** | General purpose text processing tools |
| **Image Workshop** | General purpose image processing tools |

### Learning Games
| Game | Skill Focus |
|------|-------------|
| **Hot Seat** | Speaking — guess vocab from clues |
| **Hangman** | Spelling — classic word guessing |
| **Card Match** | Memory — picture/word pairs |
| **Secret Code** | Spelling — encode/decode messages |
| **Story Dice** | Creative — random story prompts |
| **Connect Four** | Strategy — vertical battle for teams |

*Plus 50+ more — [see full library](#activities)*

---

## 🛠 Tech Stack

| Feature | Implementation |
|---------|----------------|
| **Core** | Vanilla ES6+ Javascript |
| **Styling** | Tailwind CSS (CDN) + Custom CSS Variables |
| **Database** | Supabase (Postgres with RLS) |
| **Auth** | Supabase Auth (Google & Email) |
| **Storage** | localStorage & IndexedDB |
| **Icons** | Lucide Icons (Auto-rendered) |
| **Audio** | Web Audio API (Synthesized) |

---

## 🚀 Quick Start (Local Development)

```bash
# Clone the repo
git clone https://github.com/pod-III/klasskit.git

# Open in browser (no build step!)
cd klasskit
open index.html
```
No `npm install`. No webpack. Just host the files on any static server or open `index.html` directly.

---

## 📂 Project Structure

```bash
klasskit/
├── index.html          # Entry Lander (Choice Path)
├── hub.html            # Main Activity Center (Hub)
├── supabase.js         # Auth & Cloud Persistence Bridge
├── script.js           # Hub Orchestration Logic
├── games.json          # Global Activity Registry
├── css/
│   ├── base.css        # Design tokens & dark mode
│   ├── components.css  # Buttons, cards, inputs
│   └── home.css        # Landing & Hub views
├── my-space/           # Personal Planning & Admin Tools
├── workshop/           # General Text & Image Utilities
├── games/              # Interactive Game Modules
└── tools/              # Classroom Utility Tools
```

---

## 🧩 Adding Your Own Activities

Each activity is a self-contained module. To add a new one:

1. Create your activity folder in `my-space/`, `workshop/`, `games/`, or `tools/`.
2. Add an entry to `games.json` using the standard schema.
3. Refresh the web app — your activity appears instantly and supports all system features (Tabs, Pins, Dark Mode).

---

## 🙏 Credits

Built with ❤️ by **Fahrul Ahyan** for the global community of English teachers.
KlassKit is a **Passion Project** and will remain **100% Free** forever.

*Current Version: 1.3.1 — Early Development. Changes occur frequently.*
