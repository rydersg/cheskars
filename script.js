// Game Constants & State
const RED = 'r';
const WHITE = 'w';
const RED_KING = 'R';
const WHITE_KING = 'W';

let board = [];
let turn = RED; // Red starts (Player)
let selectedPiece = null; // {r, c}
let validMoves = []; // Array of move objects
let forcedJumpPiece = null; // Enforces multi-jump rules
let soundEnabled = true;
let isAnimating = false;

const statusEl = document.getElementById('status');
const redCountEl = document.getElementById('red-count');
const whiteCountEl = document.getElementById('white-count');
const boardEl = document.getElementById('board');
const restartBtn = document.getElementById('restart-btn');
const soundBtn = document.getElementById('sound-btn');

// Web Audio API Synthesizer for Sound Effects
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'jump') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'king') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.setValueAtTime(350, now + 0.1);
        osc.frequency.setValueAtTime(500, now + 0.2);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

// Initialize Game
function initGame() {
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Setup White (AI) pieces on rows 0, 1, 2
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 === 1) {
                board[r][c] = WHITE;
            }
        }
    }

    // Setup Red (Player) pieces on rows 5, 6, 7
    for (let r = 5; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 === 1) {
                board[r][c] = RED;
            }
        }
    }

    turn = RED;
    selectedPiece = null;
    validMoves = [];
    forcedJumpPiece = null;
    isAnimating = false;

    renderBoard();
    updateStatusText();
}

function updateStatusText() {
    if (turn === RED) {
        statusEl.textContent = "Your Turn (Red)";
    } else if (turn === WHITE) {
        statusEl.textContent = "AI is thinking...";
    }
}

// Render Board to HTML
function renderBoard() {
    boardEl.innerHTML = '';
    let redPieces = 0;
    let whitePieces = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((r + c) % 2 === 1 ? 'dark' : 'light');
            square.dataset.row = r;
            square.dataset.col = c;

            const piece = board[r][c];
            if (piece) {
                if (piece.toLowerCase() === RED) redPieces++;
                else whitePieces++;

                const pieceEl = document.createElement('div');
                pieceEl.classList.add('piece');
                if (piece === RED || piece === RED_KING) pieceEl.classList.add('red');
                else pieceEl.classList.add('white');

                if (piece === RED_KING || piece === WHITE_KING) {
                    pieceEl.classList.add('king');
                }
                square.appendChild(pieceEl);
            }

            // Highlight selected piece
            if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                square.classList.add('selected');
            }

            // Highlight valid destination moves
            const isValidDest = validMoves.some(m => m.toR === r && m.toC === c);
            if (isValidDest) {
                square.classList.add('highlight');
            }

            square.addEventListener('click', () => handleSquareClick(r, c));
            boardEl.appendChild(square);
        }
    }

    redCountEl.textContent = redPieces;
    whiteCountEl.textContent = whitePieces;

    checkGameOver(redPieces, whitePieces);
}

// Check if game is over
function checkGameOver(redCount, whiteCount) {
    if (redCount === 0) {
        statusEl.textContent = "White (AI) Wins!";
        disableGame();
    } else if (whiteCount === 0) {
        statusEl.textContent = "Red (You) Win!";
        disableGame();
    } else {
        const allMoves = getAllPossibleMoves(board, turn);
        if (allMoves.length === 0) {
            statusEl.textContent = turn === RED ? "Red has no moves. White (AI) Wins!" : "White has no moves. Red (You) Win!";
            disableGame();
        }
    }
}

function disableGame() {
    turn = null;
}

// Get all legal moves for a given player/board state
function getAllPossibleMoves(currentBoard, player) {
    let jumps = [];
    let regularMoves = [];

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = currentBoard[r][c];
            if (piece && isPlayerPiece(piece, player)) {
                if (forcedJumpPiece && (forcedJumpPiece.r !== r || forcedJumpPiece.c !== c)) {
                    continue;
                }

                const pieceMoves = getMovesForPiece(currentBoard, r, c);
                jumps.push(...pieceMoves.jumps);
                regularMoves.push(...pieceMoves.regular);
            }
        }
    }

    if (jumps.length > 0) return jumps;
    return regularMoves;
}

