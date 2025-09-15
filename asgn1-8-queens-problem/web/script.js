/* ================ size and canvas config ================ */
// logical board
const N = 8;
const CELL = 60;
const PADDING = 12;
const LOGICAL_SIZE = PADDING * 2 + CELL * N; // 504 drawing units

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const boardWrap = document.getElementById('boardWrap');

let scale = 1; // logical -> CSS pixels

// load image
const queenImg = new Image();
queenImg.src = "queen.png";

let queenReady = false;
queenImg.onload = () => {
    queenReady = true;
    draw(); // repaint once the image is ready
};

// helper to draw a queen centered at (x, y)
function paintQueen(ctx, x, y) {
    const size = CELL - 10; // slight padding inside the square
    if (queenReady && queenImg.complete && queenImg.naturalWidth > 0) {
        ctx.drawImage(queenImg, x - size / 2, y - size / 2, size, size);
    } else {
        // fallback glyph until the image loads
        ctx.fillText("♛", x, y);
    }
}

function getBoardMaxCss() {
    // returns the numeric px value of --board-max
    const v = getComputedStyle(document.documentElement).getPropertyValue('--board-max').trim();
    return parseFloat(v || '720'); // fallback
}

function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const maxCss = getBoardMaxCss();
    const wrapW = Math.min(boardWrap.clientWidth, maxCss);
    const cssSize = Math.max(0, wrapW - 4); // 4 for borders
    canvas.style.width = cssSize + 'px';
    canvas.style.height = cssSize + 'px';
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    // scale from logical to CSS pixels
    const cssToLogical = cssSize / LOGICAL_SIZE;
    scale = cssToLogical * dpr;
    draw();
}

/* ================ UI elements ================ */
const btnBack = document.getElementById('btnBack');
const btnNext = document.getElementById('btnNext');
const btnPlay = document.getElementById('btnPlay');
const btnClear = document.getElementById('btnClear');
const btnRun = document.getElementById('btnRun');
const btnRestart = document.getElementById('btnRestart');
const btnCheck = document.getElementById('btnCheck');
const speed = document.getElementById('speed');
const speedLabel = document.getElementById('speedLabel');
const info = document.getElementById('info');
const subinfo = document.getElementById('subinfo');
const checkMsg = document.getElementById('checkMsg');
const statePanel = document.getElementById('statePanel');
const radioAStar = document.getElementById('solver-astar');
const radioBack = document.getElementById('solver-back');
const toggleTrace = document.getElementById('toggleTrace');

/* ================ state ================ */
let mode = 'edit'; // 'edit' or 'play'
let userState = Array(N).fill(-1);
let steps = [];
let stepIdx = 0;
let playing = false;
let timer = null;
let conflictRows = new Set();

/* ================ helpers ================ */
const clone = a => a.slice();

function attackingPairs(state) {
    let p = 0;
    for (let row1 = 0; row1 < N; row1++) {
        const col1 = state[row1]; if (col1 < 0) continue;
        for (let row2 = row1 + 1; row2 < N; row2++) {
            const col2 = state[row2]; if (col2 < 0) continue;
            if (col1 === col2 || Math.abs(row1 - row2) === Math.abs(col1 - col2)) p++;
        }
    }
    return p;
}
function isSafeAt(board, row, col) {
    if (col === -1) return false;
    for (let r = 0; r < N; r++) {
        const c = board[r];
        if (r === row) continue;
        if (c === -1) continue;
        if (c === col) return false;
        if (Math.abs(row - r) === Math.abs(col - c)) return false;
    }
    return true;
}
function conflictRowSet(state) {
    const rows = new Set();
    for (let row1 = 0; row1 < N; row1++) {
        const col1 = state[row1]; if (col1 < 0) continue;
        for (let row2 = row1 + 1; row2 < N; row2++) {
            const col2 = state[row2]; if (col2 < 0) continue;
            if (col1 === col2 || Math.abs(row1 - row2) === Math.abs(col1 - col2)) { rows.add(row1); rows.add(row2); }
        }
    }
    return rows;
}

