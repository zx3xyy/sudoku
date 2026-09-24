/* Sudoku — generator, notes, trial mode, hints. No dependencies. */
(function () {
  "use strict";

  var DIFFS = {
    easy: { label: "Easy", givens: 46, blurb: "Relaxed and friendly" },
    medium: { label: "Medium", givens: 36, blurb: "A satisfying challenge" },
    hard: { label: "Hard", givens: 30, blurb: "For seasoned solvers" },
    expert: { label: "Expert", blurb: "Advanced logic, but no blind guessing" },
    extreme: { label: "Extreme", blurb: "Legendary puzzles — genuinely brutal" }
  };
  // Every Expert seed is uniquely solvable with singles, locked candidates,
  // and naked pairs. This makes the step up from Hard noticeable but fair.
  var EXPERT_PUZZLES = [
    "608000240054000800010034000000001400800050007002600000000180090003000510046000702",
    "009703000020000500600290071050001040000020000090600010240067008007000090000104700",
    "980000006040007000010500400835900000000703000000002943007005030000100090300000014",
    "030004100800009730000307800900801000200000001000706005002603000089400003007500010",
    "006045000000000012708001003040600200000307000005004070200400106570000000000530800",
    "500090082000003001030010040075006000008000600000900720040060030800400000290080004",
    "050080000000200793900000040000378650000000000043961000030000005768002000000090020",
    "600000400000600800000005097800002006370906041100700008780500000009007000002000004",
    "005003740400100060080040200001005037000000000390700100009060010040008002032900500",
    "070300040019240080400000000500003000081704290000100008000000004060081920020006030",
    "020090040000604090000002006650009800100803005002500017700200000060905000080070050",
    "010080000025000010790000005000360040001704500040019000400000032070000150000030080"
  ];
  // Hand-picked expert puzzles. Random structure-preserving transformations below
  // turn these into millions of equivalent boards without diluting their difficulty.
  var EXTREME_PUZZLES = [
    "100007090030020008009600500005300900010080002600004000300000010040000007007000300",
    "800000000003600000070090200050007000000045700000100030001000068008500010090000400",
    "005300000800000020070010500400005300010070006003200080060500009004000030000009700"
  ];
  var STATS_KEY = "sudoku.stats.v1";
  var GAME_KEY = "sudoku.game.v1";
  var THEME_KEY = "sudoku.theme.v1";
  var DIFF_KEY = "sudoku.diff.v1";

  // ---------- puzzle generator (pure logic) ----------
  function shuffled(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
  function rowOf(i) { return (i / 9) | 0; }
  function colOf(i) { return i % 9; }
  function boxOf(i) { return ((((rowOf(i) / 3) | 0) * 3) + ((colOf(i) / 3) | 0)); }

  function peerUsed(grid, i) {
    var used = [false, false, false, false, false, false, false, false, false, false];
    var r = rowOf(i), c = colOf(i), b = boxOf(i);
    for (var k = 0; k < 81; k++) {
      var v = grid[k];
      if (v !== 0 && (rowOf(k) === r || colOf(k) === c || boxOf(k) === b)) {
        used[v] = true;
      }
    }
    return used;
  }

  // Randomized backtracking with most-constrained-cell heuristic.
  function fillGrid(grid) {
    var best = -1, bestOpts = null, i, d;
    for (i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      var used = peerUsed(grid, i);
      var opts = [];
      for (d = 1; d <= 9; d++) if (!used[d]) opts.push(d);
      if (opts.length === 0) return false;
      if (!bestOpts || opts.length < bestOpts.length) {
        best = i;
        bestOpts = opts;
        if (opts.length === 1) break;
      }
    }
    if (best === -1) return true;
    shuffled(bestOpts);
    for (i = 0; i < bestOpts.length; i++) {
      grid[best] = bestOpts[i];
      if (fillGrid(grid)) return true;
    }
    grid[best] = 0;
    return false;
  }

  // Destructive solution counter, stops early at cap.
  function countSolutions(grid, cap) {
    var best = -1, bestOpts = null, i, d;
    for (i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      var used = peerUsed(grid, i);
      var opts = [];
      for (d = 1; d <= 9; d++) if (!used[d]) opts.push(d);
      if (opts.length === 0) return 0;
      if (!bestOpts || opts.length < bestOpts.length) {
        best = i;
        bestOpts = opts;
        if (opts.length === 1) break;
      }
    }
    if (best === -1) return 1;
    var total = 0;
    for (i = 0; i < bestOpts.length; i++) {
      grid[best] = bestOpts[i];
      total += countSolutions(grid, cap - total);
      grid[best] = 0;
      if (total >= cap) break;
    }
    return total;
  }

  function parsePuzzle(encoded) {
    var grid = [];
    for (var i = 0; i < encoded.length; i++) grid.push(parseInt(encoded.charAt(i), 10));
    return grid;
  }

  // Relabel digits, rows, columns, bands, and stacks. These operations preserve
  // uniqueness and the logical difficulty of the source puzzle.
  function transformPuzzle(source) {
    var digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    var bands = shuffled([0, 1, 2]);
    var stacks = shuffled([0, 1, 2]);
    var rows = [], cols = [];
    var b, i;
    for (b = 0; b < 3; b++) {
      var rowsInBand = shuffled([0, 1, 2]);
      var colsInStack = shuffled([0, 1, 2]);
      for (i = 0; i < 3; i++) {
        rows.push(bands[b] * 3 + rowsInBand[i]);
        cols.push(stacks[b] * 3 + colsInStack[i]);
      }
    }
    var transpose = Math.random() < 0.5;
    var result = new Array(81);
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        var oldR = transpose ? rows[c] : rows[r];
        var oldC = transpose ? cols[r] : cols[c];
        var value = source[oldR * 9 + oldC];
        result[r * 9 + c] = value === 0 ? 0 : digits[value - 1];
      }
    }
    return result;
  }

  function generateFromBank(bank) {
    var encoded = bank[Math.floor(Math.random() * bank.length)];
    var puzzle = transformPuzzle(parsePuzzle(encoded));
    var solution = puzzle.slice();
    fillGrid(solution);
    return { puzzle: puzzle, solution: solution };
  }

  function generate(diffKey) {
    if (diffKey === "expert") return generateFromBank(EXPERT_PUZZLES);
    if (diffKey === "extreme") return generateFromBank(EXTREME_PUZZLES);
    var solution = new Array(81);
    for (var i = 0; i < 81; i++) solution[i] = 0;
    fillGrid(solution);
    var puzzle = solution.slice();
    var target = DIFFS[diffKey].givens;
    var order = [];
    for (i = 0; i < 81; i++) order.push(i);
    shuffled(order);
    var givens = 81;
    for (var k = 0; k < 81 && givens > target; k++) {
      var idx = order[k];
      var sym = 80 - idx;
      var cells = idx === sym ? [idx] : [idx, sym];
      var removed = [];
      for (var c = 0; c < cells.length; c++) {
        if (puzzle[cells[c]] !== 0) removed.push(cells[c]);
      }
      if (removed.length === 0) continue;
      for (c = 0; c < removed.length; c++) puzzle[removed[c]] = 0;
      if (countSolutions(puzzle.slice(), 2) !== 1) {
        for (c = 0; c < removed.length; c++) puzzle[removed[c]] = solution[removed[c]];
      } else {
        givens -= removed.length;
      }
    }
    return { puzzle: puzzle, solution: solution };
  }

  // ---------- peer lookup ----------
  var PEERS = [];
  (function buildPeers() {
    for (var i = 0; i < 81; i++) {
      var r = rowOf(i), c = colOf(i), b = boxOf(i);
      var list = [];
      for (var j = 0; j < 81; j++) {
        if (j !== i && (rowOf(j) === r || colOf(j) === c || boxOf(j) === b)) {
          list.push(j);
        }
      }
      PEERS.push(list);
    }
  })();

  // ---------- state ----------
  var puzzle = [];
  var solution = [];
  var values = [];
  var notes = [];
  var trial = [];
  var mistakes = 0;
  var hintsUsed = 0;
  var difficulty = "easy";
  var status = "playing"; // "playing" | "won"
  var selected = -1;
  var notesMode = false;
  var trialMode = false;
  var undoStack = [];
  var elapsed = 0;
  var paused = false;

  var cellEls = [];
  var padEls = {};

  var boardEl = document.getElementById("board");
  var padEl = document.getElementById("pad");
  var toastContainer = document.getElementById("toast-container");
  var difficultyLabel = document.getElementById("difficulty-label");
  var mistakesEl = document.getElementById("mistakes");
  var timerEl = document.getElementById("timer");
  var veilEl = document.getElementById("paused-veil");
  var clearTrialBtn = document.getElementById("btn-clear-trial");
  var notesBtn = document.getElementById("btn-notes");
  var trialBtn = document.getElementById("btn-trial");
  var overlay = document.getElementById("modal-overlay");
  var modalContent = document.getElementById("modal-content");

  // ---------- storage ----------
  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* private mode: play without saving */ }
  }
  function removeKey(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  function defaultStats() {
    return { played: 0, won: 0, best: { easy: null, medium: null, hard: null, expert: null, extreme: null } };
  }
  function getStats() {
    var s = loadJSON(STATS_KEY, null);
    if (!s || typeof s.played !== "number" || !s.best) return defaultStats();
    if (s.best.expert === undefined) s.best.expert = null;
    if (s.best.extreme === undefined) s.best.extreme = null;
    return s;
  }
  function saveStats(s) { saveJSON(STATS_KEY, s); }

  function saveGame() {
    if (status !== "playing") {
      removeKey(GAME_KEY);
      return;
    }
    saveJSON(GAME_KEY, {
      puzzle: puzzle,
      solution: solution,
      values: values,
      notes: notes,
      trial: trial,
      mistakes: mistakes,
      hintsUsed: hintsUsed,
      elapsed: elapsed,
      difficulty: difficulty
    });
  }

  function validGrid(g) {
    if (!Array.isArray(g) || g.length !== 81) return false;
    for (var i = 0; i < 81; i++) {
      if (typeof g[i] !== "number" || g[i] < 0 || g[i] > 9) return false;
    }
    return true;
  }

  function loadGame() {
    var g = loadJSON(GAME_KEY, null);
    if (!g || !DIFFS[g.difficulty]) return false;
    if (!validGrid(g.puzzle) || !validGrid(g.solution) || !validGrid(g.values)) return false;
    if (!Array.isArray(g.notes) || g.notes.length !== 81) return false;
    if (!Array.isArray(g.trial) || g.trial.length !== 81) return false;
    puzzle = g.puzzle;
    solution = g.solution;
    values = g.values;
    notes = g.notes.map(function (n) {
      return Array.isArray(n) ? n.filter(function (d) { return d >= 1 && d <= 9; }) : [];
    });
    trial = g.trial.map(function (t) { return !!t; });
    mistakes = g.mistakes || 0;
    hintsUsed = g.hintsUsed || 0;
    elapsed = g.elapsed || 0;
    difficulty = g.difficulty;
    status = "playing";
    return true;
  }

  // ---------- helpers ----------
  function isGiven(i) { return puzzle[i] !== 0; }
  function isWrong(i) {
    return !isGiven(i) && !trial[i] && values[i] !== 0 && values[i] !== solution[i];
  }
  function trialCount() {
    var n = 0;
    for (var i = 0; i < 81; i++) {
      if (trial[i] && values[i] !== 0) n++;
    }
    return n;
  }
  function formatTime(s) {
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function toast(msg, duration) {
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(function () {
      el.classList.add("fade");
      setTimeout(function () { el.remove(); }, 350);
    }, duration || 1400);
  }

  // ---------- rendering ----------
  function buildBoard() {
    boardEl.innerHTML = "";
    cellEls = [];
    for (var b = 0; b < 9; b++) {
      var box = document.createElement("div");
      box.className = "box";
      var br = (b / 3) | 0, bc = b % 3;
      for (var k = 0; k < 9; k++) {
        var kr = (k / 3) | 0, kc = k % 3;
        var idx = (br * 3 + kr) * 9 + (bc * 3 + kc);
        var cell = document.createElement("div");
        cell.className = "cell";
        cell.setAttribute("role", "gridcell");
        cell.dataset.idx = String(idx);
        (function (id) {
          cell.addEventListener("click", function () { select(id); });
        })(idx);
        box.appendChild(cell);
        cellEls[idx] = cell;
      }
      boardEl.appendChild(box);
    }
  }

  function renderCell(i) {
    var el = cellEls[i];
    var cls = "cell";
    var html = "";
    var v = values[i];
    if (v !== 0) {
      html = '<span class="value">' + v + "</span>";
      cls += isGiven(i) ? " given" : (trial[i] ? " trial" : " user");
      if (isWrong(i)) cls += " wrong";
    } else if (notes[i].length > 0) {
      var marks = ["", "", "", "", "", "", "", "", ""];
      for (var n = 0; n < notes[i].length; n++) {
        marks[notes[i][n] - 1] = String(notes[i][n]);
      }
      html = '<div class="notes">';
      for (var s = 0; s < 9; s++) {
        html += "<span>" + marks[s] + "</span>";
      }
      html += "</div>";
    }
    el.className = cls;
    el.innerHTML = html;
  }

  function renderHighlights() {
    var i, p;
    for (i = 0; i < 81; i++) {
      cellEls[i].classList.remove("selected", "related", "same");
    }
    if (selected < 0) return;
    cellEls[selected].classList.add("selected");
    var peers = PEERS[selected];
    for (p = 0; p < peers.length; p++) {
      cellEls[peers[p]].classList.add("related");
    }
    var sv = values[selected];
    if (sv !== 0) {
      for (i = 0; i < 81; i++) {
        if (i !== selected && values[i] === sv) {
          cellEls[i].classList.remove("related");
          cellEls[i].classList.add("same");
        }
      }
    }
  }

  function buildPad() {
    padEl.innerHTML = "";
    padEls = {};
    for (var d = 1; d <= 9; d++) {
      (function (digit) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pad-key";
        btn.dataset.digit = String(digit);
        btn.setAttribute("aria-label", "Enter " + digit);
        btn.innerHTML = '<span class="digit">' + digit + '</span><span class="count"></span>';
        btn.addEventListener("click", function () { inputDigit(digit); });
        padEl.appendChild(btn);
        padEls[digit] = btn;
      })(d);
    }
  }

  function renderPad() {
    // Trial entries are hypotheses, so they must not consume the
    // normal number-pad availability. Otherwise turning Trial off can
    // make every digit look depleted until the trial entries are erased.
    var counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < 81; i++) {
      if (values[i] !== 0 && !trial[i]) counts[values[i]]++;
    }
    for (var d = 1; d <= 9; d++) {
      var left = Math.max(0, 9 - counts[d]);
      var btn = padEls[d];
      var countEl = btn.querySelector(".count");
      if (countEl) countEl.textContent = left > 0 ? String(left) : "";
      if (left === 0) btn.classList.add("depleted");
      else btn.classList.remove("depleted");
    }
  }

  function renderStatus() {
    difficultyLabel.textContent = DIFFS[difficulty].label;
    mistakesEl.textContent = "Mistakes: " + mistakes;
    timerEl.textContent = formatTime(elapsed);
    if (notesMode) notesBtn.classList.add("active");
    else notesBtn.classList.remove("active");
    notesBtn.setAttribute("aria-pressed", notesMode ? "true" : "false");
    if (trialMode) trialBtn.classList.add("active");
    else trialBtn.classList.remove("active");
    trialBtn.setAttribute("aria-pressed", trialMode ? "true" : "false");
    var n = trialCount();
    var commitTrialBtn = document.getElementById("btn-commit-trial");
    if (n > 0) {
      clearTrialBtn.classList.remove("hidden");
      clearTrialBtn.textContent = "Erase all trial entries (" + n + ")";
      commitTrialBtn.classList.remove("hidden");
      commitTrialBtn.textContent = "Commit all trial entries (" + n + ")";
    } else {
      clearTrialBtn.classList.add("hidden");
      commitTrialBtn.classList.add("hidden");
    }
  }

  function renderAll() {
    for (var i = 0; i < 81; i++) renderCell(i);
    renderHighlights();
    renderPad();
    renderStatus();
  }

  // ---------- undo ----------
  function snapshot() {
    return {
      values: values.slice(),
      notes: notes.map(function (n) { return n.slice(); }),
      trial: trial.slice(),
      mistakes: mistakes,
      hintsUsed: hintsUsed
    };
  }
  function restore(s) {
    values = s.values;
    notes = s.notes;
    trial = s.trial;
    mistakes = s.mistakes;
    hintsUsed = s.hintsUsed;
  }
  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > 200) undoStack.shift();
  }
  function undo() {
    if (status !== "playing" || paused) return;
    if (undoStack.length === 0) {
      toast("Nothing to undo");
      return;
    }
    restore(undoStack.pop());
    afterChange();
  }

  function afterChange() {
    renderAll();
    saveGame();
    checkWin();
  }

  // ---------- actions ----------
  function select(idx) {
    if (status !== "playing" || paused) return;
    selected = (selected === idx) ? -1 : idx;
    renderHighlights();
  }

  function moveSelection(dr, dc) {
    if (status !== "playing" || paused) return;
    var r = selected < 0 ? 0 : rowOf(selected) + dr;
    var c = selected < 0 ? 0 : colOf(selected) + dc;
    if (r < 0) r = 0;
    if (r > 8) r = 8;
    if (c < 0) c = 0;
    if (c > 8) c = 8;
    selected = r * 9 + c;
    renderHighlights();
  }

  function removePeerNotes(idx, d) {
    var peers = PEERS[idx];
    for (var p = 0; p < peers.length; p++) {
      var n = notes[peers[p]];
      var at = n.indexOf(d);
      if (at >= 0) n.splice(at, 1);
    }
  }

  function inputDigit(d) {
    if (status !== "playing" || paused) return;
    if (selected < 0) {
      toast("Select a cell first");
      return;
    }
    if (isGiven(selected)) return;
    var i = selected;
    if (notesMode) {
      if (values[i] !== 0) return;
      pushUndo();
      var n = notes[i];
      var at = n.indexOf(d);
      if (at >= 0) n.splice(at, 1);
      else {
        n.push(d);
        n.sort();
      }
      afterChange();
      return;
    }
    if (values[i] === d) {
      // Tapping the same digit again erases it; if only the trial
      // flag differs, convert the entry instead.
      if (trial[i] === trialMode) {
        eraseCell();
        return;
      }
      pushUndo();
      trial[i] = trialMode;
      if (!trialMode) {
        if (d !== solution[i]) {
          mistakes++;
        } else {
          removePeerNotes(i, d);
        }
      }
      afterChange();
      return;
    }
    pushUndo();
    values[i] = d;
    notes[i] = [];
    trial[i] = trialMode;
    if (!trialMode) {
      if (d !== solution[i]) {
        mistakes++;
      } else {
        removePeerNotes(i, d);
      }
    }
    afterChange();
  }

  function eraseCell() {
    if (status !== "playing" || paused) return;
    if (selected < 0 || isGiven(selected)) return;
    var i = selected;
    if (values[i] === 0 && notes[i].length === 0) return;
    pushUndo();
    values[i] = 0;
    notes[i] = [];
    trial[i] = false;
    afterChange();
  }

  function toggleNotes() {
    if (status !== "playing" || paused) return;
    notesMode = !notesMode;
    renderStatus();
  }

  function toggleTrial() {
    if (status !== "playing" || paused) return;
    trialMode = !trialMode;
    renderStatus();
    toast(trialMode ? "Trial mode on — guesses show in gold" : "Trial mode off");
  }

  function clearTrial() {
    if (status !== "playing" || paused) return;
    var targets = [];
    for (var i = 0; i < 81; i++) {
      if (trial[i] && values[i] !== 0) targets.push(i);
    }
    if (targets.length === 0) return;
    pushUndo();
    for (var t = 0; t < targets.length; t++) {
      values[targets[t]] = 0;
      trial[targets[t]] = false;
    }
    afterChange();
    toast(targets.length === 1 ? "1 trial entry erased" : targets.length + " trial entries erased");
  }

  function commitTrial() {
    if (status !== "playing" || paused) return;
    var targets = [];
    for (var i = 0; i < 81; i++) {
      if (trial[i] && values[i] !== 0) targets.push(i);
    }
    if (targets.length === 0) return;
    pushUndo();
    for (var t = 0; t < targets.length; t++) {
      var idx = targets[t];
      trial[idx] = false;
      if (values[idx] === solution[idx]) {
        removePeerNotes(idx, values[idx]);
      }
    }
    afterChange();
    toast(targets.length === 1 ? "1 trial entry committed" : targets.length + " trial entries committed");
  }

  function hint() {
    if (status !== "playing" || paused) return;
    var target = -1;
    if (selected >= 0 && !isGiven(selected) && values[selected] !== solution[selected]) {
      target = selected;
    } else {
      for (var i = 0; i < 81; i++) {
        if (!isGiven(i) && values[i] !== solution[i]) {
          target = i;
          break;
        }
      }
    }
    if (target < 0) return;
    pushUndo();
    values[target] = solution[target];
    notes[target] = [];
    trial[target] = false;
    hintsUsed++;
    removePeerNotes(target, solution[target]);
    selected = target;
    afterChange();
  }

  function isDirty() {
    for (var i = 0; i < 81; i++) {
      if (!isGiven(i) && (values[i] !== 0 || notes[i].length > 0)) return true;
    }
    return mistakes > 0 || hintsUsed > 0;
  }

  function newGame(diffKey) {
    if (status === "playing" && puzzle.length === 81 && isDirty()) {
      if (!window.confirm("Start a new puzzle? Your current progress will be lost.")) {
        return;
      }
    }
    difficulty = diffKey;
    saveJSON(DIFF_KEY, diffKey);
    var g = generate(diffKey);
    puzzle = g.puzzle;
    solution = g.solution;
    values = puzzle.slice();
    notes = [];
    trial = [];
    for (var i = 0; i < 81; i++) {
      notes.push([]);
      trial.push(false);
    }
    mistakes = 0;
    hintsUsed = 0;
    status = "playing";
    selected = -1;
    notesMode = false;
    trialMode = false;
    undoStack = [];
    elapsed = 0;
    paused = false;
    veilEl.classList.add("hidden");
    var s = getStats();
    s.played++;
    saveStats(s);
    renderAll();
    saveGame();
    closeModal();
  }

  function checkWin() {
    if (status !== "playing") return;
    for (var i = 0; i < 81; i++) {
      if (trial[i] || values[i] !== solution[i]) return;
    }
    status = "won";
    saveGame();
    var s = getStats();
    s.won++;
    var best = s.best[difficulty];
    if (best === null || best === undefined || elapsed < best) s.best[difficulty] = elapsed;
    saveStats(s);
    setTimeout(function () { showWin(); }, 400);
  }

  function togglePause() {
    if (status !== "playing") return;
    paused = !paused;
    if (paused) veilEl.classList.remove("hidden");
    else veilEl.classList.add("hidden");
  }

  // ---------- modal ----------
  function openModal(html) {
    modalContent.innerHTML = html;
    overlay.classList.remove("hidden");
  }
  function closeModal() {
    overlay.classList.add("hidden");
  }
  document.getElementById("modal-close").addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });

  function showDifficulty() {
    var html = "<h2>New Puzzle</h2><p>Choose a difficulty:</p>" + '<div class="modal-buttons">';
    var keys = ["easy", "medium", "hard", "expert", "extreme"];
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      html += '<button class="btn btn-secondary diff-btn" data-diff="' + key + '">' +
        DIFFS[key].label + "<small>" + DIFFS[key].blurb + "</small></button>";
    }
    openModal(html + "</div>");
    var btns = modalContent.querySelectorAll("[data-diff]");
    for (var b = 0; b < btns.length; b++) {
      (function (btn) {
        btn.addEventListener("click", function () { newGame(btn.dataset.diff); });
      })(btns[b]);
    }
  }

  function fmtBest(v) {
    return v === null || v === undefined ? "—" : formatTime(v);
  }

  function statsHTML() {
    var s = getStats();
    return '<div class="stat-row">' +
      statBlock(s.played, "Played") +
      statBlock(s.won, "Solved") +
      "</div><h2>Best Times</h2>" +
      '<div class="stat-row">' +
      statBlock(fmtBest(s.best.easy), "Easy") +
      statBlock(fmtBest(s.best.medium), "Medium") +
      statBlock(fmtBest(s.best.hard), "Hard") +
      statBlock(fmtBest(s.best.expert), "Expert") +
      statBlock(fmtBest(s.best.extreme), "Extreme") +
      "</div>";
  }

  function statBlock(num, label) {
    return '<div class="stat"><div class="num">' + num + '</div><div class="label">' + label + "</div></div>";
  }

  var HELP_HTML = "<h2>How To Play</h2>" +
    "<p>Fill every row, column, and 3&times;3 box with the digits 1&ndash;9.</p>" +
    '<ul class="help-list">' +
    "<li><strong>Notes</strong> — jot down candidate digits in an empty cell.</li>" +
    "<li><strong>Trial</strong> — try a guess; it shows in <em>gold</em>. Erase all trial entries at once with the gold button.</li>" +
    "<li><strong>Erase</strong> clears the selected cell; tapping the same digit again also erases it.</li>" +
    "<li><strong>Hint</strong> fills a cell; <strong>Undo</strong> reverses moves.</li>" +
    "</ul>";

  function showStats() {
    openModal("<h2>Statistics</h2>" + statsHTML() + HELP_HTML);
  }

  function showWin() {
    openModal(
      '<p class="result-title">Puzzle solved! 🎉</p>' +
      '<p class="result-sub">' + DIFFS[difficulty].label + " · " + formatTime(elapsed) +
      " · " + mistakes + (mistakes === 1 ? " mistake" : " mistakes") +
      " · " + hintsUsed + (hintsUsed === 1 ? " hint" : " hints") + "</p>" +
      statsHTML() +
      '<div class="modal-buttons row">' +
      '<button class="btn btn-primary" id="win-new">New Puzzle</button>' +
      '<button class="btn btn-secondary" id="win-close">Keep Looking</button>' +
      "</div>"
    );
    document.getElementById("win-new").addEventListener("click", showDifficulty);
    document.getElementById("win-close").addEventListener("click", closeModal);
  }

  // ---------- theme ----------
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var dark = theme === "dark";
    document.getElementById("icon-moon").style.display = dark ? "" : "none";
    document.getElementById("icon-sun").style.display = dark ? "none" : "";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#121213" : "#ffffff");
    saveJSON(THEME_KEY, theme);
  }
  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  // ---------- wiring ----------
  document.getElementById("btn-new").addEventListener("click", showDifficulty);
  document.getElementById("btn-stats").addEventListener("click", showStats);
  document.getElementById("btn-theme").addEventListener("click", toggleTheme);
  document.getElementById("btn-pause").addEventListener("click", togglePause);
  veilEl.addEventListener("click", togglePause);
  document.getElementById("btn-undo").addEventListener("click", undo);
  document.getElementById("btn-erase").addEventListener("click", eraseCell);
  notesBtn.addEventListener("click", toggleNotes);
  trialBtn.addEventListener("click", toggleTrial);
  document.getElementById("btn-hint").addEventListener("click", hint);
  clearTrialBtn.addEventListener("click", clearTrial);
  document.getElementById("btn-commit-trial").addEventListener("click", commitTrial);

  document.addEventListener("keydown", function (e) {
    if (!overlay.classList.contains("hidden")) {
      if (e.key === "Escape") closeModal();
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
      return;
    }
    if (e.altKey) return;
    var k = e.key;
    if (k >= "1" && k <= "9") {
      inputDigit(parseInt(k, 10));
    } else if (k === "Backspace" || k === "Delete" || k === "0") {
      e.preventDefault();
      eraseCell();
    } else if (k === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1, 0);
    } else if (k === "ArrowDown") {
      e.preventDefault();
      moveSelection(1, 0);
    } else if (k === "ArrowLeft") {
      e.preventDefault();
      moveSelection(0, -1);
    } else if (k === "ArrowRight") {
      e.preventDefault();
      moveSelection(0, 1);
    } else if (k === "n" || k === "N") {
      toggleNotes();
    } else if (k === "t" || k === "T") {
      toggleTrial();
    } else if (k === "h" || k === "H") {
      hint();
    } else if (k === "u" || k === "U") {
      undo();
    } else if (k === "p" || k === "P") {
      togglePause();
    }
  });

  // ---------- init ----------
  applyTheme(loadJSON(THEME_KEY, "dark"));
  buildBoard();
  buildPad();
  setInterval(function () {
    if (status === "playing" && !paused) {
      elapsed++;
      timerEl.textContent = formatTime(elapsed);
    }
  }, 1000);

  if (loadGame()) {
    renderAll();
  } else {
    var startDiff = loadJSON(DIFF_KEY, "easy");
    if (!DIFFS[startDiff]) startDiff = "easy";
    // Fresh start: skip the dirty check by marking no game in progress.
    status = "won";
    newGame(startDiff);
  }
})();
