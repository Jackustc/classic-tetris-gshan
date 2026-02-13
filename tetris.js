const COLS = 10;
const ROWS = 20;
const BLOCK = 36;
const BASE_DROP_MS = 700;
const MIN_DROP_MS = 120;
const DEFAULT_PLAYER_NAME = "Player";
const LEADERBOARD_KEY = "tetris_leaderboard_v1";
const PLAYER_NAME_KEY = "tetris_player_name_v1";
const MAX_RANKINGS = 10;

const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
};

const COLORS = {
  I: "#3a8ad8",
  O: "#d8b63a",
  T: "#8a3ad8",
  S: "#3ab35f",
  Z: "#d84a3a",
  J: "#3a5ad8",
  L: "#d8843a",
  G: "#555",
};

const PIECES = Object.keys(SHAPES);

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function rotate(matrix) {
  const h = matrix.length;
  const w = matrix[0].length;
  const out = Array.from({ length: w }, () => Array(h).fill(0));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      out[x][h - 1 - y] = matrix[y][x];
    }
  }
  return out;
}

function randomPiece(rng = Math.random) {
  const type = PIECES[Math.floor(rng() * PIECES.length)];
  const shape = cloneMatrix(SHAPES[type]);
  return {
    type,
    shape,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0,
  };
}

function collides(board, piece) {
  for (let y = 0; y < piece.shape.length; y += 1) {
    for (let x = 0; x < piece.shape[y].length; x += 1) {
      if (!piece.shape[y][x]) {
        continue;
      }
      const bx = piece.x + x;
      const by = piece.y + y;
      if (bx < 0 || bx >= COLS || by >= ROWS) {
        return true;
      }
      if (by >= 0 && board[by][bx]) {
        return true;
      }
    }
  }
  return false;
}

function merge(board, piece) {
  for (let y = 0; y < piece.shape.length; y += 1) {
    for (let x = 0; x < piece.shape[y].length; x += 1) {
      if (piece.shape[y][x]) {
        const by = piece.y + y;
        const bx = piece.x + x;
        if (by >= 0) {
          board[by][bx] = piece.type;
        }
      }
    }
  }
}

function clearLines(board) {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every((cell) => cell !== null)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }
  return cleared;
}

function getDropMs(level) {
  return Math.max(MIN_DROP_MS, BASE_DROP_MS - (level - 1) * 70);
}

function createState(rng = Math.random) {
  const board = createBoard();
  const current = randomPiece(rng);
  return {
    board,
    current,
    score: 0,
    lines: 0,
    level: 1,
    isPaused: false,
    isGameOver: false,
    rng,
  };
}

function spawnNext(state) {
  const next = randomPiece(state.rng);
  if (collides(state.board, next)) {
    state.isGameOver = true;
    return;
  }
  state.current = next;
}

function softDrop(state) {
  if (state.isPaused || state.isGameOver) {
    return;
  }
  const moved = { ...state.current, y: state.current.y + 1 };
  if (!collides(state.board, moved)) {
    state.current = moved;
    return;
  }

  merge(state.board, state.current);
  const cleared = clearLines(state.board);
  if (cleared > 0) {
    state.lines += cleared;
    state.score += [0, 100, 300, 500, 800][cleared];
    state.level = Math.floor(state.lines / 10) + 1;
  }
  spawnNext(state);
}

function hardDrop(state) {
  if (state.isPaused || state.isGameOver) {
    return;
  }
  let moved = { ...state.current };
  while (!collides(state.board, { ...moved, y: moved.y + 1 })) {
    moved = { ...moved, y: moved.y + 1 };
  }
  state.current = moved;
  softDrop(state);
}

function move(state, dx) {
  if (state.isPaused || state.isGameOver) {
    return;
  }
  const moved = { ...state.current, x: state.current.x + dx };
  if (!collides(state.board, moved)) {
    state.current = moved;
  }
}

function turn(state) {
  if (state.isPaused || state.isGameOver) {
    return;
  }
  const rotated = { ...state.current, shape: rotate(state.current.shape) };
  if (!collides(state.board, rotated)) {
    state.current = rotated;
    return;
  }
  const kickLeft = { ...rotated, x: rotated.x - 1 };
  const kickRight = { ...rotated, x: rotated.x + 1 };
  if (!collides(state.board, kickLeft)) {
    state.current = kickLeft;
  } else if (!collides(state.board, kickRight)) {
    state.current = kickRight;
  }
}

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart-btn");
const pauseBtn = document.getElementById("pause-btn");
const controlBtns = document.querySelectorAll("[data-action]");
const playerNameInput = document.getElementById("player-name");
const savePlayerBtn = document.getElementById("save-player-btn");
const currentPlayerEl = document.getElementById("current-player");
const rankingListEl = document.getElementById("ranking-list");
const clearRankingBtn = document.getElementById("clear-ranking-btn");

let state = createState();
let timer = null;
let currentPlayerName = DEFAULT_PLAYER_NAME;
let hasRecordedCurrentRound = false;

function readLeaderboard() {
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item.name === "string" && Number.isFinite(item.score))
      .map((item) => ({
        name: item.name.trim().slice(0, 20) || DEFAULT_PLAYER_NAME,
        score: Math.max(0, Math.floor(item.score)),
        lines: Number.isFinite(item.lines) ? Math.max(0, Math.floor(item.lines)) : 0,
        at: typeof item.at === "number" ? item.at : Date.now(),
      }));
  } catch {
    return [];
  }
}