/* ================ A* ================ */
function aStar(start) {
    const startCopy = clone(start);
    const g0 = startCopy.filter(v => v >= 0).length;
    const h0 = attackingPairs(startCopy);
    const open = [{ state: startCopy, g: g0, h: h0, f: g0 + h0, parent: null }];
    const seen = new Map();
    const key = s => s.join(',');
    const nextEmptyRow = s => { for (let r = 0; r < N; r++) if (s[r] === -1) return r; return N; };

    while (open.length) {
        open.sort((a, b) => a.f - b.f);
        const cur = open.shift();
        const k = key(cur.state);
        if (seen.has(k) && seen.get(k) < cur.f) continue;
        seen.set(k, cur.f);

        if (cur.state.every(v => v >= 0) && attackingPairs(cur.state) === 0) {
            const path = []; let t = cur;
            while (t) { path.push(t.state); t = t.parent; }
            return path.reverse();
        }

        const row = nextEmptyRow(cur.state);
        if (row >= N) continue;

        for (let col = 0; col < N; col++) {
            if (start[row] !== -1 && col !== start[row]) continue;
            const s2 = clone(cur.state); s2[row] = col;
            if (!isSafeAt(s2, row, col)) continue;
            const g2 = cur.g + 1, h2 = attackingPairs(s2), f2 = g2 + h2, k2 = key(s2);
            if (!seen.has(k2) || f2 < seen.get(k2)) open.push({ state: s2, g: g2, h: h2, f: f2, parent: cur });
        }
    }
    return [];
}
function stepsFromAStar(start) {
    const path = aStar(start);
    if (!path.length) return [{ type: 'error', state: clone(start), row: -1, col: -1, h: attackingPairs(start) }];
    const shown = clone(path[0]), out = [];
    out.push({ type: 'start', state: clone(shown), row: -1, col: -1, h: attackingPairs(path[0]) });
    for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1], cur = path[i];
        for (let r = 0; r < N; r++) if (prev[r] !== cur[r]) {
            shown[r] = cur[r];
            out.push({ type: 'move', state: clone(shown), row: r, col: cur[r], h: attackingPairs(cur) });
        }
    }
    out.push({ type: 'done', state: clone(shown), row: -1, col: -1, h: 0 });
    return out;
}
function stepsFromAStarPerCell(start) {
    const path = aStar(start);
    if (!path.length) return [{ type: 'error', state: clone(start), row: -1, col: -1, h: attackingPairs(start) }];
    const shown = clone(path[0]), out = [];
    out.push({ type: 'start', state: clone(shown), row: -1, col: -1, h: attackingPairs(path[0]) });
    for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1], cur = path[i];
        for (let r = 0; r < N; r++) if (prev[r] !== cur[r]) {
            const target = cur[r];
            for (let c = 0; c < N; c++) {
                const temp = clone(shown); temp[r] = c;
                out.push({ type: 'discover', state: temp, row: r, col: c, h: attackingPairs(cur), g: null, f: null });
            }
            shown[r] = target;
            out.push({ type: 'expand', state: clone(shown), row: r, col: target, h: attackingPairs(cur), g: null, f: null });
        }
    }
    out.push({ type: 'done', state: clone(shown), row: -1, col: -1, h: 0 });
    return out;
}

/* ================ Backtracking ================ */
function stepsFromBacktracking(start) {
    const n = start.length;
    const board = clone(start);
    const out = [];

    const nextEmpty = from => { for (let r = from; r < n; r++) if (board[r] === -1) return r; return n; };
    function isSafe(rows, cols) {
        if (cols === -1) return false;
        for (let r = 0; r < n; r++) {
            const c = board[r];
            if (r === rows) continue;
            if (c === -1) continue;
            if (c === cols) return false;
            if (Math.abs(rows - r) === Math.abs(cols - c)) return false;
        }
        return true;
    }

    // validate pre-placed queens
    for (let r = 0; r < n; r++) {
        const c = board[r];
        if (c !== -1 && !isSafe(r, c)) {
            out.push({ type: 'error', state: clone(board), row: r, col: c, h: attackingPairs(board) });
            return out;
        }
    }

    out.push({ type: 'start', state: clone(board), row: -1, col: -1, h: attackingPairs(board) });

    function placeFrom(rowIndex) {
        const row = nextEmpty(rowIndex);
        if (row >= n) { out.push({ type: 'done', state: clone(board), row: -1, col: -1, h: 0 }); return true; }
        for (let col = 0; col < n; col++) {
            if (start[row] !== -1 && col !== start[row]) continue;
            out.push({ type: 'try', state: clone(board), row, col, h: attackingPairs(board) });
            if (isSafe(row, col)) {
                board[row] = col;
                out.push({ type: 'place', state: clone(board), row, col, h: attackingPairs(board) });
                if (placeFrom(row + 1)) return true;
                board[row] = -1;
                out.push({ type: 'backtrack', state: clone(board), row, col, h: attackingPairs(board) });
            } else {
                out.push({ type: 'conflict', state: clone(board), row, col, h: attackingPairs(board) });
            }
        }
        return false;
    }

    placeFrom(0);
    return out;
}
function stepsFromBacktrackingCompact(start) {
    const v = stepsFromBacktracking(start);
    if (!v.length) return v;
    const out = [v[0]];
    for (let i = 1; i < v.length; i++) {
        const t = v[i].type;
        if (t === 'place' || t === 'backtrack' || t === 'done' || t === 'error') out.push(v[i]);
    }
    return out;
}

