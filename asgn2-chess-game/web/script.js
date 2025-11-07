// Chess piece Unicode symbols
const PIECES = {
  P: "♙",
  N: "♘",
  B: "♗",
  R: "♖",
  Q: "♕",
  K: "♔",
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

// Piece values for evaluation
const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

// Piece-Square Tables (simplified from document)
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30,
    20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5,
    -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0,
    0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30,
    5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20,
    20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20,
    -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10,
    10, 10, 10, 10, 10, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5, 10, 10,
    5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20,
    -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 5, 5, 0, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0,
    -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 5, 0, 0, 0, 0, -10, -10, 5, 5,
    5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 0,
    5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10,
    -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40,
    -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40,
    -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20,
    -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

const MATE_VALUE = 10000;
const CP_CLIP = 3000.0;

// ML Model
let mlModel = null;
let useMLEvaluation = false;

// Piece to index mapping for ML model
const PIECE_TO_INDEX = {
  p: 0,
  n: 1,
  b: 2,
  r: 3,
  q: 4,
  k: 5,
  P: 6,
  N: 7,
  B: 8,
  R: 9,
  Q: 10,
  K: 11,
};

const PIECE_VALUE_MAP = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

// Load ML model
async function loadMLModel() {
  try {
    status.textContent = "Loading ML model...";
    console.log("TensorFlow.js version:", tf.version.tfjs);
    console.log("Attempting to load model from tfjs_model/model.json");

    // Load the model
    mlModel = await tf.loadGraphModel("tfjs_model/model.json");

    console.log("Model loaded successfully");
    console.log("Model input shape:", mlModel.inputs[0].shape);
    console.log("Model output shape:", mlModel.outputs[0].shape);

    // Warm up the model with a dummy prediction
    console.log("Warming up model...");
    const dummyInput = tf.zeros([1, 8, 8, 14]);
    const dummyOutput = mlModel.predict(dummyInput);
    await dummyOutput.data(); // Wait for prediction to complete
    dummyInput.dispose();
    dummyOutput.dispose();

    useMLEvaluation = true;
    status.textContent = "ML model loaded successfully! Click Start to begin.";
    console.log("ML model ready for use");
  } catch (error) {
    console.error("Error loading ML model:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    status.textContent =
      "Using traditional evaluation (ML model failed to load)";
    useMLEvaluation = false;

    // Show user-friendly message
    const errorMsg = document.createElement("div");
    errorMsg.style.cssText =
      "padding: 10px; margin: 10px 0; border-radius: 5px; font-size: 0.9em;";
    errorMsg.innerHTML = `<strong>⚠️ Note:</strong> ML model could not be loaded. Using traditional evaluation instead.`;
    document
      .querySelector(".controls")
      .insertAdjacentElement("afterend", errorMsg);
  }
}

// Convert FEN to array for ML model
function fenToArray(fen) {
  const tempGame = new Chess(fen);
  const arr = new Array(8 * 8 * 14).fill(0);

  // Fill piece planes (12 channels)
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = String.fromCharCode(97 + file) + (rank + 1);
      const piece = tempGame.get(square);

      if (piece) {
        const r = 7 - rank;
        const c = file;
        const pieceSymbol =
          piece.color === "w"
            ? piece.type.toUpperCase()
            : piece.type.toLowerCase();
        const index = PIECE_TO_INDEX[pieceSymbol];
        arr[r * 8 * 14 + c * 14 + index] = 1.0;
      }
    }
  }

  // Channel 12: side to move (entire plane = 1 if white to move)
  if (tempGame.turn() === "w") {
    for (let i = 0; i < 64; i++) {
      arr[i * 14 + 12] = 1.0;
    }
  }

  // Channel 13: material balance
  let materialBalance = 0;
  const board = tempGame.board();
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j];
      if (piece) {
        const value = PIECE_VALUE_MAP[piece.type];
        materialBalance += piece.color === "w" ? value : -value;
      }
    }
  }
  materialBalance = materialBalance / 39.0; // normalize to [-1, 1]

  for (let i = 0; i < 64; i++) {
    arr[i * 14 + 13] = materialBalance;
  }

  return arr;
}

