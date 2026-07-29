const boardEl = document.querySelector("#board");
const difficultyEl = document.querySelector("#difficulty");
const newGameButton = document.querySelector("#newGame");
const flagModeButton = document.querySelector("#flagMode");
const mineCountEl = document.querySelector("#mineCount");
const timerEl = document.querySelector("#timer");
const messageEl = document.querySelector("#message");
const assistantToggleButton = document.querySelector("#assistantToggle");
const assistantPanelEl = document.querySelector("#assistantPanel");
const assistantVerdictEl = document.querySelector("#assistantVerdict");
const assistantReasonEl = document.querySelector("#assistantReason");
const assistantSimpleButton = document.querySelector("#assistantSimple");
const assistantDetailedButton = document.querySelector("#assistantDetailed");
const assistantDetailsEl = document.querySelector("#assistantDetails");
const assistantTechniqueEl = document.querySelector("#assistantTechnique");
const assistantFormulaEl = document.querySelector("#assistantFormula");
const assistantStepsEl = document.querySelector("#assistantSteps");
const assistantPrincipleEl = document.querySelector("#assistantPrinciple");
const assistantVisualEl = document.querySelector("#assistantVisual");
const assistantVisualCaptionEl = document.querySelector(
  "#assistantVisualCaption",
);
const assistantMiniMapsEl = document.querySelector("#assistantMiniMaps");

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
let assistantEnabled = false;
let assistantAnalysis = null;
let assistantTargetIndex = null;
let assistantDepth = "simple";

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
  clearAssistantTarget();
  invalidateAssistantAnalysis();

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
  updateAssistantIdleMessage();
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
  invalidateAssistantAnalysis();
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
  invalidateAssistantAnalysis();
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
  invalidateAssistantAnalysis();
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
  invalidateAssistantAnalysis();
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
  invalidateAssistantAnalysis();
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

function getAssistantAnalysis() {
  if (!assistantAnalysis) {
    assistantAnalysis = window.MinesweeperAssistant.analyze({
      rows: settings.rows,
      cols: settings.cols,
      mines: settings.mines,
      cells: cells.map((cell) => ({
        index: cell.index,
        row: cell.row,
        col: cell.col,
        open: cell.open,
        flagged: cell.flagged,
        adjacent: cell.adjacent,
      })),
    });
  }

  return assistantAnalysis;
}

function invalidateAssistantAnalysis() {
  assistantAnalysis = null;
}

function toggleAssistant() {
  assistantEnabled = !assistantEnabled;
  assistantToggleButton.setAttribute("aria-pressed", String(assistantEnabled));
  assistantPanelEl.hidden = !assistantEnabled;
  clearAssistantTarget();
  updateAssistantIdleMessage();
}

function updateAssistantIdleMessage() {
  if (!assistantEnabled) return;

  assistantPanelEl.dataset.status = "idle";
  assistantVerdictEl.textContent = "분석 준비";
  renderAssistantDetails(null);
  if (gameState === "lost" || gameState === "won") {
    assistantReasonEl.textContent = "새 게임을 시작하면 다시 논리 분석을 사용할 수 있습니다.";
  } else if (firstMove) {
    assistantReasonEl.textContent =
      "첫 클릭은 지뢰가 없도록 보장됩니다. 아무 칸이나 선택해 게임을 시작하세요.";
  } else {
    assistantReasonEl.textContent =
      "닫힌 칸에 마우스를 올리거나 키보드로 초점을 옮기면 판단 근거를 알려드립니다.";
  }
}

