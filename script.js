// Game Constants & State
const WHITE = 'w'; // Player (Starts at bottom like reference)
const BLACK = 'b'; // AI (Starts at top)
const WHITE_KING = 'W';
const BLACK_KING = 'B';

let board = [];
let turn = WHITE; 
let selectedPiece = null; 
let validMoves = []; 
let forcedJumpPiece = null; 
let soundEnabled = true;
let isAnimating = false;

const statusEl = document.getElementById('status');
const whiteCountEl = document.getElementById('white-count');
const blackCountEl = document.getElementById('black-count');
const boardEl = document.getElementById('board');
const restartBtn = document.getElementById('restart-btn');
const soundBtn = document.getElementById('sound-btn');

// Web Audio API Sound Synthesizer
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
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.1);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'jump') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.15);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'king') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.setValueAtTime(380, now + 0.1);
        osc.frequency.setValueAtTime(520, now + 0.2);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

// Initialize Standard Checkers Setup
function initGame() {
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Black (AI) pieces placed on rows 0, 1, 2
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 === 1) {
                board[r][c] = BLACK;
            }
        }
    }

    // White (Player) pieces placed on rows 5, 6, 7
    for (let r = 5; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 === 1) {
                board[r][c] = WHITE;
            }
        }
    }

    turn = WHITE;
    selectedPiece = null;
    validMoves = [];
    forcedJumpPiece = null;
    isAnimating = false;

    renderBoard();
    updateStatusText();
}

function updateStatusText() {
    if (turn === WHITE) {
        statusEl.textContent = "Your Turn (White)";
    } else if (turn === BLACK) {
        statusEl.textContent = "AI (Black) is thinking...";
    }
}

// Render Board & Pieces
function renderBoard() {
    boardEl.innerHTML = '';
    let whitePieces = 0;
    let blackPieces = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((r + c) % 2 === 1 ? 'dark' : 'light');
            square.dataset.row = r;
            square.dataset.col = c;

            const piece = board[r][c];
            if (piece) {
                if (piece.toLowerCase() === WHITE) whitePieces++;
                else blackPieces++;

                const pieceEl = document.createElement('div');
                pieceEl.classList.add('piece');
                if (piece === WHITE || piece === WHITE_KING) pieceEl.classList.add('white');
                else pieceEl.classList.add('black');

                if (piece === WHITE_KING || piece === BLACK_KING) {
                    pieceEl.classList.add('king');
                    const crown = document.createElement('span');
                    crown.textContent = '👑';
                    pieceEl.appendChild(crown);
                }
                square.appendChild(pieceEl);
            }

            if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                square.classList.add('selected');
            }

            const isValidDest = validMoves.some(m => m.toR === r && m.toC === c);
            if (isValidDest) {
                square.classList.add('highlight');
            }

            square.addEventListener('click', () => handleSquareClick(r, c));
            boardEl.appendChild(square);
        }
    }

    whiteCountEl.textContent = whitePieces;
    blackCountEl.textContent = blackPieces;

    checkGameOver(whitePieces, blackPieces);
}

function checkGameOver(whiteCount, blackCount) {
    if (whiteCount === 0) {
        statusEl.textContent = "Black (AI) Wins!";
        disableGame();
    } else if (blackCount === 0) {
        statusEl.textContent = "White (You) Win!";
        disableGame();
    } else {
        const allMoves = getAllPossibleMoves(board, turn);
        if (allMoves.length === 0) {
            statusEl.textContent = turn === WHITE ? "White has no moves. Black (AI) Wins!" : "Black has no moves. White (You) Win!";
            disableGame();
        }
    }
}

function disableGame() {
    turn = null;
}

// Move Rules Calculations
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