// Evaluate board using ML model
async function evaluateBoardML() {
  if (!mlModel) return evaluateBoard();

  if (game.game_over()) {
    if (game.in_checkmate()) {
      return game.turn() === "w" ? -MATE_VALUE : MATE_VALUE;
    }
    return 0;
  }

  try {
    const fen = game.fen();
    const inputArray = fenToArray(fen);

    // Reshape to (1, 8, 8, 14)
    const tensor = tf.tensor4d(inputArray, [1, 8, 8, 14]);

    // Get prediction
    const prediction = mlModel.predict(tensor);
    const normalizedScore = (await prediction.data())[0];

    // Clean up tensors
    tensor.dispose();
    prediction.dispose();

    // Convert from normalized [-1, 1] to centipawns
    const clippedScore = Math.max(-1.0, Math.min(1.0, normalizedScore));
    const cpScore = clippedScore * CP_CLIP;

    return Math.round(cpScore);
  } catch (error) {
    console.error("ML evaluation error:", error);
    return evaluateBoard();
  }
}

// Game state
let game = null;
let gameState = {
  aiColor: null,
  depth: 3,
  orientationWhite: true,
  selectedSquare: null,
  legalMoves: [],
  pendingPromotion: null,
};

// DOM elements
const board = document.getElementById("chessboard");
const status = document.getElementById("status");
const movesLog = document.getElementById("movesLog");
const startBtn = document.getElementById("startBtn");
const undoBtn = document.getElementById("undoBtn");
const flipBtn = document.getElementById("flipBtn");
const gameMode = document.getElementById("gameMode");
const playerColor = document.getElementById("playerColor");
const aiDepth = document.getElementById("aiDepth");
const promotionDialog = document.getElementById("promotionDialog");
const overlay = document.getElementById("overlay");

// Initialize board
function initBoard() {
  board.innerHTML = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement("div");
      square.className = "square " + ((row + col) % 2 === 0 ? "light" : "dark");
      square.dataset.row = row;
      square.dataset.col = col;
      square.addEventListener("click", handleSquareClick);
      board.appendChild(square);
    }
  }
}

// Convert board coordinates
function getSquareName(row, col) {
  const file = gameState.orientationWhite ? col : 7 - col;
  const rank = gameState.orientationWhite ? 7 - row : row;
  return String.fromCharCode(97 + file) + (rank + 1);
}

function getSquareCoords(squareName) {
  const file = squareName.charCodeAt(0) - 97;
  const rank = parseInt(squareName[1]) - 1;
  const col = gameState.orientationWhite ? file : 7 - file;
  const row = gameState.orientationWhite ? 7 - rank : rank;
  return { row, col };
}

// Render board
function renderBoard() {
  const squares = board.querySelectorAll(".square");
  squares.forEach((square) => {
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    const squareName = getSquareName(row, col);
    const piece = game.get(squareName);

    // Reset classes
    square.className = "square " + ((row + col) % 2 === 0 ? "light" : "dark");

    // Render piece with correct color
    if (piece) {
      const pieceSymbol =
        piece.color === "w"
          ? piece.type.toUpperCase()
          : piece.type.toLowerCase();
      square.textContent = PIECES[pieceSymbol] || "";
    } else {
      square.textContent = "";
    }

    // Highlight selected square
    if (gameState.selectedSquare === squareName) {
      square.classList.add("selected");
    }

    // Highlight legal moves
    const isLegalMove = gameState.legalMoves.some((m) => m.to === squareName);
    if (isLegalMove) {
      const move = gameState.legalMoves.find((m) => m.to === squareName);
      if (move.captured) {
        square.classList.add("capture");
      } else {
        square.classList.add("legal-move");
      }
    }
  });

  updateStatus();
}