function showAssistantForCell(index) {
  if (!assistantEnabled) return;

  clearAssistantTarget();
  assistantTargetIndex = index;
  const cell = cells[index];
  const button = getButton(index);

  if (gameState === "lost" || gameState === "won") {
    updateAssistantIdleMessage();
    return;
  }

  if (firstMove && !cell.open) {
    setAssistantResult(
      "safe",
      "첫 클릭 안전",
      "첫 번째로 선택한 칸과 그 주변에는 지뢰가 배치되지 않으므로 안전합니다.",
      button,
      getNeighbors(index).map((neighbor) => neighbor.index),
      {
        technique: "첫 클릭 보호",
        formula: `선택 칸과 주변 ${getNeighbors(index).length}칸 안전`,
        principle:
          "첫 번째 선택이 운으로 실패하지 않도록 선택한 칸과 인접 칸에는 지뢰를 배치하지 않습니다.",
        examples: [
          {
            label: "첫 클릭 보호 영역",
            mineIndices: [],
            safeIndices: [
              index,
              ...getNeighbors(index).map((neighbor) => neighbor.index),
            ],
          },
        ],
        steps: [
          {
            text: "첫 번째로 선택할 칸을 확인합니다.",
            indices: [index],
          },
          {
            text: "선택한 칸과 맞닿은 모든 칸을 지뢰 배치 대상에서 제외합니다.",
            indices: [
              index,
              ...getNeighbors(index).map((neighbor) => neighbor.index),
            ],
          },
        ],
      },
    );
    return;
  }

  if (cell.open) {
    const detail =
      cell.adjacent > 0
        ? `이미 열린 안전 칸이며, 주변 지뢰 수는 ${cell.adjacent}개입니다.`
        : "이미 열린 안전 칸이며, 주변에 지뢰가 없습니다.";
    setAssistantResult("safe", "확인된 안전 칸", detail, button, [], {
      technique: "공개된 정보",
      formula: `주변 지뢰 ${cell.adjacent}개`,
      principle:
        "이미 열린 칸은 지뢰가 아닌 것으로 확정되며, 표시된 숫자는 인접한 지뢰의 수입니다.",
      steps: [
        {
          text: "이 칸은 이미 열려 있어 안전합니다.",
          indices: [index],
        },
        {
          text: `표시된 숫자 ${cell.adjacent}는 주변 지뢰 수를 뜻합니다.`,
          indices: [index, ...getNeighbors(index).map((item) => item.index)],
        },
      ],
    });
    return;
  }

  const analysis = getAssistantAnalysis();
  if (analysis.inconsistent) {
    setAssistantResult(
      "unknown",
      "분석 모순",
      "공개된 숫자 조건에서 서로 맞지 않는 제약이 발견되어 이 칸을 확정할 수 없습니다.",
      button,
      [],
      {
        technique: "조건 모순",
        formula: "동시에 만족할 수 없는 숫자 조건",
        principle:
          "서로 충돌하는 조건이 있으면 잘못된 결론을 피하기 위해 어떤 칸도 확정하지 않습니다.",
        steps: [
          {
            text: "공개된 숫자 조건을 서로 비교했습니다.",
            indices: cells
              .filter((item) => item.open && item.adjacent > 0)
              .map((item) => item.index),
          },
          {
            text: "모든 조건을 동시에 만족하는 배치를 찾지 못했습니다.",
            indices: [index],
          },
        ],
      },
    );
    return;
  }

  const result = analysis.results.get(index);
  const verdict =
    result.status === "mine"
      ? "확정 지뢰"
      : result.status === "safe"
        ? "확정 안전"
        : "판단 불가";
  const flagNote = cell.flagged
    ? result.status === "safe"
      ? " 현재 깃발은 제거해도 됩니다."
      : result.status === "unknown"
        ? " 깃발은 사용자 표시일 뿐, 아직 논리적으로 확정되지 않았습니다."
        : " 현재 깃발 표시는 논리적 판단과 일치합니다."
    : "";

  setAssistantResult(
    result.status,
    verdict,
    `${result.reason}${flagNote}`,
    button,
    result.relatedIndices,
    result.details,
  );
}