// Get valid moves for a single piece
function getMovesForPiece(currentBoard, r, c) {
    const piece = currentBoard[r][c];
    const isKing = piece === RED_KING || piece === WHITE_KING;
    const isRed = piece === RED || piece === RED_KING;

    let directions = [];
    if (isRed || isKing) directions.push(-1);
    if (!isRed || isKing) directions.push(1);

    let jumps = [];
    let regular = [];

    directions.forEach(dr => {
        [-1, 1].forEach(dc => {
            let tR = r + dr;
            let tC = c + dc;
            if (isValidCoord(tR, tC) && currentBoard[tR][tC] === null) {
                regular.push({ fromR: r, fromC: c, toR: tR, toC: tC, jumped: null });
            }

            let jR = r + (dr * 2);
            let jC = c + (dc * 2);
            let midR = r + dr;
            let midC = c + dc;
            if (isValidCoord(jR, jC) && currentBoard[jR][jC] === null) {
                let midPiece = currentBoard[midR][midC];
                if (midPiece !== null && !isPlayerPiece(midPiece, isRed ? RED : WHITE)) {
                    jumps.push({ 
                        fromR: r, 
                        fromC: c, 
                        toR: jR, 
                        toC: jC, 
                        jumped: { r: midR, c: midC } 
                    });
                }
            }
        });
    });

    return { jumps, regular };
}

function isPlayerPiece(piece, player) {
    if (player === RED) return piece === RED || piece === RED_KING;
    if (player === WHITE) return piece === WHITE || piece === WHITE_KING;
    return false;
}

function isValidCoord(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
}

// Handle square click interaction
function handleSquareClick(r, c) {
    if (turn !== RED || isAnimating) return;

    const piece = board[r][c];

    if (piece && isPlayerPiece(piece, RED)) {
        if (forcedJumpPiece && (forcedJumpPiece.r !== r || forcedJumpPiece.c !== c)) {
            return;
        }

        const allMoves = getAllPossibleMoves(board, RED);
        const pieceMoves = allMoves.filter(m => m.fromR === r && m.fromC === c);

        if (pieceMoves.length > 0) {
            selectedPiece = { r, c };
            validMoves = pieceMoves;
            renderBoard();
        }
        return;
    }

    if (selectedPiece) {
        const targetMove = validMoves.find(m => m.toR === r && m.toC === c);
        if (targetMove) {
            executeMove(targetMove);
        }
    }
}

// Smooth Visual Animation Function
function animateMove(move, callback) {
    isAnimating = true;
    const squareWidth = boardEl.clientWidth / 8;
    const squareHeight = boardEl.clientHeight / 8;

    // Find origin piece element from DOM
    const originSquare = boardEl.children[move.fromR * 8 + move.fromC];
    const pieceEl = originSquare.querySelector('.piece');

    if (!pieceEl) {
        // Fallback if DOM element missing
        callback();
        return;
    }

    // Temporarily clone or extract element to float over board
    const clone = pieceEl.cloneNode(true);
    originSquare.innerHTML = ''; // Clear source square visually for animation
    
    clone.classList.add('animating');
    clone.style.width = `${squareWidth * 0.75}px`;
    clone.style.height = `${squareHeight * 0.75}px`;
    
    // Initial absolute offset
    const startX = move.fromC * squareWidth + (squareWidth * 0.125);
    const startY = move.fromR * squareHeight + (squareHeight * 0.125);
    const targetX = move.toC * squareWidth + (squareWidth * 0.125);
    const targetY = move.toR * squareHeight + (squareHeight * 0.125);

    clone.style.left = `${startX}px`;
    clone.style.top = `${startY}px`;
    boardEl.appendChild(clone);

    // Force reflow
    clone.getBoundingClientRect();

    // Trigger transform translation
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;
    clone.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    setTimeout(() => {
        clone.remove();
        isAnimating = false;
        callback();
    }, 250); // Matches transition time in CSS
}