// Update status display
function updateStatus() {
  if (game.game_over()) {
    if (game.in_checkmate()) {
      status.textContent = `Game Over - ${
        game.turn() === "w" ? "Black" : "White"
      } wins!`;
    } else if (game.in_draw()) {
      status.textContent = "Game Over - Draw";
    } else {
      status.textContent = "Game Over";
    }
    status.className = "status";
  } else {
    const turn = game.turn() === "w" ? "White" : "Black";
    const check = game.in_check() ? " - Check!" : "";
    status.textContent = `Turn: ${turn}${check}`;
    status.className = game.in_check() ? "status check" : "status";
  }
}

// Track AI thinking
gameState.aiThinking = false;

// Handle square click
function handleSquareClick(e) {
  if (!game || game.game_over()) return;
  if (gameState.pendingPromotion) return;

  // Prevent clicks during AI's move
  if (gameState.aiThinking) return;

  const square = e.currentTarget;
  const row = parseInt(square.dataset.row);
  const col = parseInt(square.dataset.col);
  const squareName = getSquareName(row, col);

  // Check if it's human's turn in AI mode
  if (gameState.aiColor !== null && game.turn() === gameState.aiColor) {
    return;
  }

  const piece = game.get(squareName);

  // First click - select piece
  if (gameState.selectedSquare === null) {
    if (piece && piece.color === game.turn()) {
      gameState.selectedSquare = squareName;
      gameState.legalMoves = game.moves({
        square: squareName,
        verbose: true,
      });
      renderBoard();
    }
  } else {
    // Second click - try to move
    if (squareName === gameState.selectedSquare) {
      // Deselect
      gameState.selectedSquare = null;
      gameState.legalMoves = [];
      renderBoard();
    } else if (piece && piece.color === game.turn()) {
      // Select different piece
      gameState.selectedSquare = squareName;
      gameState.legalMoves = game.moves({
        square: squareName,
        verbose: true,
      });
      renderBoard();
    } else {
      // Try to move
      const legalMove = gameState.legalMoves.find((m) => m.to === squareName);
      if (legalMove) {
        // Check for promotion
        if (legalMove.promotion) {
          gameState.pendingPromotion = {
            from: gameState.selectedSquare,
            to: squareName,
          };
          showPromotionDialog();
        } else {
          makeMove(gameState.selectedSquare, squareName);
        }
      }
    }
  }
}

// Make a move
function makeMove(from, to, promotion) {
  const move = game.move({ from, to, promotion });
  if (move) {
    gameState.selectedSquare = null;
    gameState.legalMoves = [];
    logMove(move, false);
    renderBoard();

    // AI response
    if (
      !game.game_over() &&
      gameState.aiColor !== null &&
      game.turn() === gameState.aiColor
    ) {
      gameState.aiThinking = true; // lock clicks
      setTimeout(() => {
        makeAIMove();
      }, 500);
    }
  }
}

// Show promotion dialog
function showPromotionDialog() {
  promotionDialog.classList.add("active");
  overlay.classList.add("active");

  const pieces = promotionDialog.querySelectorAll(".promotion-piece");
  pieces.forEach((piece) => {
    piece.onclick = () => {
      const promotion = piece.dataset.piece;
      promotionDialog.classList.remove("active");
      overlay.classList.remove("active");
      makeMove(
        gameState.pendingPromotion.from,
        gameState.pendingPromotion.to,
        promotion
      );
      gameState.pendingPromotion = null;
    };
  });
}

// Log move
function logMove(move, isAI) {
  const entry = document.createElement("div");
  entry.className = "move-entry" + (isAI ? " ai" : "");
  entry.textContent = `${isAI ? "AI" : "You"}: ${move.san}`;
  movesLog.appendChild(entry);
  movesLog.scrollTop = movesLog.scrollHeight;
}

// Evaluation function (simplified, based on material and position)
function evaluateBoard() {
  if (game.game_over()) {
    if (game.in_checkmate()) {
      return game.turn() === "w" ? -MATE_VALUE : MATE_VALUE;
    }
    return 0;
  }

  let score = 0;
  const board = game.board();

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j];
      if (piece) {
        const type = piece.type;
        const isWhite = piece.color === "w";
        const sq = i * 8 + j;
        const mirrorSq = (7 - i) * 8 + j;

        let value = PIECE_VALUES[type];
        if (PST[type]) {
          value += PST[type][isWhite ? sq : mirrorSq];
        }

        score += isWhite ? value : -value;
      }
    }
  }

  return score;
}