function getMovesForPiece(currentBoard, r, c) {
    const piece = currentBoard[r][c];
    const isKing = piece === WHITE_KING || piece === BLACK_KING;
    const isWhite = piece === WHITE || piece === WHITE_KING;

    let directions = [];
    if (isWhite || isKing) directions.push(-1); // Up
    if (!isWhite || isKing) directions.push(1);  // Down

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
                if (midPiece !== null && !isPlayerPiece(midPiece, isWhite ? WHITE : BLACK)) {
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
    if (player === WHITE) return piece === WHITE || piece === WHITE_KING;
    if (player === BLACK) return piece === BLACK || piece === BLACK_KING;
    return false;
}

function isValidCoord(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
}

// User Interaction Handling
function handleSquareClick(r, c) {
    if (turn !== WHITE || isAnimating) return;

    const piece = board[r][c];

    if (piece && isPlayerPiece(piece, WHITE)) {
        if (forcedJumpPiece && (forcedJumpPiece.r !== r || forcedJumpPiece.c !== c)) {
            return;
        }

        const allMoves = getAllPossibleMoves(board, WHITE);
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

// Smooth Animation Engine
function animateMove(move, callback) {
    isAnimating = true;
    const squareWidth = boardEl.clientWidth / 8;
    const squareHeight = boardEl.clientHeight / 8;

    const originSquare = boardEl.children[move.fromR * 8 + move.fromC];
    const pieceEl = originSquare.querySelector('.piece');

    if (!pieceEl) {
        callback();
        return;
    }

    const clone = pieceEl.cloneNode(true);
    originSquare.innerHTML = ''; 
    
    clone.classList.add('animating');
    clone.style.width = `${squareWidth * 0.78}px`;
    clone.style.height = `${squareHeight * 0.78}px`;
    
    const startX = move.fromC * squareWidth + (squareWidth * 0.11);
    const startY = move.fromR * squareHeight + (squareHeight * 0.11);
    const targetX = move.toC * squareWidth + (squareWidth * 0.11);
    const targetY = move.toR * squareHeight + (squareHeight * 0.11);

    clone.style.left = `${startX}px`;
    clone.style.top = `${startY}px`;
    boardEl.appendChild(clone);

    clone.getBoundingClientRect();

    const deltaX = targetX - startX;
    const deltaY = targetY - startY;
    clone.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    setTimeout(() => {
        clone.remove();
        isAnimating = false;
        callback();
    }, 250);
}

function executeMove(move) {
    let piece = board[move.fromR][move.fromC];
    let isJump = move.jumped !== null;
    let becomesKing = false;

    // Promotion rows (White promotes at row 0, Black promotes at row 7)
    if (piece === WHITE && move.toR === 0) becomesKing = true;
    else if (piece === BLACK && move.toR === 7) becomesKing = true;

    if (isJump) {
        playSound('jump');
    } else {
        playSound('move');
    }

    animateMove(move, () => {
        board[move.fromR][move.fromC] = null;
        board[move.toR][move.toC] = piece;

        if (isJump) {
            board[move.jumped.r][move.jumped.c] = null;
        }

        if (becomesKing) {
            if (piece === WHITE) {
                board[move.toR][move.toC] = WHITE_KING;
                piece = WHITE_KING;
            } else {
                board[move.toR][move.toC] = BLACK_KING;
                piece = BLACK_KING;
            }
            playSound('king');
        }

        // Multi-jump detection sequence
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

        forcedJumpPiece = null;
        selectedPiece = null;
        validMoves = [];

        if (turn === WHITE) {
            turn = BLACK;
            updateStatusText();
            renderBoard();
            setTimeout(aiTurn, 400);
        } else {
            turn = WHITE;
            updateStatusText();
            renderBoard();
        }
    });
}

// AI Minimax Algorithm with Alpha-Beta Pruning
function aiTurn() {
    if (turn !== BLACK) return;

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
            if (p === BLACK) score += 10;
            else if (p === BLACK_KING) score += 18;
            else if (p === WHITE) score -= 10;
            else if (p === WHITE_KING) score -= 18;
        }
    }
    return score;
}

function findBestMove(currentBoard, depth) {
    const allMoves = getAllPossibleMoves(currentBoard, BLACK);
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
    const player = isMaximizing ? BLACK : WHITE;
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

    if (piece === WHITE && move.toR === 0) currentBoard[move.toR][move.toC] = WHITE_KING;
    if (piece === BLACK && move.toR === 7) currentBoard[move.toR][move.toC] = BLACK_KING;
}

// UI Event Bindings
restartBtn.addEventListener('click', initGame);

soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = `Sound: ${soundEnabled ? 'ON' : 'OFF'}`;
});

// Run application on load
initGame();