function saveLeaderboard(entries) {
  window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}

function sortRankings(entries) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.lines !== a.lines) {
      return b.lines - a.lines;
    }
    return a.at - b.at;
  });
}

function renderRankingBoard() {
  if (!rankingListEl) {
    return;
  }
  const entries = sortRankings(readLeaderboard()).slice(0, MAX_RANKINGS);
  rankingListEl.innerHTML = "";
  if (entries.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-rank";
    li.textContent = "No scores yet.";
    rankingListEl.appendChild(li);
    return;
  }
  for (const entry of entries) {
    const li = document.createElement("li");
    li.textContent = `${entry.name} - ${entry.score} pts (${entry.lines} lines)`;
    rankingListEl.appendChild(li);
  }
}

function normalizePlayerName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return DEFAULT_PLAYER_NAME;
  }
  return trimmed.slice(0, 20);
}

function setCurrentPlayerName(name) {
  currentPlayerName = normalizePlayerName(name);
  if (currentPlayerEl) {
    currentPlayerEl.textContent = currentPlayerName;
  }
  if (playerNameInput) {
    playerNameInput.value = currentPlayerName;
  }
  window.localStorage.setItem(PLAYER_NAME_KEY, currentPlayerName);
}

function loadCurrentPlayerName() {
  const stored = window.localStorage.getItem(PLAYER_NAME_KEY);
  setCurrentPlayerName(stored || DEFAULT_PLAYER_NAME);
}

function recordScoreIfNeeded() {
  if (!state.isGameOver || hasRecordedCurrentRound) {
    return;
  }
  const entries = readLeaderboard();
  entries.push({
    name: currentPlayerName,
    score: state.score,
    lines: state.lines,
    at: Date.now(),
  });
  saveLeaderboard(sortRankings(entries).slice(0, MAX_RANKINGS));
  hasRecordedCurrentRound = true;
  renderRankingBoard();
}

function drawCell(x, y, type) {
  ctx.fillStyle = COLORS[type] || COLORS.G;
  ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
  ctx.strokeStyle = "#f0f0f0";
  ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = state.board[y][x];
      if (cell) {
        drawCell(x, y, cell);
      } else {
        ctx.strokeStyle = "#efefef";
        ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
      }
    }
  }

  for (let y = 0; y < state.current.shape.length; y += 1) {
    for (let x = 0; x < state.current.shape[y].length; x += 1) {
      if (state.current.shape[y][x]) {
        drawCell(state.current.x + x, state.current.y + y, state.current.type);
      }
    }
  }

  scoreEl.textContent = String(state.score);
  linesEl.textContent = String(state.lines);
  levelEl.textContent = String(state.level);
  if (state.isGameOver) {
    statusEl.textContent = "Game Over";
  } else if (state.isPaused) {
    statusEl.textContent = "Paused";
  } else {
    statusEl.textContent = "Running";
  }
  pauseBtn.textContent = state.isPaused ? "Resume" : "Pause";
  recordScoreIfNeeded();
}

function startLoop() {
  if (timer) {
    clearInterval(timer);
  }
  timer = setInterval(() => {
    softDrop(state);
    render();
    if (state.isGameOver) {
      clearInterval(timer);
      timer = null;
    } else {
      const targetMs = getDropMs(state.level);
      if (timer && timer._ms !== targetMs) {
        startLoop();
      }
    }
  }, getDropMs(state.level));
  timer._ms = getDropMs(state.level);
}

function restart() {
  state = createState();
  hasRecordedCurrentRound = false;
  render();
  startLoop();
}

function togglePause() {
  if (state.isGameOver) {
    return;
  }
  state.isPaused = !state.isPaused;
  render();
}

function handleAction(action) {
  if (action === "left") {
    move(state, -1);
  } else if (action === "right") {
    move(state, 1);
  } else if (action === "down") {
    softDrop(state);
  } else if (action === "rotate") {
    turn(state);
  } else if (action === "drop") {
    hardDrop(state);
  }
  render();
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowleft") {
    event.preventDefault();
    handleAction("left");
  } else if (key === "arrowright") {
    event.preventDefault();
    handleAction("right");
  } else if (key === "arrowdown") {
    event.preventDefault();
    handleAction("down");
  } else if (key === "arrowup") {
    event.preventDefault();
    handleAction("rotate");
  } else if (key === " " || key === "spacebar") {
    event.preventDefault();
    handleAction("drop");
  } else if (key === "p") {
    event.preventDefault();
    togglePause();
  }
});

restartBtn.addEventListener("click", restart);
pauseBtn.addEventListener("click", togglePause);
savePlayerBtn.addEventListener("click", () => setCurrentPlayerName(playerNameInput.value));
playerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    setCurrentPlayerName(playerNameInput.value);
  }
});
clearRankingBtn.addEventListener("click", () => {
  saveLeaderboard([]);
  renderRankingBoard();
});
for (const btn of controlBtns) {
  btn.addEventListener("click", () => handleAction(btn.dataset.action));
}

loadCurrentPlayerName();
renderRankingBoard();
restart();