/* ================ state panel render ================ */
function renderStateSidebar(boardState, activeRow) {
    let html = '<pre>';
    for (let r = 0; r < N; r++) {
        const v = boardState[r];
        const value = (v >= 0) ? String(v) : '·';
        const cls = (activeRow === r) ? 'rowline active' : 'rowline';
        const valCls = (v >= 0) ? '' : 'unset';
        html += `<div class="${cls}"><span>queens[${r}]:</span> <span class="${valCls}">${value}</span></div>`;
    }
    html += '</pre>';
    statePanel.innerHTML = html;
}

/* ================ draw ================ */
function draw() {
    // draw in logical units scaled to device pixels
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

    let boardState, activeRow, activeCol, actionType;
    if (mode === 'edit') {
        boardState = userState;
        activeRow = -1;
        activeCol = -1;
        actionType = 'edit';
    } else {
        const s = steps[stepIdx];
        boardState = s.state;
        activeRow = s.row;
        activeCol = s.col;
        actionType = s.type;
    }

    // board squares
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const x = PADDING + c * CELL;
            const y = PADDING + r * CELL;
            ctx.fillStyle = ((r + c) % 2 === 0) ? '#f9dcdcff' : '#888686ff';
            ctx.fillRect(x, y, CELL, CELL);
        }
    }

    // active row
    if (mode === 'play' && activeRow >= 0 && activeRow < N) {
        const y0 = PADDING + activeRow * CELL;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#f982cfff';
        ctx.fillRect(PADDING, y0, N * CELL, CELL);
        ctx.restore();
    }

    // marker for try/conflict/discover/expand
    const markerTypes = new Set(['try', 'conflict', 'discover', 'expand']);
    let skipCell = null;
    if (mode === 'play' && activeRow >= 0 && activeCol >= 0 && markerTypes.has(actionType)) {
        if (actionType === 'discover') skipCell = `${activeRow},${activeCol}`;
        const x = PADDING + activeCol * CELL + CELL / 2;
        const y = PADDING + activeRow * CELL + CELL / 2;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '36px serif'; // for fallback glyph
        ctx.fillStyle = '#111';
        paintQueen(ctx, x, y); // use helper
        ctx.restore();
    }

    // queens
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '36px serif'; // for fallback glyph
    ctx.fillStyle = '#111';
    for (let r = 0; r < N; r++) {
        const c = boardState[r];
        if (c >= 0 && `${r},${c}` !== skipCell) {
            const x = PADDING + c * CELL + CELL / 2;
            const y = PADDING + r * CELL + CELL / 2;
            paintQueen(ctx, x, y); // use helper
        }
    }
    ctx.restore();

    // red square outline around conflicting queens in Edit mode
    if (mode === 'edit' && conflictRows.size) {
        ctx.save();
        ctx.strokeStyle = '#c9145cff';
        ctx.lineWidth = 3;
        for (const r of conflictRows) {
            const c = userState[r];
            if (c >= 0) {
                const x0 = PADDING + c * CELL;
                const y0 = PADDING + r * CELL;
                ctx.strokeRect(x0 + 1.5, y0 + 1.5, CELL - 3, CELL - 3);
            }
        }
        ctx.restore();
    }


    // info and buttons 
    if (mode === 'edit') {
        const placed = userState.filter(v => v >= 0).length;
        info.textContent = `Edit mode – ${placed}/${N} queens placed.`;
        subinfo.innerHTML = `
            <p><strong>Edit mode:</strong></p> 
            <p>Click on the board to place queens, one per row.</p>
            <p>Queens attack if they share a column or a diagonal.</p>
            <p><strong>Play mode:</strong></p>
            <p>Click Run to let the computer solve the puzzle using the method you select, either A* or Backtracking.</p>
    `;
        btnBack.disabled = true; btnNext.disabled = true; btnPlay.disabled = true; btnRun.disabled = false;
    } else {
        const labels = {
            start: 'Start', discover: 'Discover', expand: 'Expand', move: 'Move',
            try: 'Try', conflict: 'Conflict', backtrack: 'Backtrack', done: 'Done', error: 'Error'
        };
        const g = steps[stepIdx].g, h = steps[stepIdx].h, f = steps[stepIdx].f;
        const extra = (f != null) ? `   f=${f} g=${g} h=${h}` : ((h != null) ? `   h=${h}` : '');
        info.textContent = `Step ${stepIdx + 1}/${steps.length}   Action: ${labels[actionType] || actionType}` +
            `   at row ${activeRow}, col ${activeCol}   State: [${boardState.join(', ')}]${extra}`;
        subinfo.textContent = '';
        btnBack.disabled = stepIdx === 0; btnNext.disabled = stepIdx >= steps.length - 1; btnPlay.disabled = false; btnRun.disabled = true;
    }

    // state panel
    renderStateSidebar(boardState, (mode === 'play') ? activeRow : -1);
}