function setAssistantResult(
  status,
  verdict,
  reason,
  button,
  relatedIndices = [],
  details = null,
) {
  assistantPanelEl.dataset.status = status;
  assistantVerdictEl.textContent = verdict;
  assistantReasonEl.textContent = reason;
  renderAssistantDetails(
    details,
    Number(button?.dataset.index),
    status,
  );

  const sourceIndices = relatedIndices.filter((relatedIndex) =>
    cells[relatedIndex]?.open,
  );
  const candidateIndices = relatedIndices.filter(
    (relatedIndex) => !cells[relatedIndex]?.open,
  );

  sourceIndices.forEach((relatedIndex, offset) => {
    getButton(relatedIndex)?.setAttribute(
      "data-assistant-label",
      String(offset + 1),
    );
  });
  candidateIndices.forEach((relatedIndex, offset) => {
    getButton(relatedIndex)?.setAttribute(
      "data-assistant-label",
      getCandidateLabel(offset),
    );
  });

  for (const relatedIndex of relatedIndices) {
    if (relatedIndex === Number(button?.dataset.index)) continue;
    const relatedCell = cells[relatedIndex];
    const relatedButton = getButton(relatedIndex);
    if (!relatedCell || !relatedButton) continue;
    relatedButton.classList.add(
      relatedCell.open
        ? "assistant-related-number"
        : "assistant-related-cell",
    );
  }

  button?.classList.add(`assistant-${status}`);
}

function getCandidateLabel(offset) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return offset < alphabet.length ? alphabet[offset] : String(offset + 1);
}

function setAssistantDepth(depth) {
  assistantDepth = depth;
  const detailed = depth === "detailed";
  assistantSimpleButton.setAttribute("aria-pressed", String(!detailed));
  assistantDetailedButton.setAttribute("aria-pressed", String(detailed));
  assistantDetailsEl.hidden = !detailed || assistantStepsEl.children.length === 0;
}

function renderAssistantDetails(details, targetIndex = null, status = null) {
  assistantStepsEl.replaceChildren();
  assistantMiniMapsEl.replaceChildren();

  if (!details) {
    assistantTechniqueEl.textContent = "사용 기법";
    assistantFormulaEl.textContent = "분석할 칸을 선택하세요";
    assistantPrincipleEl.textContent = "";
    assistantVisualEl.hidden = true;
    assistantDetailsEl.hidden = true;
    return;
  }

  assistantTechniqueEl.textContent = details.technique;
  assistantFormulaEl.textContent = details.formula;
  assistantPrincipleEl.textContent = details.principle;
  renderAssistantMiniMaps(details, targetIndex, status);

  for (const step of details.steps) {
    const item = document.createElement("li");
    item.textContent = step.text;
    item.tabIndex = 0;
    item.dataset.indices = step.indices.join(",");
    assistantStepsEl.append(item);
  }

  assistantDetailsEl.hidden = assistantDepth !== "detailed";
}

function renderAssistantMiniMaps(details, targetIndex, targetStatus) {
  if (targetIndex === null || !cells[targetIndex]) {
    assistantVisualEl.hidden = true;
    return;
  }

  const relatedIndices = new Set([
    targetIndex,
    ...details.steps.flatMap((step) => step.indices),
  ]);
  const relatedCells = [...relatedIndices]
    .map((index) => cells[index])
    .filter(Boolean);
  if (relatedCells.length === 0) {
    assistantVisualEl.hidden = true;
    return;
  }

  const rowBounds = getMiniMapBounds(
    relatedCells.map((cell) => cell.row),
    cells[targetIndex].row,
    settings.rows,
    7,
  );
  const colBounds = getMiniMapBounds(
    relatedCells.map((cell) => cell.col),
    cells[targetIndex].col,
    settings.cols,
    9,
  );
  const examples =
    details.examples?.length > 0
      ? details.examples.slice(0, 2)
      : [
          {
            label: "논리적 상태",
            mineIndices: [],
            safeIndices: [],
          },
        ];

  assistantVisualCaptionEl.textContent =
    examples.length > 1
      ? `대표 가능한 배치 ${examples.length}가지`
      : "공개 정보 기반";

  for (const example of examples) {
    assistantMiniMapsEl.append(
      createAssistantMiniMap({
        example,
        relatedIndices,
        rowBounds,
        colBounds,
        targetIndex,
        targetStatus,
      }),
    );
  }

  assistantVisualEl.hidden = false;
}

