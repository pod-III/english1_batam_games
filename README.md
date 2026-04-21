# KlassKit - Teacher Activity Hub 🍎

A curated collection of **50 interactive classroom tools and games** for English Language Teaching. Built for teachers, by teachers — designed to run in any modern browser with zero installation.

![Version](https://img.shields.io/badge/version-1.1.19-blue)
![Games](https://img.shields.io/badge/games-50-green)
![License](https://img.shields.io/badge/license-MIT-orange)

> **Live Demo:** [Open Activity Hub](https://klasskit.vercel.app)

---

## What This Is

This hub is a **desktop-first, projector-optimized** teaching companion. It turns any browser into an interactive classroom command center — no downloads, no accounts, no friction. Students aged 3-18 stay engaged with tactile, colorful activities that feel like games but teach like tools.

**Built for the real classroom:**
- Large buttons for easy clicking from across the room
- High-contrast OLED dark mode for dim classrooms
- Persistent state survives browser refreshes

## 🎨 Design Philosophy & Theme
Built using the **KlassKit Signature Palette**, the UI ensures brand consistency and a friendly, energetic atmosphere:

* **Pink (`#ff4785`):** Playful & Creative
* **Orange (`#ff7e33`):** High Energy & Interaction
* **Green (`#00d063`):** Success & Progression
* **Blue (`#1ea7fd`):** Logic & Classroom Utility

**Key UI & UX Features:**
* **Soft Brutalism & Glassmorphism:** Chunky elements, hard shadows, floating frosted-glass modals, and pronounced rounded corners.
* **OLED Dark Mode Support:** A high-contrast, deep slate dark mode designed to reduce eye strain in low-light projector environments.
* **Desktop-First Design:** Optimized for mouse/keyboard navigation and large-screen projection.
* **Micro-Interactions & Animations:** Engaging entrance animations, smooth hover states, and dynamic elements that respond to interaction.
* **Persistent State:** Uses `localStorage` and `IndexedDB` (for media) to keep lesson notes, scores, and configured game states persistent between browser refreshes.

---

## � Activity Highlights

### Classroom Tools
| Tool | What It Does |
|------|--------------|
| **Scoreboard** | Track team points with satisfying clicks |
| **Class Tally** | Behavior tracking with stars & warnings |
| **Clock** | Multi-mode: clock, timer, stopwatch, calendar |
| **Team Picker** | Fair random team generation |
| **Spin Wheel** | Customizable randomizer for any decision |
| **Flashcard Maker** | Design & print A4 flashcards with cut guides |
| **Bingo Maker** | Generate cards + digital caller mode |
| **Lesson Notes** | Auto-saving notepad for quick plans |

### Learning Games
| Game | Skill Focus |
|------|-------------|
| **Hot Seat** | Speaking — guess vocab from clues |
| **Hangman** | Spelling — classic word guessing |
| **Card Match** | Memory — picture/word pairs |
| **Secret Code** | Spelling — encode/decode messages |
| **Connect Four** | Strategy — vertical team battle |
| **Guess Who** | Logic — character deduction |
| **Freeze Dance** | Movement — music energy break |
| **Story Dice** | Creative — random story prompts |

*Plus 32 more — [see full list](#activities)*

---

## � Quick Start

```bash
# Clone the repo
git clone https://github.com/pod-III/klasskit.git

# Open in browser (no build step!)
cd klasskit
open index.html
```

That's it. No `npm install`. No webpack. Just host the index.html file on any web server.

---

## 🛠 How It Works

| Feature | Implementation |
|---------|----------------|
| **State** | Vanilla JS modules with in-memory store |
| **Storage** | localStorage for persistence |
| **Audio** | Web Audio API (no external files) |
| **Tabs** | iframe-based multi-activity system |
| **Styling** | Tailwind CDN + custom CSS variables |
| **Icons** | Lucide SVG, auto-rendered |

**Tab System:** Open multiple activities side-by-side. Drag to reorder. Double-click to pin. Close all with one button.

**Keyboard Shortcuts:**
- `/` — Focus search
- `Alt+H` — Return to home
- `Ctrl+R` — Reload current game

---

## 🧩 Adding Your Own Activities

Each activity is a self-contained HTML file in `games/` or `tools/`. To add a new one:

1. Create your activity folder and `index.html`
2. Add an entry to `games.json`:
```json
{
  "id": "my-game",
  "title": "My Game",
  "category": "game",
  "path": "./games/my-game/index.html",
  "icon": "star",
  "color": "text-pink",
  "description": "What it does",
  "tags": ["vocabulary", "interactive"],
  "difficulty": "easy",
  "active": true
}
```
3. Refresh the hub — your game appears instantly

---

## 📂 Project Structure

```
klasskit/
├── index.html          # Hub interface
├── script.js           # Core app logic (~1300 lines)
├── games.json          # Activity registry (50 items)
├── css/
│   ├── base.css        # Design tokens & dark mode
│   ├── components.css  # Buttons, cards, inputs
│   ├── home.css        # Hero, grid, footer
│   └── side-panel.css  # Tab system & split-screen
├── games/              # Game activities (32)
├── tools/              # Utility tools (18)
└── media/              # Icons & assets
```

---

## 🙏 Credits

Built by **Fahrul** for the students and teachers of Indonesia.

**Design:** Soft Brutalism meets classroom utility  
**Fonts:** [Fredoka](https://fonts.google.com/specimen/Fredoka) & [Nunito](https://fonts.google.com/specimen/Nunito)  
**Icons:** [Lucide](https://lucide.dev)  

*Created with ❤️ * — PRs welcome!
