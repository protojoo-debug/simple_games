const boardEl = document.querySelector("#board");
const difficultyEl = document.querySelector("#difficulty");
const newGameButton = document.querySelector("#newGame");
const flagModeButton = document.querySelector("#flagMode");
const mineCountEl = document.querySelector("#mineCount");
const timerEl = document.querySelector("#timer");
const messageEl = document.querySelector("#message");

const DIFFICULTIES = {
  beginner: { rows: 9, cols: 9, mines: 10, label: "초급" },
  intermediate: { rows: 16, cols: 16, mines: 40, label: "중급" },
  expert: { rows: 16, cols: 30, mines: 99, label: "고급" },
};

let settings = DIFFICULTIES.beginner;
let cells = [];
let gameState = "ready";
let firstMove = true;
let flagMode = false;
let flagsPlaced = 0;
let openedCells = 0;
let elapsed = 0;
let timerId = null;

function createGame() {
  stopTimer();
  settings = DIFFICULTIES[difficultyEl.value];
  cells = Array.from({ length: settings.rows * settings.cols }, (_, index) => ({
    index,
    row: Math.floor(index / settings.cols),
    col: index % settings.cols,
    mine: false,
    open: false,
    flagged: false,
    adjacent: 0,
  }));

  gameState = "ready";
  firstMove = true;
  flagsPlaced = 0;
  openedCells = 0;
  elapsed = 0;
  timerEl.textContent = "000";
  messageEl.textContent = "첫 칸을 열어 시작하세요";
  flagModeButton.setAttribute("aria-pressed", "false");
  flagMode = false;

  boardEl.style.setProperty("--rows", settings.rows);
  boardEl.style.setProperty("--cols", settings.cols);
  boardEl.style.setProperty("--cell-size", `${getCellSize()}px`);
  boardEl.innerHTML = "";

  const fragment = document.createDocumentFragment();
  for (const cell of cells) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.dataset.index = cell.index;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${cell.row + 1}행 ${cell.col + 1}열, 닫힘`);
    fragment.append(button);
  }
  boardEl.append(fragment);
  updateMineCount();
}

function getCellSize() {
  const available = Math.max(280, Math.min(window.innerWidth - 52, 1040));
  const ideal = Math.floor(available / settings.cols);
  return Math.max(24, Math.min(42, ideal));
}

function placeMines(safeIndex) {
  const safeZone = new Set([safeIndex, ...getNeighbors(safeIndex).map((cell) => cell.index)]);
  const candidates = cells.filter((cell) => !safeZone.has(cell.index));

  shuffle(candidates);
  for (const cell of candidates.slice(0, settings.mines)) {
    cell.mine = true;
  }

  for (const cell of cells) {
    cell.adjacent = getNeighbors(cell.index).filter((neighbor) => neighbor.mine).length;
  }
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function getNeighbors(index) {
  const cell = cells[index];
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;

      const row = cell.row + rowOffset;
      const col = cell.col + colOffset;
      if (row < 0 || col < 0 || row >= settings.rows || col >= settings.cols) continue;
      neighbors.push(cells[row * settings.cols + col]);
    }
  }

  return neighbors;
}

function openCell(index) {
  if (gameState === "lost" || gameState === "won") return;

  const cell = cells[index];
  if (!cell || cell.flagged) return;

  if (firstMove) {
    placeMines(index);
    firstMove = false;
    gameState = "playing";
    messageEl.textContent = "지뢰를 피해서 모든 칸을 여세요";
    startTimer();
  }

  if (cell.open) {
    openAroundNumber(cell);
    return;
  }

  if (cell.mine) {
    loseGame(cell);
    return;
  }

  floodOpen(cell);
  renderBoard();
  checkWin();
}

function floodOpen(startCell) {
  const queue = [startCell];

  while (queue.length) {
    const cell = queue.shift();
    if (cell.open || cell.flagged) continue;

    cell.open = true;
    openedCells += 1;

    if (cell.adjacent !== 0) continue;

    for (const neighbor of getNeighbors(cell.index)) {
      if (!neighbor.open && !neighbor.flagged && !neighbor.mine) {
        queue.push(neighbor);
      }
    }
  }
}

function openAroundNumber(cell) {
  if (!cell.open || cell.adjacent === 0) return;

  const neighbors = getNeighbors(cell.index);
  const flagged = neighbors.filter((neighbor) => neighbor.flagged).length;
  if (flagged !== cell.adjacent) return;

  for (const neighbor of neighbors) {
    if (!neighbor.flagged && !neighbor.open) {
      if (neighbor.mine) {
        loseGame(neighbor);
        return;
      }
      floodOpen(neighbor);
    }
  }

  renderBoard();
  checkWin();
}

function toggleFlag(index) {
  if (gameState === "lost" || gameState === "won") return;

  const cell = cells[index];
  if (!cell || cell.open) return;

  cell.flagged = !cell.flagged;
  flagsPlaced += cell.flagged ? 1 : -1;
  updateMineCount();
  renderCell(cell);
  messageEl.textContent = cell.flagged ? "깃발을 표시했습니다" : "깃발을 지웠습니다";
}

function loseGame(triggerCell) {
  gameState = "lost";
  stopTimer();

  for (const cell of cells) {
    if (cell.mine) {
      cell.open = true;
    }
  }

  renderBoard();
  const button = getButton(triggerCell.index);
  button.classList.add("mine");
  messageEl.textContent = "지뢰를 밟았습니다. 새 게임으로 다시 도전하세요.";
}

function checkWin() {
  const clearCells = cells.length - settings.mines;
  if (openedCells !== clearCells) return;

  gameState = "won";
  stopTimer();

  for (const cell of cells) {
    if (cell.mine && !cell.flagged) {
      cell.flagged = true;
      flagsPlaced += 1;
    }
  }

  updateMineCount();
  renderBoard();
  messageEl.textContent = `${settings.label} 성공. 기록은 ${formatTime(elapsed)}초입니다.`;
}

function renderBoard() {
  for (const cell of cells) {
    renderCell(cell);
  }
}

function renderCell(cell) {
  const button = getButton(cell.index);
  button.className = "cell";
  button.textContent = "";
  button.disabled = gameState === "lost" || gameState === "won";

  if (cell.open) {
    button.classList.add("open");
    if (cell.mine) {
      button.classList.add("mine");
    } else if (cell.adjacent > 0) {
      button.textContent = cell.adjacent;
      button.classList.add(`n${cell.adjacent}`);
    }
  } else if (cell.flagged) {
    button.classList.add("flagged");
  }

  if (gameState === "lost" && cell.flagged && !cell.mine) {
    button.classList.add("wrong");
  }

  button.setAttribute("aria-label", getCellLabel(cell));
}

function getCellLabel(cell) {
  const position = `${cell.row + 1}행 ${cell.col + 1}열`;
  if (cell.open && cell.mine) return `${position}, 지뢰`;
  if (cell.open && cell.adjacent > 0) return `${position}, 주변 지뢰 ${cell.adjacent}개`;
  if (cell.open) return `${position}, 빈 칸`;
  if (cell.flagged) return `${position}, 깃발`;
  return `${position}, 닫힘`;
}

function getButton(index) {
  return boardEl.querySelector(`[data-index="${index}"]`);
}

function updateMineCount() {
  mineCountEl.textContent = String(settings.mines - flagsPlaced).padStart(2, "0");
}

function startTimer() {
  stopTimer();
  timerId = window.setInterval(() => {
    elapsed += 1;
    timerEl.textContent = formatTime(elapsed);
  }, 1000);
}

function stopTimer() {
  if (!timerId) return;
  window.clearInterval(timerId);
  timerId = null;
}

function formatTime(value) {
  return String(Math.min(value, 999)).padStart(3, "0");
}

function handleBoardClick(event) {
  const button = event.target.closest(".cell");
  if (!button) return;

  const index = Number(button.dataset.index);
  if (flagMode) {
    toggleFlag(index);
  } else {
    openCell(index);
  }
}

function handleContextMenu(event) {
  const button = event.target.closest(".cell");
  if (!button) return;

  event.preventDefault();
  toggleFlag(Number(button.dataset.index));
}

function handleKeyDown(event) {
  const button = event.target.closest(".cell");
  if (!button) return;

  const index = Number(button.dataset.index);
  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    toggleFlag(index);
  }
}

function toggleFlagMode() {
  flagMode = !flagMode;
  flagModeButton.setAttribute("aria-pressed", String(flagMode));
  messageEl.textContent = flagMode ? "깃발 모드가 켜졌습니다" : "열기 모드가 켜졌습니다";
}

boardEl.addEventListener("click", handleBoardClick);
boardEl.addEventListener("contextmenu", handleContextMenu);
boardEl.addEventListener("keydown", handleKeyDown);
difficultyEl.addEventListener("change", createGame);
newGameButton.addEventListener("click", createGame);
flagModeButton.addEventListener("click", toggleFlagMode);
window.addEventListener("resize", () => {
  boardEl.style.setProperty("--cell-size", `${getCellSize()}px`);
});

createGame();
