# Sudoku 🔢

A mobile-friendly Sudoku game with notes, trial mode, hints, and undo. Play on any phone browser.

**Play:** https://zx3xyy.github.io/sudoku/

## Features

- New puzzles every game in Easy / Medium / Hard (generated in-browser, guaranteed unique solution)
- **Extreme** mode uses expert-level, uniquely solvable puzzles with randomized digit and board transformations
- **Notes** — pencil-mark candidate digits in any empty cell
- **Trial mode** — try guesses shown in gold, then erase them all at once with one tap
- **Erase**, **Undo**, **Hint**, mistake counter, timer with pause
- Smart highlights: selected cell, row/column/box, and matching digits
- Auto-cleans related notes when you place a correct digit
- Stats (played, solved, best times) and mid-game progress saved on-device
- Dark/light mode
- Zero dependencies, zero build step — just static files

## Files

- `index.html` — page structure
- `styles.css` — dark/light themes, responsive layout
- `app.js` — generator, solver, and game logic

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```
