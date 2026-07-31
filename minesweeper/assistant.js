(function attachMinesweeperAssistant(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.MinesweeperAssistant = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAssistant() {
  const MAX_CONSTRAINTS = 600;
  const MAX_SEARCH_NODES = 400000;
  const MAX_SOLUTIONS = 120000;

  function analyze(board) {
    const cellByIndex = new Map(board.cells.map((cell) => [cell.index, cell]));
    const closedIndices = board.cells.filter((cell) => !cell.open).map((cell) => cell.index);
    const rawConstraints = buildConstraints(board);
    const solved = solveConstraintClosure(rawConstraints, cellByIndex);
    const results = new Map(solved.statuses);

    if (solved.inconsistent) {
      return {
        results,
        inconsistent: true,
        incomplete: false,
      };
    }

    const reducedConstraints = reduceAndDedupeConstraints(
      solved.constraints,
      solved.statuses,
    );
    const components = buildComponents(reducedConstraints);
    const enumerated = components.map((component) =>
      enumerateComponent(component.variables, component.constraints),
    );

    for (let i = 0; i < components.length; i += 1) {
      const component = components[i];
      const models = enumerated[i];
      if (models.truncated || models.solutions === 0) continue;

      for (let variableOffset = 0; variableOffset < component.variables.length; variableOffset += 1) {
        const index = component.variables[variableOffset];
        const mineHits = totalMineHits(models, variableOffset);
        if (mineHits === models.solutions) {
          setResult(results, index, "mine", {
            kind: "models",
            text: "이 칸과 연결된 숫자 조건을 만족하는 가능한 배치를 모두 비교하면, 모든 배치에서 이 칸은 지뢰입니다.",
            relatedIndices: getComponentRelatedIndices(component),
            details: buildModelDetails(
              component,
              models,
              index,
              mineHits,
            ),
          });
        } else if (mineHits === 0) {
          setResult(results, index, "safe", {
            kind: "models",
            text: "이 칸과 연결된 숫자 조건을 만족하는 가능한 배치를 모두 비교하면, 모든 배치에서 이 칸은 안전합니다.",
            relatedIndices: getComponentRelatedIndices(component),
            details: buildModelDetails(
              component,
              models,
              index,
              mineHits,
            ),
          });
        }
      }
    }

    const allComponentsComplete = enumerated.every(
      (models) => !models.truncated && models.solutions > 0,
    );

    if (allComponentsComplete) {
      applyGlobalMineCount({
        board,
        cellByIndex,
        closedIndices,
        statuses: solved.statuses,
        components,
        enumerated,
        results,
      });
    }

    const constrainedVariables = new Set(
      components.flatMap((component) => component.variables),
    );
    const incompleteVariables = new Set();

    for (let i = 0; i < components.length; i += 1) {
      if (!enumerated[i].truncated) continue;
      for (const index of components[i].variables) incompleteVariables.add(index);
    }

    for (const index of closedIndices) {
      if (results.has(index)) continue;

      if (incompleteVariables.has(index)) {
        const component = components.find((item) =>
          item.variables.includes(index),
        );
        results.set(index, {
          status: "unknown",
          reason:
            "연결된 영역이 매우 복잡해 빠른 전수 분석 범위를 넘었습니다. 직접 규칙과 부분집합·차집합 규칙만으로는 확정할 수 없습니다.",
          reasonKind: "incomplete",
          relatedIndices: component
            ? getComponentRelatedIndices(component)
            : [],
          details: component
            ? buildIncompleteDetails(component, index)
            : null,
        });
      } else if (!constrainedVariables.has(index)) {
        results.set(index, {
          status: "unknown",
          reason:
            "이 칸과 연결된 열린 숫자 정보가 없습니다. 현재 정보만으로는 안전한 배치와 지뢰인 배치가 모두 가능합니다.",
          reasonKind: "unconnected",
          relatedIndices: [],
          details: {
            technique: "정보 부족",
            formula: "연결된 숫자 0개",
            principle:
              "열린 숫자와 연결되어야 해당 칸에 지뢰 제약을 만들 수 있습니다.",
            steps: [
              {
                text: "이 칸과 맞닿은 열린 숫자가 없습니다.",
                indices: [index],
              },
              {
                text: "안전한 경우와 지뢰인 경우를 모두 배제할 수 없습니다.",
                indices: [index],
              },
            ],
          },
        });
      } else {
        const componentIndex = components.findIndex((item) =>
          item.variables.includes(index),
        );
        const component = components[componentIndex];
        const models = enumerated[componentIndex];
        const variableOffset = component.variables.indexOf(index);
        const mineHits = totalMineHits(models, variableOffset);
        results.set(index, {
          status: "unknown",
          reason:
            "현재 공개된 숫자 조건을 만족하는 배치 중 이 칸이 안전한 경우와 지뢰인 경우가 모두 있습니다.",
          reasonKind: "models",
          relatedIndices: component
            ? getComponentRelatedIndices(component)
            : [],
          details: buildModelDetails(
            component,
            models,
            index,
            mineHits,
          ),
        });
      }
    }

    return {
      results,
      inconsistent: false,
      incomplete: incompleteVariables.size > 0,
    };
  }

  function buildConstraints(board) {
    const constraints = [];

    for (const cell of board.cells) {
      if (!cell.open || cell.isClue === false) continue;

      const variables = getNeighborIndices(cell.index, board.rows, board.cols).filter(
        (index) => !board.cells[index].open,
      );

      if (variables.length === 0) continue;
      constraints.push({
        cells: variables.sort((a, b) => a - b),
        mines: cell.adjacent,
        sourceIndices: [cell.index],
        kind: "number",
      });
    }

    return dedupeConstraints(constraints).constraints;
  }

  function solveConstraintClosure(initialConstraints, cellByIndex) {
    const statuses = new Map();
    const constraints = [...initialConstraints];
    const signatures = new Set(
      constraints.map((constraint) => constraintSignature(constraint)),
    );
    let inconsistent = false;
    let changed = true;

    while (changed && !inconsistent) {
      changed = false;
      const reducedResult = reduceAndDedupeConstraints(
        constraints,
        statuses,
        true,
      );
      const reduced = reducedResult.constraints;
      inconsistent = reducedResult.inconsistent;
      if (inconsistent) break;

      for (const constraint of reduced) {
        if (constraint.mines === 0) {
          for (const index of constraint.cells) {
            changed =
              setLogicalStatus(
                statuses,
                index,
                "safe",
                explainLogicalDeduction("safe", constraint, cellByIndex),
                unique([...constraint.sourceIndices, ...constraint.cells]),
                buildLogicalDetails("safe", constraint, cellByIndex, index),
              ) || changed;
          }
        } else if (constraint.mines === constraint.cells.length) {
          for (const index of constraint.cells) {
            changed =
              setLogicalStatus(
                statuses,
                index,
                "mine",
                explainLogicalDeduction("mine", constraint, cellByIndex),
                unique([...constraint.sourceIndices, ...constraint.cells]),
                buildLogicalDetails("mine", constraint, cellByIndex, index),
              ) || changed;
          }
        }
      }

      if (changed) continue;

      const before = constraints.length;
      for (let i = 0; i < reduced.length; i += 1) {
        for (let j = i + 1; j < reduced.length; j += 1) {
          addDifferenceConstraint(reduced[i], reduced[j], constraints, signatures);
          addDifferenceConstraint(reduced[j], reduced[i], constraints, signatures);
          if (constraints.length >= MAX_CONSTRAINTS) break;
        }
        if (constraints.length >= MAX_CONSTRAINTS) break;
      }
      changed = constraints.length > before;
    }

    return { constraints, statuses, inconsistent };
  }

  function addDifferenceConstraint(smaller, larger, constraints, signatures) {
    if (smaller.cells.length >= larger.cells.length) return;
    if (!isSubset(smaller.cells, larger.cells)) return;

    const smallerSet = new Set(smaller.cells);
    const cells = larger.cells.filter((index) => !smallerSet.has(index));
    const mines = larger.mines - smaller.mines;
    if (cells.length === 0 || mines < 0 || mines > cells.length) return;

    const constraint = {
      cells,
      mines,
      sourceIndices: unique([
        ...smaller.sourceIndices,
        ...larger.sourceIndices,
      ]),
      kind: "difference",
    };
    const signature = constraintSignature(constraint);
    if (signatures.has(signature)) return;

    signatures.add(signature);
    constraints.push(constraint);
  }

  function reduceAndDedupeConstraints(
    constraints,
    statuses,
    includeMetadata = false,
  ) {
    const reduced = [];
    let inconsistent = false;

    for (const constraint of constraints) {
      let mines = constraint.mines;
      const cells = [];

      for (const index of constraint.cells) {
        const known = statuses.get(index);
        if (known?.status === "mine") mines -= 1;
        else if (!known) cells.push(index);
      }

      if (mines < 0 || mines > cells.length) {
        inconsistent = true;
        continue;
      }
      if (cells.length === 0) {
        if (mines !== 0) inconsistent = true;
        continue;
      }

      reduced.push({
        ...constraint,
        cells,
        mines,
      });
    }

    const deduped = dedupeConstraints(reduced);
    inconsistent = inconsistent || deduped.inconsistent;

    return includeMetadata
      ? { constraints: deduped.constraints, inconsistent }
      : deduped.constraints;
  }

  function dedupeConstraints(constraints) {
    const byCells = new Map();
    let inconsistent = false;

    for (const constraint of constraints) {
      const cells = [...constraint.cells].sort((a, b) => a - b);
      const key = cells.join(",");
      const existing = byCells.get(key);

      if (existing) {
        if (existing.mines !== constraint.mines) {
          inconsistent = true;
          continue;
        }
        existing.sourceIndices = unique([
          ...existing.sourceIndices,
          ...constraint.sourceIndices,
        ]);
        if (constraint.kind === "difference") existing.kind = "difference";
        continue;
      }

      byCells.set(key, {
        ...constraint,
        cells,
        sourceIndices: unique(constraint.sourceIndices),
      });
    }

    return { constraints: [...byCells.values()], inconsistent };
  }

  function buildComponents(constraints) {
    const constraintsByVariable = new Map();

    for (let constraintIndex = 0; constraintIndex < constraints.length; constraintIndex += 1) {
      for (const variable of constraints[constraintIndex].cells) {
        if (!constraintsByVariable.has(variable)) {
          constraintsByVariable.set(variable, []);
        }
        constraintsByVariable.get(variable).push(constraintIndex);
      }
    }

    const visitedVariables = new Set();
    const components = [];

    for (const startVariable of constraintsByVariable.keys()) {
      if (visitedVariables.has(startVariable)) continue;

      const variableQueue = [startVariable];
      const variables = new Set();
      const constraintIndices = new Set();

      while (variableQueue.length) {
        const variable = variableQueue.pop();
        if (visitedVariables.has(variable)) continue;
        visitedVariables.add(variable);
        variables.add(variable);

        for (const constraintIndex of constraintsByVariable.get(variable) ?? []) {
          if (constraintIndices.has(constraintIndex)) continue;
          constraintIndices.add(constraintIndex);
          for (const neighborVariable of constraints[constraintIndex].cells) {
            if (!visitedVariables.has(neighborVariable)) {
              variableQueue.push(neighborVariable);
            }
          }
        }
      }

      components.push({
        variables: [...variables],
        constraints: [...constraintIndices].map((index) => constraints[index]),
      });
    }

    return components;
  }

  function enumerateComponent(variables, constraints) {
    const variableOffset = new Map(
      variables.map((variable, offset) => [variable, offset]),
    );
    const localConstraints = constraints.map((constraint) => ({
      variables: constraint.cells.map((index) => variableOffset.get(index)),
      mines: constraint.mines,
    }));
    const relatedConstraints = variables.map(() => []);

    for (let constraintIndex = 0; constraintIndex < localConstraints.length; constraintIndex += 1) {
      for (const offset of localConstraints[constraintIndex].variables) {
        relatedConstraints[offset].push(constraintIndex);
      }
    }

    const order = variables
      .map((_, offset) => offset)
      .sort(
        (a, b) =>
          relatedConstraints[b].length - relatedConstraints[a].length,
      );
    const assignment = new Int8Array(variables.length);
    assignment.fill(-1);
    const assignedMines = new Int16Array(localConstraints.length);
    const unassigned = new Int16Array(
      localConstraints.map((constraint) => constraint.variables.length),
    );
    const buckets = new Map();
    const mineExamples = Array(variables.length).fill(null);
    const safeExamples = Array(variables.length).fill(null);
    let solutions = 0;
    let nodes = 0;
    let truncated = false;

    function search(depth, mineTotal) {
      if (truncated) return;
      nodes += 1;
      if (nodes > MAX_SEARCH_NODES || solutions >= MAX_SOLUTIONS) {
        truncated = true;
        return;
      }

      if (depth === order.length) {
        solutions += 1;
        let bucket = buckets.get(mineTotal);
        if (!bucket) {
          bucket = {
            solutions: 0,
            mineHits: new Uint32Array(variables.length),
          };
          buckets.set(mineTotal, bucket);
        }
        bucket.solutions += 1;
        let example = null;
        for (let offset = 0; offset < assignment.length; offset += 1) {
          if (assignment[offset] === 1) bucket.mineHits[offset] += 1;
          const needsExample =
            assignment[offset] === 1
              ? !mineExamples[offset]
              : !safeExamples[offset];
          if (!needsExample) continue;

          example ??= Array.from(assignment);
          if (assignment[offset] === 1) mineExamples[offset] = example;
          else safeExamples[offset] = example;
        }
        return;
      }

      const offset = order[depth];
      for (const value of [0, 1]) {
        assignment[offset] = value;
        let valid = true;

        for (const constraintIndex of relatedConstraints[offset]) {
          unassigned[constraintIndex] -= 1;
          assignedMines[constraintIndex] += value;
          const required = localConstraints[constraintIndex].mines;
          if (
            assignedMines[constraintIndex] > required ||
            assignedMines[constraintIndex] + unassigned[constraintIndex] < required
          ) {
            valid = false;
          }
        }

        if (valid) search(depth + 1, mineTotal + value);

        for (const constraintIndex of relatedConstraints[offset]) {
          unassigned[constraintIndex] += 1;
          assignedMines[constraintIndex] -= value;
        }
        assignment[offset] = -1;
      }
    }

    search(0, 0);
    return {
      buckets,
      solutions,
      truncated,
      mineExamples,
      safeExamples,
    };
  }

  function applyGlobalMineCount(context) {
    const {
      board,
      closedIndices,
      statuses,
      components,
      enumerated,
      results,
    } = context;
    const knownMines = [...statuses.values()].filter(
      (result) => result.status === "mine",
    ).length;
    const remainingMines = board.mines - knownMines;
    const frontier = new Set(
      components.flatMap((component) => component.variables),
    );
    const offFrontier = closedIndices.filter(
      (index) => !statuses.has(index) && !frontier.has(index),
    );
    const possibleCounts = enumerated.map((models) => [...models.buckets.keys()]);
    const globallyFeasibleOffCounts = new Set();

    for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
      const otherSums = possibleSums(
        possibleCounts.filter((_, index) => index !== componentIndex),
      );
      const models = enumerated[componentIndex];
      const feasibleBucketCounts = new Set();

      for (const bucketMineCount of models.buckets.keys()) {
        for (const otherMineCount of otherSums) {
          const offCount = remainingMines - bucketMineCount - otherMineCount;
          if (offCount >= 0 && offCount <= offFrontier.length) {
            feasibleBucketCounts.add(bucketMineCount);
            globallyFeasibleOffCounts.add(offCount);
          }
        }
      }

      for (let variableOffset = 0; variableOffset < components[componentIndex].variables.length; variableOffset += 1) {
        let minePossible = false;
        let safePossible = false;

        for (const mineCount of feasibleBucketCounts) {
          const bucket = models.buckets.get(mineCount);
          const mineHits = bucket.mineHits[variableOffset];
          if (mineHits > 0) minePossible = true;
          if (mineHits < bucket.solutions) safePossible = true;
        }

        const index = components[componentIndex].variables[variableOffset];
        if (minePossible && !safePossible) {
          setResult(results, index, "mine", {
            kind: "global",
            text: `모든 숫자 조건과 보드에 남은 지뢰 ${remainingMines}개를 함께 계산하면, 가능한 모든 배치에서 이 칸은 지뢰입니다.`,
            relatedIndices: getComponentRelatedIndices(
              components[componentIndex],
            ),
            details: buildGlobalDetails({
              component: components[componentIndex],
              targetIndex: index,
              remainingMines,
            }),
          });
        } else if (safePossible && !minePossible) {
          setResult(results, index, "safe", {
            kind: "global",
            text: `모든 숫자 조건과 보드에 남은 지뢰 ${remainingMines}개를 함께 계산하면, 가능한 모든 배치에서 이 칸은 안전합니다.`,
            relatedIndices: getComponentRelatedIndices(
              components[componentIndex],
            ),
            details: buildGlobalDetails({
              component: components[componentIndex],
              targetIndex: index,
              remainingMines,
            }),
          });
        }
      }
    }

    if (components.length === 0) {
      globallyFeasibleOffCounts.add(remainingMines);
    }

    if (offFrontier.length > 0 && globallyFeasibleOffCounts.size > 0) {
      const minePossible = [...globallyFeasibleOffCounts].some((count) => count > 0);
      const safePossible = [...globallyFeasibleOffCounts].some(
        (count) => count < offFrontier.length,
      );

      if (minePossible !== safePossible) {
        const status = minePossible ? "mine" : "safe";
        for (const index of offFrontier) {
          setResult(results, index, status, {
            kind: "global",
            text:
              status === "mine"
                ? `보드에 남은 지뢰 ${remainingMines}개를 배치할 수 있는 경우를 모두 계산하면, 숫자 영역 밖의 남은 칸은 모두 지뢰입니다.`
                : `보드에 남은 지뢰 ${remainingMines}개가 숫자와 연결된 영역에 모두 배정되므로, 이 칸은 안전합니다.`,
            relatedIndices: unique([
              ...components.flatMap(getComponentRelatedIndices),
              ...offFrontier,
            ]),
            details: buildGlobalDetails({
              components,
              candidateIndices: offFrontier,
              targetIndex: index,
              remainingMines,
            }),
          });
        }
      }
    }
  }

  function possibleSums(countGroups) {
    let sums = new Set([0]);

    for (const group of countGroups) {
      const next = new Set();
      for (const sum of sums) {
        for (const value of group) next.add(sum + value);
      }
      sums = next;
    }

    return sums;
  }

  function totalMineHits(models, variableOffset) {
    let hits = 0;
    for (const bucket of models.buckets.values()) {
      hits += bucket.mineHits[variableOffset];
    }
    return hits;
  }

  function explainLogicalDeduction(status, constraint, cellByIndex) {
    const sourceText = constraint.sourceIndices
      .slice(0, 3)
      .map((index) => {
        const cell = cellByIndex.get(index);
        return `${cell.row + 1}행 ${cell.col + 1}열의 숫자 ${cell.adjacent}`;
      })
      .join(", ");
    const areaLabel =
      constraint.kind === "difference"
        ? "의 미확인 영역을 부분집합·차집합으로 비교한 결과"
        : "에서 남은 지뢰 조건을 계산한 결과";

    if (status === "mine") {
      return `${sourceText}${areaLabel}, 이 칸이 포함된 ${constraint.cells.length}칸에 지뢰 ${constraint.mines}개가 필요합니다. 칸 수와 지뢰 수가 같아 확정 지뢰입니다.`;
    }

    return `${sourceText}${areaLabel}, 이 칸이 포함된 ${constraint.cells.length}칸에는 지뢰가 더 필요하지 않습니다. 따라서 확정 안전입니다.`;
  }

  function setLogicalStatus(
    statuses,
    index,
    status,
    reason,
    relatedIndices = [],
    details = null,
  ) {
    const existing = statuses.get(index);
    if (existing) return false;
    statuses.set(index, {
      status,
      reason,
      reasonKind: details?.kind ?? "number",
      relatedIndices,
      details,
    });
    return true;
  }

  function setResult(results, index, status, reason) {
    if (results.has(index)) return;
    results.set(index, {
      status,
      reason: reason.text,
      reasonKind: reason.kind,
      relatedIndices: reason.relatedIndices ?? [],
      details: reason.details ?? null,
    });
  }

  function buildLogicalDetails(status, constraint, cellByIndex, targetIndex) {
    const sourceLabels = constraint.sourceIndices.map((index) => {
      const cell = cellByIndex.get(index);
      return `${cell.row + 1}행 ${cell.col + 1}열의 숫자 ${cell.adjacent}`;
    });
    const technique =
      constraint.kind === "difference" ? "부분집합·차집합" : "직접 추론";
    const conclusion =
      status === "mine"
        ? "후보 칸 수와 필요한 지뢰 수가 같으므로 이 칸은 지뢰입니다."
        : "필요한 지뢰가 0개이므로 이 칸은 안전합니다.";

    return {
      kind: constraint.kind,
      technique,
      formula: `후보 ${constraint.cells.length}칸 · 필요한 지뢰 ${constraint.mines}개`,
      principle:
        constraint.kind === "difference"
          ? "겹치는 두 숫자 영역에서 작은 조건을 큰 조건에서 빼면 차이 영역의 지뢰 수를 알 수 있습니다."
          : "숫자 주변에 아직 필요한 지뢰 수를 닫힌 후보 칸 수와 비교합니다.",
      steps: [
        {
          text: `${sourceLabels.join(", ")}의 조건을 읽습니다.`,
          indices: constraint.sourceIndices,
        },
        {
          text: `${constraint.cells.length}개의 후보 칸에 지뢰 ${constraint.mines}개가 필요합니다.`,
          indices: constraint.cells,
        },
        {
          text: conclusion,
          indices: [targetIndex],
        },
      ],
    };
  }

  function buildModelDetails(component, models, targetIndex, mineHits) {
    const sourceIndices = unique(
      component.constraints.flatMap(
        (constraint) => constraint.sourceIndices,
      ),
    );
    const safeModels = models.solutions - mineHits;
    const targetOffset = component.variables.indexOf(targetIndex);
    const representativeAssignments = [
      models.mineExamples[targetOffset],
      models.safeExamples[targetOffset],
    ].filter(Boolean);
    const examples = unique(representativeAssignments).map((assignment) => ({
      label:
        assignment[targetOffset] === 1
          ? "선택 칸이 지뢰인 배치"
          : "선택 칸이 안전한 배치",
      mineIndices: component.variables.filter(
        (_, offset) => assignment[offset] === 1,
      ),
      safeIndices: component.variables.filter(
        (_, offset) => assignment[offset] === 0,
      ),
    }));

    return {
      kind: "models",
      technique: "가능한 배치 비교",
      formula: `전체 ${models.solutions}개 · 지뢰 ${mineHits}개 · 안전 ${safeModels}개`,
      examples,
      principle:
        "모든 숫자 조건을 만족하는 지뢰 배치를 만들고, 선택한 칸의 상태가 모든 배치에서 같은지 비교합니다.",
      steps: [
        {
          text: `${sourceIndices.length}개의 열린 숫자 조건을 함께 사용합니다.`,
          indices: sourceIndices,
        },
        {
          text: `연결된 후보 칸에서 가능한 배치 ${models.solutions}개를 찾았습니다.`,
          indices: component.variables,
        },
        {
          text: `선택한 칸은 지뢰인 배치 ${mineHits}개, 안전한 배치 ${safeModels}개에 포함됩니다.`,
          indices: [targetIndex],
        },
      ],
    };
  }

  function buildIncompleteDetails(component, targetIndex) {
    const sourceIndices = unique(
      component.constraints.flatMap(
        (constraint) => constraint.sourceIndices,
      ),
    );

    return {
      kind: "incomplete",
      technique: "분석 범위 초과",
      formula: `연결된 후보 ${component.variables.length}칸`,
      principle:
        "가능한 배치가 너무 많을 때는 잘못된 확정을 피하기 위해 판단 불가로 남깁니다.",
      steps: [
        {
          text: `${sourceIndices.length}개의 열린 숫자가 하나의 큰 영역으로 연결되어 있습니다.`,
          indices: sourceIndices,
        },
        {
          text: "빠른 분석 한도 안에서 모든 배치를 확인하지 못했습니다.",
          indices: component.variables,
        },
        {
          text: "현재 확인된 규칙만으로는 이 칸을 확정하지 않습니다.",
          indices: [targetIndex],
        },
      ],
    };
  }

  function buildGlobalDetails({
    component,
    components = component ? [component] : [],
    candidateIndices = component?.variables ?? [],
    targetIndex,
    remainingMines,
  }) {
    const sourceIndices = unique(
      components.flatMap((item) =>
        item.constraints.flatMap(
          (constraint) => constraint.sourceIndices,
        ),
      ),
    );

    return {
      kind: "global",
      technique: "전체 지뢰 수 계산",
      formula: `보드에 남은 지뢰 ${remainingMines}개`,
      principle:
        "각 숫자 영역의 가능한 지뢰 수와 보드 전체에 남은 지뢰 수를 함께 맞춥니다.",
      steps: [
        {
          text: `${sourceIndices.length}개의 열린 숫자 조건을 계산합니다.`,
          indices: sourceIndices,
        },
        {
          text: `보드 전체에 남은 지뢰 ${remainingMines}개가 배치될 수 있는 영역을 비교합니다.`,
          indices: candidateIndices,
        },
        {
          text: "전체 지뢰 수까지 만족하는 모든 경우에서 선택한 칸의 상태가 같습니다.",
          indices: [targetIndex],
        },
      ],
    };
  }

  function getComponentRelatedIndices(component) {
    return unique([
      ...component.variables,
      ...component.constraints.flatMap(
        (constraint) => constraint.sourceIndices,
      ),
    ]);
  }

  function getNeighborIndices(index, rows, cols) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const neighbors = [];

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        if (rowOffset === 0 && colOffset === 0) continue;
        const nextRow = row + rowOffset;
        const nextCol = col + colOffset;
        if (
          nextRow < 0 ||
          nextCol < 0 ||
          nextRow >= rows ||
          nextCol >= cols
        ) {
          continue;
        }
        neighbors.push(nextRow * cols + nextCol);
      }
    }

    return neighbors;
  }

  function constraintSignature(constraint) {
    return `${constraint.cells.join(",")}:${constraint.mines}`;
  }

  function isSubset(smaller, larger) {
    const largerSet = new Set(larger);
    return smaller.every((value) => largerSet.has(value));
  }

  function unique(values) {
    return [...new Set(values)];
  }

  return {
    analyze,
    __test: {
      solveConstraintClosure,
    },
  };
});