// Execute move with animation and audio triggers
function executeMove(move) {
    let piece = board[move.fromR][move.fromC];
    let isJump = move.jumped !== null;
    let becomesKing = false;

    // Check if promotion will happen
    if (piece === RED && move.toR === 0) becomesKing = true;
    else if (piece === WHITE && move.toR === 7) becomesKing = true;

    // Play sound ahead or during animation
    if (isJump) {
        playSound('jump');
    } else {
        playSound('move');
    }

    animateMove(move, () => {
        // Perform actual logical board updates after animation finishes
        board[move.fromR][move.fromC] = null;
        board[move.toR][move.toC] = piece;

        if (isJump) {
            board[move.jumped.r][move.jumped.c] = null;
        }

        if (becomesKing) {
            if (piece === RED) {
                board[move.toR][move.toC] = RED_KING;
                piece = RED_KING;
            } else {
                board[move.toR][move.toC] = WHITE_KING;
                piece = WHITE_KING;
            }
            playSound('king');
        }

        // Check for multi-jump opportunity
        if (isJump) {
            const nextMoves = getMovesForPiece(board, move.toR, move.toC);
            if (nextMoves.jumps.length > 0) {
                forcedJumpPiece = { r: move.toR, c: move.toC };
                selectedPiece = forcedJumpPiece;
                validMoves = nextMoves.jumps;
                renderBoard();
                return;
            }
        }

        // Reset state & switch turns
        forcedJumpPiece = null;
        selectedPiece = null;
        validMoves = [];

        if (turn === RED) {
            turn = WHITE;
            updateStatusText();
            renderBoard();
            setTimeout(aiTurn, 400);
        } else {
            turn = RED;
            updateStatusText();
            renderBoard();
        }
    });
}

// --- AI Logic ---
function aiTurn() {
    if (turn !== WHITE) return;

    const bestMove = findBestMove(board, 4);
    if (bestMove) {
        executeMove(bestMove);
    }
}

function evaluateBoard(currentBoard) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = currentBoard[r][c];
            if (p === WHITE) score += 10;
            else if (p === WHITE_KING) score += 18;
            else if (p === RED) score -= 10;
            else if (p === RED_KING) score -= 18;
        }
    }
    return score;
}

function findBestMove(currentBoard, depth) {
    const allMoves = getAllPossibleMoves(currentBoard, WHITE);
    if (allMoves.length === 0) return null;

    let bestScore = -Infinity;
    let bestMoves = [];

    for (let move of allMoves) {
        const simulatedBoard = cloneBoard(currentBoard);
        applyMoveSimulation(simulatedBoard, move);
        
        let score = minimax(simulatedBoard, depth - 1, false, -Infinity, Infinity);
        if (score > bestScore) {
            bestScore = score;
            bestMoves = [move];
        } else if (score === bestScore) {
            bestMoves.push(move);
        }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function minimax(currentBoard, depth, isMaximizing, alpha, beta) {
    const player = isMaximizing ? WHITE : RED;
    const allMoves = getAllPossibleMoves(currentBoard, player);

    if (depth === 0 || allMoves.length === 0) {
        return evaluateBoard(currentBoard);
    }

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (let move of allMoves) {
            const simulatedBoard = cloneBoard(currentBoard);
            applyMoveSimulation(simulatedBoard, move);
            let evaluation = minimax(simulatedBoard, depth - 1, false, alpha, beta);
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let move of allMoves) {
            const simulatedBoard = cloneBoard(currentBoard);
            applyMoveSimulation(simulatedBoard, move);
            let evaluation = minimax(simulatedBoard, depth - 1, true, alpha, beta);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function cloneBoard(currentBoard) {
    return currentBoard.map(row => [...row]);
}

function applyMoveSimulation(currentBoard, move) {
    let piece = currentBoard[move.fromR][move.fromC];
    currentBoard[move.fromR][move.fromC] = null;
    currentBoard[move.toR][move.toC] = piece;

    if (move.jumped) {
        currentBoard[move.jumped.r][move.jumped.c] = null;
    }

    if (piece === RED && move.toR === 0) currentBoard[move.toR][move.toC] = RED_KING;
    if (piece === WHITE && move.toR === 7) currentBoard[move.toR][move.toC] = WHITE_KING;
}

// Button Event Listeners
restartBtn.addEventListener('click', initGame);

soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = `Sound: ${soundEnabled ? 'ON' : 'OFF'}`;
});

// Run the game on load
initGame();