function getMiniMapBounds(values, target, total, limit) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (maximum - minimum + 1 <= limit) {
    return { start: minimum, end: maximum };
  }

  const start = Math.max(
    0,
    Math.min(total - limit, target - Math.floor(limit / 2)),
  );
  return { start, end: start + limit - 1 };
}

function createAssistantMiniMap({
  example,
  relatedIndices,
  rowBounds,
  colBounds,
  targetIndex,
  targetStatus,
}) {
  const scenario = document.createElement("div");
  scenario.className = "assistant-mini-scenario";

  const label = document.createElement("span");
  label.textContent = example.label;
  scenario.append(label);

  const miniMap = document.createElement("div");
  miniMap.className = "assistant-mini-map";
  miniMap.setAttribute("role", "grid");
  miniMap.setAttribute("aria-label", example.label);
  miniMap.style.setProperty(
    "--mini-cols",
    colBounds.end - colBounds.start + 1,
  );
  miniMap.style.setProperty(
    "--mini-rows",
    rowBounds.end - rowBounds.start + 1,
  );

  const mineIndices = new Set(example.mineIndices);
  const safeIndices = new Set(example.safeIndices);

  for (let row = rowBounds.start; row <= rowBounds.end; row += 1) {
    for (let col = colBounds.start; col <= colBounds.end; col += 1) {
      const index = row * settings.cols + col;
      const cell = cells[index];
      const miniCell = document.createElement("div");
      const inferred =
        index === targetIndex
          ? targetStatus
          : assistantAnalysis?.results.get(index)?.status;
      let state = "";
      let symbol = "";

      miniCell.className = "assistant-mini-cell";
      miniCell.setAttribute("role", "gridcell");
      miniCell.tabIndex = 0;
      miniCell.dataset.sourceIndex = index;

      if (cell.open) {
        miniCell.classList.add("open");
        symbol = cell.adjacent > 0 ? String(cell.adjacent) : "";
        state = `열린 숫자 ${cell.adjacent}`;
      } else if (mineIndices.has(index)) {
        miniCell.classList.add("scenario-mine");
        symbol = "●";
        state = "가능한 배치의 지뢰";
      } else if (safeIndices.has(index)) {
        miniCell.classList.add("scenario-safe");
        symbol = "✓";
        state = "가능한 배치의 안전 칸";
      } else if (relatedIndices.has(index)) {
        if (inferred === "mine") {
          miniCell.classList.add("scenario-mine");
          symbol = "●";
          state = "논리적으로 확정된 지뢰";
        } else if (inferred === "safe") {
          miniCell.classList.add("scenario-safe");
          symbol = "✓";
          state = "논리적으로 확정된 안전 칸";
        } else {
          miniCell.classList.add("scenario-unknown");
          symbol = "?";
          state = "판단 불가";
        }
      } else {
        state = "관련 영역 밖";
      }

      if (index === targetIndex) miniCell.classList.add("target");
      miniCell.textContent = symbol;
      miniCell.setAttribute(
        "aria-label",
        `${row + 1}행 ${col + 1}열, ${state}`,
      );
      miniMap.append(miniCell);
    }
  }

  scenario.append(miniMap);
  return scenario;
}

function highlightAssistantStep(indices) {
  const activeIndices = new Set(indices);
  boardEl
    .querySelectorAll(
      ".assistant-safe, .assistant-mine, .assistant-unknown, .assistant-related-number, .assistant-related-cell",
    )
    .forEach((button) => {
      const active = activeIndices.has(Number(button.dataset.index));
      button.classList.toggle("assistant-step-active", active);
      button.classList.toggle("assistant-step-muted", !active);
    });
}