// Get evaluation (ML or traditional)
async function getEvaluation() {
  if (useMLEvaluation && mlModel) {
    return await evaluateBoardML();
  }
  return evaluateBoard();
}

// Minimax with alpha-beta pruning
async function minimax(depth, alpha, beta, maximizing) {
  if (depth === 0 || game.game_over()) {
    return await getEvaluation();
  }

  const moves = game.moves({ verbose: true });

  // Move ordering - captures first
  moves.sort((a, b) => {
    if (a.captured && !b.captured) return -1;
    if (!a.captured && b.captured) return 1;
    return 0;
  });

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = await minimax(depth - 1, alpha, beta, false);
      game.undo();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = await minimax(depth - 1, alpha, beta, true);
      game.undo();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

// Find best AI move
async function findBestMove() {
  const moves = game.moves({ verbose: true });
  let bestMove = null;
  let bestValue = gameState.aiColor === "w" ? -Infinity : Infinity;

  for (const move of moves) {
    game.move(move);
    const value = await minimax(
      gameState.depth - 1,
      -Infinity,
      Infinity,
      gameState.aiColor === "b"
    );
    game.undo();

    if (gameState.aiColor === "w" && value > bestValue) {
      bestValue = value;
      bestMove = move;
    } else if (gameState.aiColor === "b" && value < bestValue) {
      bestValue = value;
      bestMove = move;
    }
  }

  return bestMove;
}

// Make AI move
async function makeAIMove() {
  gameState.aiThinking = true; // Disable player interaction
  status.textContent = "AI is thinking...";
  const bestMove = await findBestMove();
  if (bestMove) {
    game.move(bestMove);
    logMove(bestMove, true);
    renderBoard();
  }

  gameState.aiThinking = false; // Re-enable after AI finishes
  status.textContent = `Turn: ${game.turn() === "w" ? "White" : "Black"}`;
}

// Start/Reset game
startBtn.addEventListener("click", () => {
  game = new Chess();
  gameState.depth = parseInt(aiDepth.value);
  gameState.selectedSquare = null;
  gameState.legalMoves = [];
  gameState.pendingPromotion = null;
  movesLog.innerHTML = "";

  if (gameMode.value === "ai") {
    gameState.aiColor = playerColor.value === "white" ? "b" : "w";
    gameState.orientationWhite = playerColor.value === "white";
  } else {
    gameState.aiColor = null;
    gameState.orientationWhite = true;
  }

  initBoard();
  renderBoard();

  // AI moves first if playing white
  if (gameState.aiColor === "w") {
    setTimeout(makeAIMove, 500);
  }
});

// Undo move
undoBtn.addEventListener("click", () => {
  if (!game) return;
  game.undo();
  if (gameState.aiColor !== null) {
    game.undo();
  }
  gameState.selectedSquare = null;
  gameState.legalMoves = [];
  renderBoard();

  // Remove last entries from log
  const entries = movesLog.querySelectorAll(".move-entry");
  if (entries.length > 0) {
    entries[entries.length - 1].remove();
    if (gameState.aiColor !== null && entries.length > 1) {
      entries[entries.length - 2].remove();
    }
  }
});

// Flip board
flipBtn.addEventListener("click", () => {
  if (!game) return;
  gameState.orientationWhite = !gameState.orientationWhite;
  initBoard();
  renderBoard();
});

// Game mode change
gameMode.addEventListener("change", (e) => {
  const isAI = e.target.value === "ai";
  document.getElementById("colorGroup").style.display = isAI ? "flex" : "none";
  document.getElementById("depthGroup").style.display = isAI ? "flex" : "none";
});

// Initialize
initBoard();
loadMLModel();