/* ================ interactions ================ */
// clicks in edit mode, map CSS to logical
canvas.addEventListener('click', e => {
    if (mode !== 'edit') return;
    const rect = canvas.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;
    const x = xCss * (LOGICAL_SIZE / canvas.clientWidth);
    const y = yCss * (LOGICAL_SIZE / canvas.clientHeight);
    const col = Math.floor((x - PADDING) / CELL);
    const row = Math.floor((y - PADDING) / CELL);
    if (row < 0 || col < 0 || row >= N || col >= N) return;
    userState[row] = (userState[row] === col) ? -1 : col;
    conflictRows.clear();
    draw();
});

function stopTimer() { if (timer) { clearTimeout(timer); timer = null; } }
btnClear.addEventListener('click', () => { mode = 'edit'; userState = Array(N).fill(-1); stopTimer(); stepIdx = 0; playing = false; conflictRows.clear(); draw(); });
btnRun.addEventListener('click', () => {
    conflictRows.clear();
    const s = clone(userState);
    steps = radioAStar.checked
        ? (toggleTrace.checked ? stepsFromAStarPerCell(s) : stepsFromAStar(s))
        : (toggleTrace.checked ? stepsFromBacktracking(s) : stepsFromBacktrackingCompact(s));
    mode = 'play'; stepIdx = 0; playing = false; btnPlay.textContent = 'Play'; draw();
});
btnRestart.addEventListener('click', () => { stopTimer(); mode = 'edit'; stepIdx = 0; playing = false; btnPlay.textContent = 'Play'; conflictRows.clear(); draw(); });
btnBack.addEventListener('click', () => { if (mode !== 'play') return; stopTimer(); if (stepIdx > 0) { stepIdx--; draw(); } });
btnNext.addEventListener('click', () => { if (mode !== 'play') return; stopTimer(); if (stepIdx < steps.length - 1) { stepIdx++; draw(); } });
btnPlay.addEventListener('click', () => {
    if (mode !== 'play') return;
    playing = !playing; btnPlay.textContent = playing ? 'Pause' : 'Play';
    if (playing) (function tick() {
        if (!playing || mode !== 'play') return;
        if (stepIdx < steps.length - 1) { stepIdx++; draw(); timer = setTimeout(tick, parseInt(speed.value, 10)); } else { playing = false; btnPlay.textContent = 'Play'; }
    })();
});
speed.addEventListener('input', () => { speedLabel.textContent = `${speed.value} ms`; });
radioAStar.addEventListener('change', draw);
radioBack.addEventListener('change', draw);
toggleTrace.addEventListener('change', draw);

// Check Answer
btnCheck.addEventListener('click', () => {
    if (mode !== 'edit') { checkMsg.textContent = 'You can check only in Edit mode.'; return; }
    const missing = userState.filter(v => v < 0).length;
    if (missing > 0) { conflictRows.clear(); checkMsg.textContent = `Place one queen in every row first. Missing rows ${missing}.`; draw(); return; }
    const conflicts = attackingPairs(userState);
    if (conflicts === 0) { conflictRows.clear(); checkMsg.textContent = 'Nice, no queens attack each other.'; }
    else { conflictRows = conflictRowSet(userState); checkMsg.textContent = `${conflicts} attacking pair(s) detected. Conflicting rows are highlighted.`; }
    draw();
});

// responsive sizing
window.addEventListener('resize', fitCanvas);
fitCanvas(); // initial size + first draw