function clearAssistantStepHighlight() {
  boardEl
    .querySelectorAll(".assistant-step-active, .assistant-step-muted")
    .forEach((button) => {
      button.classList.remove(
        "assistant-step-active",
        "assistant-step-muted",
      );
    });
}

function handleAssistantStepEnter(event) {
  const step = event.target.closest("li[data-indices]");
  if (!step) return;
  const indices = step.dataset.indices
    .split(",")
    .filter(Boolean)
    .map(Number);
  highlightAssistantStep(indices);
}

function handleAssistantStepLeave(event) {
  if (event.relatedTarget?.closest?.("li[data-indices]")) return;
  clearAssistantStepHighlight();
}

function handleAssistantMiniEnter(event) {
  const miniCell = event.target.closest("[data-source-index]");
  if (!miniCell) return;
  highlightAssistantStep([Number(miniCell.dataset.sourceIndex)]);
}

function handleAssistantMiniLeave(event) {
  if (event.relatedTarget?.closest?.("[data-source-index]")) return;
  clearAssistantStepHighlight();
}

function clearAssistantTarget() {
  boardEl
    .querySelectorAll(
      ".assistant-safe, .assistant-mine, .assistant-unknown, .assistant-related-number, .assistant-related-cell, .assistant-step-active, .assistant-step-muted, [data-assistant-label]",
    )
    .forEach((button) => {
      button.classList.remove(
        "assistant-safe",
        "assistant-mine",
        "assistant-unknown",
        "assistant-related-number",
        "assistant-related-cell",
        "assistant-step-active",
        "assistant-step-muted",
      );
      button.removeAttribute("data-assistant-label");
    });
  assistantTargetIndex = null;
}

function handleAssistantPointer(event) {
  const button = event.target.closest(".cell");
  if (!button) return;
  showAssistantForCell(Number(button.dataset.index));
}

function handleAssistantLeave() {
  if (!assistantEnabled) return;
  clearAssistantStepHighlight();
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

  showAssistantForCell(index);
}

function handleContextMenu(event) {
  const button = event.target.closest(".cell");
  if (!button) return;

  event.preventDefault();
  const index = Number(button.dataset.index);
  toggleFlag(index);
  showAssistantForCell(index);
}

function handleKeyDown(event) {
  const button = event.target.closest(".cell");
  if (!button) return;

  const index = Number(button.dataset.index);
  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    toggleFlag(index);
    showAssistantForCell(index);
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
boardEl.addEventListener("mouseover", handleAssistantPointer);
boardEl.addEventListener("focusin", handleAssistantPointer);
boardEl.addEventListener("mouseleave", handleAssistantLeave);
difficultyEl.addEventListener("change", createGame);
newGameButton.addEventListener("click", createGame);
flagModeButton.addEventListener("click", toggleFlagMode);
assistantToggleButton.addEventListener("click", toggleAssistant);
assistantSimpleButton.addEventListener("click", () =>
  setAssistantDepth("simple"),
);
assistantDetailedButton.addEventListener("click", () =>
  setAssistantDepth("detailed"),
);
assistantStepsEl.addEventListener("mouseover", handleAssistantStepEnter);
assistantStepsEl.addEventListener("focusin", handleAssistantStepEnter);
assistantStepsEl.addEventListener("mouseout", handleAssistantStepLeave);
assistantStepsEl.addEventListener("focusout", handleAssistantStepLeave);
assistantMiniMapsEl.addEventListener("mouseover", handleAssistantMiniEnter);
assistantMiniMapsEl.addEventListener("focusin", handleAssistantMiniEnter);
assistantMiniMapsEl.addEventListener("mouseout", handleAssistantMiniLeave);
assistantMiniMapsEl.addEventListener("focusout", handleAssistantMiniLeave);
window.addEventListener("resize", () => {
  boardEl.style.setProperty("--cell-size", `${getCellSize()}px`);
});

createGame();
