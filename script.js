// --- SOUND EFFECTS SYSTEM (TONE.JS) ---
        let soundEnabled = true;

        const synthMove = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
        }).toDestination();
        synthMove.volume.value = -12;

        const synthCapture = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 4,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 }
        }).toDestination();
        synthCapture.volume.value = -6;

        const synthKing = new Tone.PolySynth(Tone.Synth).toDestination();
        synthKing.volume.value = -10;

        function playSound(type) {
            if (!soundEnabled) return;
            try {
                if (Tone.context.state !== 'running') {
                    Tone.start();
                }
                if (type === 'move') {
                    synthMove.triggerAttackRelease('C4', '16n');
                } else if (type === 'capture') {
                    synthCapture.triggerAttackRelease('G2', '16n');
                } else if (type === 'king') {
                    synthKing.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '8n');
                } else if (type === 'win') {
                    synthKing.triggerAttackRelease(['C4', 'E4', 'G4', 'C5', 'E5'], '4n');
                }
            } catch (e) {
                console.log('Audio contextual note', e);
            }
        }

        // --- CONSTANTS & GAME STATE ---
        const BOARD_SIZE = 8;
        const PLAYER_WHITE = 1; // Lower side
        const PLAYER_BLACK = 2; // Upper side

        // Piece Types:
        // 0: Empty
        // 1: White Normal, 2: Black Normal
        // 3: White King,   4: Black King

        let board = [];
        let currentPlayer = PLAYER_WHITE;
        let selectedSquare = null; // {r, c}
        let validMoves = []; // Array of move objects {r, c, path, captured: []}
        let mandatoryCapturesAvailable = false;
        
        let isVsAI = false;
        let aiDifficulty = 'medium';
        let isAiThinking = false;

        let moveHistory = [];
        let capturedByWhite = 0;
        let capturedByBlack = 0;

        let timerInterval = null;
        let secondsElapsed = 0;

        // Visual Effects Arrays
        let captureParticles = [];
        let shockwaves = [];
        let kingGlowEffects = [];
        let kingAuraPulse = 0; // Continuous pulsing wave phase for Kings

        // Confetti & Dancer Animation State
        let confettiParticles = [];
        let dancerAnimationFrame = null;
        let dancePhase = 0;
        let isGameEnded = false;

        // --- CANVAS & SETUP ---
        const canvas = document.getElementById('checkerboard');
        const ctx = canvas.getContext('2d');
        let tileSize = 0;

        // Dancer Canvas Context
        const dancerCanvas = document.getElementById('dancer-canvas');
        const dancerCtx = dancerCanvas ? dancerCanvas.getContext('2d') : null;

        function resizeCanvas() {
            const container = canvas.parentElement;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const padding = window.innerWidth < 640 ? 24 : 40;
            const size = Math.floor(rect.width - padding);
            
            if (size > 0) {
                canvas.width = size;
                canvas.height = size;
                tileSize = size / BOARD_SIZE;
                renderBoard();
            }
        }

        window.addEventListener('resize', resizeCanvas);

        // --- GAME INITIALIZATION ---
        function initGame() {
            board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
            
            // Populate standard 8x8 draughts board setup
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if ((r + c) % 2 === 1) { // Dark squares only
                        if (r < 3) {
                            board[r][c] = PLAYER_BLACK; // Black pieces top
                        } else if (r > 4) {
                            board[r][c] = PLAYER_WHITE; // White pieces bottom
                        }
                    }
                }
            }

            currentPlayer = PLAYER_WHITE;
            selectedSquare = null;
            validMoves = [];
            moveHistory = [];
            capturedByWhite = 0;
            capturedByBlack = 0;
            isAiThinking = false;
            isGameEnded = false;

            if (dancerAnimationFrame) {
                cancelAnimationFrame(dancerAnimationFrame);
                dancerAnimationFrame = null;
            }
            confettiParticles = [];
            if (window.Celebrant) window.Celebrant.hide();

            resetTimer();
            startTimer();
            updateUI();
            calculateAllMovesForCurrentPlayer();
            renderBoard();

            document.getElementById('banner-overlay').classList.add('opacity-0', 'pointer-events-none');
        }

        // --- TIMER FUNCTIONS ---
        function startTimer() {
            clearInterval(timerInterval);
            secondsElapsed = 0;
            timerInterval = setInterval(() => {
                secondsElapsed++;
                const mins = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
                const secs = (secondsElapsed % 60).toString().padStart(2, '0');
                document.getElementById('game-timer').textContent = `${mins}:${secs}`;
            }, 1000);
        }

        function resetTimer() {
            clearInterval(timerInterval);
            document.getElementById('game-timer').textContent = '00:00';
        }

        // --- MOVE COMPUTATION & RULES ---
        
        function getPieceOwner(piece) {
            if (piece === 1 || piece === 3) return PLAYER_WHITE;
            if (piece === 2 || piece === 4) return PLAYER_BLACK;
            return 0;
        }

        function isKing(piece) {
            return piece === 3 || piece === 4;
        }

        // Calculate all valid moves for active player strictly
        function calculateAllMovesForCurrentPlayer() {
            const allCaptures = [];
            const allSimpleMoves = [];

            mandatoryCapturesAvailable = false;

            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (getPieceOwner(board[r][c]) === currentPlayer) {
                        const captures = getCapturesForPiece(r, c, board);
                        if (captures.length > 0) {
                            allCaptures.push(...captures);
                        }
                    }
                }
            }

            // Rule of Majority: Filter maximum capture paths
            if (allCaptures.length > 0) {
                mandatoryCapturesAvailable = true;
                let maxCaptured = 0;
                allCaptures.forEach(m => {
                    if (m.captured.length > maxCaptured) {
                        maxCaptured = m.captured.length;
                    }
                });
                validMoves = allCaptures.filter(m => m.captured.length === maxCaptured);
            } else {
                mandatoryCapturesAvailable = false;
                for (let r = 0; r < BOARD_SIZE; r++) {
                    for (let c = 0; c < BOARD_SIZE; c++) {
                        if (getPieceOwner(board[r][c]) === currentPlayer) {
                            const simple = getSimpleMovesForPiece(r, c, board);
                            allSimpleMoves.push(...simple);
                        }
                    }
                }
                validMoves = allSimpleMoves;
            }
        }

        function getSimpleMovesForPiece(r, c, currentBoard) {
            const moves = [];
            const piece = currentBoard[r][c];
            const owner = getPieceOwner(piece);
            const king = isKing(piece);

            const directions = king 
                ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
                : (owner === PLAYER_WHITE ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);

            for (const [dr, dc] of directions) {
                if (king) {
                    let step = 1;
                    while (true) {
                        const nr = r + dr * step;
                        const nc = c + dc * step;
                        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
                        if (currentBoard[nr][nc] !== 0) break;
                        
                        moves.push({ from: {r, c}, to: {r: nr, c: nc}, captured: [], intermediateSteps: [] });
                        step++;
                    }
                } else {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && currentBoard[nr][nc] === 0) {
                        moves.push({ from: {r, c}, to: {r: nr, c: nc}, captured: [], intermediateSteps: [] });
                    }
                }
            }
            return moves;
        }

        function getCapturesForPiece(r, c, currentBoard, currentCaptured = [], pathHistory = []) {
            let moves = [];
            const piece = currentBoard[r][c];
            if (!piece) return moves;

            const owner = getPieceOwner(piece);
            const king = isKing(piece);

            const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
            let foundSubJump = false;

            const currentPath = pathHistory.length === 0 ? [{r, c}] : pathHistory;

            for (const [dr, dc] of directions) {
                if (king) {
                    let step = 1;
                    let victimPos = null;

                    while (true) {
                        const nr = r + dr * step;
                        const nc = c + dc * step;
                        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;

                        const cell = currentBoard[nr][nc];
                        if (cell !== 0) {
                            if (getPieceOwner(cell) === owner) break;
                            if (getPieceOwner(cell) !== owner) {
                                if (victimPos !== null) break;
                                if (currentCaptured.some(cap => cap.r === nr && cap.c === nc)) break;
                                victimPos = { r: nr, c: nc };
                            }
                        } else if (victimPos !== null) {
                            if (!currentPath.some(p => p.r === nr && p.c === nc)) {
                                foundSubJump = true;
                                const nextBoard = cloneBoard(currentBoard);
                                nextBoard[r][c] = 0;
                                nextBoard[victimPos.r][victimPos.c] = 0;
                                nextBoard[nr][nc] = piece;
                                
                                const nextCaptured = [...currentCaptured, victimPos];
                                const nextPath = [...currentPath, {r: nr, c: nc}];
                                
                                // Para a Dama (King), adiciona este ponto como um destino final válido
                                // permitindo o jogador escolher parar ou continuar a captura
                                moves.push({
                                    from: currentPath[0],
                                    to: {r: nr, c: nc},
                                    captured: nextCaptured,
                                    intermediateSteps: nextPath,
                                    isKingChoice: true
                                });

                                const subJumps = getCapturesForPiece(nr, nc, nextBoard, nextCaptured, nextPath);
                                if (subJumps.length > 0) {
                                    moves.push(...subJumps);
                                }
                            }
                        }
                        step++;
                    }
                } else {
                    const enemyR = r + dr;
                    const enemyC = c + dc;
                    const landingR = r + dr * 2;
                    const landingC = c + dc * 2;

                    if (landingR >= 0 && landingR < BOARD_SIZE && landingC >= 0 && landingC < BOARD_SIZE) {
                        const enemyPiece = currentBoard[enemyR][enemyC];
                        const landingCell = currentBoard[landingR][landingC];

                        if (enemyPiece !== 0 && getPieceOwner(enemyPiece) !== owner && landingCell === 0) {
                            const alreadyCaptured = currentCaptured.some(cap => cap.r === enemyR && cap.c === enemyC);
                            const alreadyVisitedLanding = currentPath.some(p => p.r === landingR && p.c === landingC);

                            if (!alreadyCaptured && !alreadyVisitedLanding) {
                                foundSubJump = true;
                                const nextBoard = cloneBoard(currentBoard);
                                nextBoard[r][c] = 0;
                                nextBoard[enemyR][enemyC] = 0;
                                nextBoard[landingR][landingC] = piece;

                                const nextCaptured = [...currentCaptured, {r: enemyR, c: enemyC}];
                                const nextPath = [...currentPath, {r: landingR, c: landingC}];
                                
                                const subJumps = getCapturesForPiece(landingR, landingC, nextBoard, nextCaptured, nextPath);

                                if (subJumps.length > 0) {
                                    moves.push(...subJumps);
                                } else {
                                    moves.push({
                                        from: currentPath[0],
                                        to: {r: landingR, c: landingC},
                                        captured: nextCaptured,
                                        intermediateSteps: nextPath
                                    });
                                }
                            }
                        }
                    }
                }
            }

            if (!foundSubJump && currentCaptured.length > 0 && !king) {
                moves.push({
                    from: currentPath[0],
                    to: {r, c},
                    captured: currentCaptured,
                    intermediateSteps: currentPath
                });
            }

            return moves;
        }

        function cloneBoard(b) {
            return b.map(row => [...row]);
        }

        // --- PARTICLE & SPECIAL EFFECTS TRIGGER ---
        function triggerCaptureParticles(row, col, isWhitePiece, capturedByKing = false) {
            const centerX = (col + 0.5) * tileSize;
            const centerY = (row + 0.5) * tileSize;
            
            // Shockwave Bomb Ring Effect
            shockwaves.push({
                x: centerX,
                y: centerY,
                radius: tileSize * 0.2,
                maxRadius: tileSize * (capturedByKing ? 1.6 : 0.9),
                alpha: 1.0,
                color: capturedByKing ? '#fbbf24' : (isWhitePiece ? '#fbbf24' : '#f97316')
            });

            // Divine Light Flare Effect for Queen Captures
            if (capturedByKing) {
                kingGlowEffects.push({
                    x: centerX,
                    y: centerY,
                    radius: tileSize * 0.2,
                    maxRadius: tileSize * 2.2,
                    alpha: 1.0,
                    rays: 8,
                    color: '#fbbf24',
                    secondaryColor: '#ffffff'
                });
            }

            // Explosion Sparks Particles
            const particleCount = capturedByKing ? 55 : 28;

            for (let i = 0; i < particleCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * (tileSize * (capturedByKing ? 0.22 : 0.12)) + (tileSize * 0.04);
                const isFlame = Math.random() > 0.4;

                captureParticles.push({
                    x: centerX,
                    y: centerY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    radius: Math.random() * (tileSize * (capturedByKing ? 0.12 : 0.08)) + (tileSize * 0.03),
                    alpha: 1,
                    decay: Math.random() * (capturedByKing ? 0.025 : 0.035) + 0.015,
                    color: capturedByKing 
                        ? (Math.random() > 0.3 ? (Math.random() > 0.5 ? '#f59e0b' : '#fef08a') : '#ffffff') 
                        : (isFlame ? (Math.random() > 0.5 ? '#ef4444' : '#f59e0b') : (isWhitePiece ? '#ffffff' : '#334155')),
                    ringColor: capturedByKing ? '#fbbf24' : (isFlame ? '#b91c1c' : '#fbbf24')
                });
            }
            animateParticles();
        }

        let animationFrameId = null;
        function animateParticles() {
            kingAuraPulse = (kingAuraPulse + 0.05) % (Math.PI * 2);

            if (captureParticles.length === 0 && shockwaves.length === 0 && kingGlowEffects.length === 0) {
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
                renderBoard();
                return;
            }

            // Update Shockwaves
            for (let i = shockwaves.length - 1; i >= 0; i--) {
                const sw = shockwaves[i];
                sw.radius += (sw.maxRadius - sw.radius) * 0.18 + 0.5;
                sw.alpha -= 0.045;
                if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
                    shockwaves.splice(i, 1);
                }
            }

            // Update Queen Divine Glow Rays
            for (let i = kingGlowEffects.length - 1; i >= 0; i--) {
                const kg = kingGlowEffects[i];
                kg.alpha -= 0.03;
                if (kg.alpha <= 0) {
                    kingGlowEffects.splice(i, 1);
                }
            }

            // Update Particles
            for (let i = captureParticles.length - 1; i >= 0; i--) {
                const p = captureParticles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.94;
                p.vy *= 0.94;
                p.alpha -= p.decay;

                if (p.alpha <= 0) {
                    captureParticles.splice(i, 1);
                }
            }

            renderBoard();
            animationFrameId = requestAnimationFrame(animateParticles);
        }

        // Calculate all valid moves for active player strictly
        function calculateAllMovesForCurrentPlayer() {
            const allCaptures = [];
            const allSimpleMoves = [];

            mandatoryCapturesAvailable = false;

            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (getPieceOwner(board[r][c]) === currentPlayer) {
                        const captures = getCapturesForPiece(r, c, board);
                        if (captures.length > 0) {
                            allCaptures.push(...captures);
                        }
                    }
                }
            }

            // Regra da Maioria para peças normais; para a Dama (isKingChoice), mantemos as opções parciais
            if (allCaptures.length > 0) {
                mandatoryCapturesAvailable = true;
                let maxCaptured = 0;
                allCaptures.forEach(m => {
                    if (m.captured.length > maxCaptured) {
                        maxCaptured = m.captured.length;
                    }
                });

                // Permite escolhas intermediárias se o movimento for da Dama (isKingChoice)
                validMoves = allCaptures.filter(m => m.captured.length === maxCaptured || m.isKingChoice);
            } else {
                mandatoryCapturesAvailable = false;
                for (let r = 0; r < BOARD_SIZE; r++) {
                    for (let c = 0; c < BOARD_SIZE; c++) {
                        if (getPieceOwner(board[r][c]) === currentPlayer) {
                            const simple = getSimpleMovesForPiece(r, c, board);
                            allSimpleMoves.push(...simple);
                        }
                    }
                }
                validMoves = allSimpleMoves;
            }
        }

        function executeMove(move) {
            moveHistory.push({
                boardState: cloneBoard(board),
                player: currentPlayer,
                capturedW: capturedByWhite,
                capturedB: capturedByBlack
            });

            const { from, to, captured } = move;
            let piece = board[from.r][from.c];
            const attackerIsKing = isKing(piece);

            board[from.r][from.c] = 0;

            if (captured && captured.length > 0) {
                captured.forEach(cap => {
                    const victim = board[cap.r][cap.c];
                    const isVictimWhite = getPieceOwner(victim) === PLAYER_WHITE;
                    
                    if (isVictimWhite) capturedByBlack++;
                    else capturedByWhite++;

                    triggerCaptureParticles(cap.r, cap.c, isVictimWhite, attackerIsKing);

                    board[cap.r][cap.c] = 0;
                });
                playSound('capture');
                
                const activeCard = currentPlayer === PLAYER_WHITE ? document.getElementById('card-player-white') : document.getElementById('card-player-black');
                if (activeCard) {
                    activeCard.classList.add('scale-105', 'ring-4', 'ring-amber-400');
                    setTimeout(() => {
                        activeCard.classList.remove('scale-105', 'ring-4', 'ring-amber-400');
                    }, 400);
                }
            } else {
                playSound('move');
            }

            // Promotion to King
            let promoted = false;
            if (piece === PLAYER_WHITE && to.r === 0) {
                piece = 3;
                promoted = true;
            } else if (piece === PLAYER_BLACK && to.r === BOARD_SIZE - 1) {
                piece = 4;
                promoted = true;
            }

            board[to.r][to.c] = piece;
            if (promoted) playSound('king');

            selectedSquare = null;

            if (checkGameOver()) return;

            currentPlayer = currentPlayer === PLAYER_WHITE ? PLAYER_BLACK : PLAYER_WHITE;
            updateUI();
            calculateAllMovesForCurrentPlayer();

            if (validMoves.length === 0) {
                const winner = currentPlayer === PLAYER_WHITE ? PLAYER_BLACK : PLAYER_WHITE;
                endGame(winner, "O adversário não possui jogadas válidas!");
                return;
            }

            renderBoard();

            if (isVsAI && currentPlayer === PLAYER_BLACK) {
                isAiThinking = true;
                setTimeout(makeAIMove, 600);
            }
        }

        // --- WIN / GAME OVER & AI LOGIC ---

        function checkGameOver() {
            let whiteCount = 0;
            let blackCount = 0;

            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    const owner = getPieceOwner(board[r][c]);
                    if (owner === PLAYER_WHITE) whiteCount++;
                    if (owner === PLAYER_BLACK) blackCount++;
                }
            }

            if (blackCount === 0) {
                endGame(PLAYER_WHITE, "Todas as peças escuras foram capturadas!");
                return true;
            } else if (whiteCount === 0) {
                endGame(PLAYER_BLACK, "Todas as peças claras foram capturadas!");
                return true;
            }
            return false;
        }

        function endGame(winner, reason) {
            clearInterval(timerInterval);
            playSound('win');
            isGameEnded = true;

            const banner = document.getElementById('banner-overlay');
            const title = document.getElementById('banner-title');
            const desc = document.getElementById('banner-desc');

            if (winner === PLAYER_WHITE) {
                title.textContent = "Vitória Espetacular das Claras!";
            } else {
                title.textContent = isVsAI ? "O Computador Venceu!" : "Vitória Espetacular das Escuras!";
            }

            desc.textContent = reason;
            banner.classList.remove('opacity-0', 'pointer-events-none');

            // Trigger Victory Confetti Explosions & Animated Dancing King Character
            createConfetti();
            startDancingCharacter(winner);

            // Personagem 3D comemora no canto da tela (não comemora quando o computador vence)
            if (window.Celebrant && !(isVsAI && winner === PLAYER_BLACK)) window.Celebrant.show();
        }

        // --- ANIMATED DANCING CHARACTER & CONFETTI ---
        function createConfetti() {
            confettiParticles = [];
            const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ec4899', '#fef08a', '#ffffff'];
            for (let i = 0; i < 90; i++) {
                confettiParticles.push({
                    x: Math.random() * 160,
                    y: Math.random() * -50,
                    vx: (Math.random() - 0.5) * 3,
                    vy: Math.random() * 2 + 1.5,
                    size: Math.random() * 6 + 4,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    rotation: Math.random() * Math.PI * 2,
                    vRot: (Math.random() - 0.5) * 0.2
                });
            }
        }

        function startDancingCharacter(winner) {
            dancePhase = 0;

            function animateDancer() {
                if (!dancerCtx || !isGameEnded) return;

                dancePhase += 0.12;
                dancerCtx.clearRect(0, 0, 160, 160);

                // Render Confetti inside victory box
                confettiParticles.forEach((p) => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.rotation += p.vRot;
                    if (p.y > 160) {
                        p.y = -10;
                        p.x = Math.random() * 160;
                    }

                    dancerCtx.save();
                    dancerCtx.translate(p.x, p.y);
                    dancerCtx.rotate(p.rotation);
                    dancerCtx.fillStyle = p.color;
                    dancerCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                    dancerCtx.restore();
                });

                // Calculate Character Joints and Bounce Dynamics
                const bounceY = Math.abs(Math.sin(dancePhase * 1.5)) * 14;
                const bodyX = 80;
                const bodyY = 95 - bounceY;
                const radius = 28;
                const isWhiteWinner = (winner === PLAYER_WHITE);

                // Glow Aura
                dancerCtx.save();
                const grad = dancerCtx.createRadialGradient(bodyX, bodyY, 10, bodyX, bodyY, 45);
                grad.addColorStop(0, isWhiteWinner ? 'rgba(254, 240, 138, 0.8)' : 'rgba(245, 158, 11, 0.8)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                dancerCtx.fillStyle = grad;
                dancerCtx.beginPath();
                dancerCtx.arc(bodyX, bodyY, 45, 0, Math.PI * 2);
                dancerCtx.fill();
                dancerCtx.restore();

                // Dancing Legs
                const legAngle1 = Math.sin(dancePhase * 2) * 0.5;
                const legAngle2 = -Math.sin(dancePhase * 2) * 0.5;

                dancerCtx.lineWidth = 6;
                dancerCtx.lineCap = 'round';
                dancerCtx.strokeStyle = isWhiteWinner ? '#e2e8f0' : '#334155';

                // Left Leg
                dancerCtx.beginPath();
                dancerCtx.moveTo(bodyX - 12, bodyY + 18);
                dancerCtx.lineTo(bodyX - 18 + Math.sin(legAngle1) * 12, bodyY + 40);
                dancerCtx.stroke();

                // Right Leg
                dancerCtx.beginPath();
                dancerCtx.moveTo(bodyX + 12, bodyY + 18);
                dancerCtx.lineTo(bodyX + 18 + Math.sin(legAngle2) * 12, bodyY + 40);
                dancerCtx.stroke();

                // Character Body (Dama Piece)
                dancerCtx.save();
                dancerCtx.beginPath();
                dancerCtx.arc(bodyX, bodyY, radius, 0, Math.PI * 2);
                const bodyGrad = dancerCtx.createRadialGradient(
                    bodyX - 8, bodyY - 8, 4,
                    bodyX, bodyY, radius
                );
                if (isWhiteWinner) {
                    bodyGrad.addColorStop(0, '#ffffff');
                    bodyGrad.addColorStop(0.8, '#cbd5e1');
                    bodyGrad.addColorStop(1, '#94a3b8');
                } else {
                    bodyGrad.addColorStop(0, '#475569');
                    bodyGrad.addColorStop(0.8, '#1e293b');
                    bodyGrad.addColorStop(1, '#0f172a');
                }
                dancerCtx.fillStyle = bodyGrad;
                dancerCtx.fill();
                dancerCtx.lineWidth = 3;
                dancerCtx.strokeStyle = '#fbbf24';
                dancerCtx.stroke();
                dancerCtx.restore();

                // Happy Eyes & Expression
                dancerCtx.fillStyle = isWhiteWinner ? '#1e293b' : '#ffffff';
                dancerCtx.font = 'bold 12px Inter';
                dancerCtx.textAlign = 'center';
                dancerCtx.textBaseline = 'middle';
                
                // Animated Winking/Happy Face
                const mouthCurve = Math.abs(Math.sin(dancePhase)) * 3 + 2;
                dancerCtx.beginPath();
                dancerCtx.arc(bodyX - 8, bodyY - 4, 3, 0, Math.PI * 2);
                dancerCtx.arc(bodyX + 8, bodyY - 4, 3, 0, Math.PI * 2);
                dancerCtx.fill();

                dancerCtx.beginPath();
                dancerCtx.arc(bodyX, bodyY + 4, 7, 0, Math.PI);
                dancerCtx.lineWidth = 2.5;
                dancerCtx.strokeStyle = isWhiteWinner ? '#1e293b' : '#ffffff';
                dancerCtx.stroke();

                // Golden Crown (Dama Queen)
                const crownTilt = Math.sin(dancePhase) * 0.2;
                dancerCtx.save();
                dancerCtx.translate(bodyX, bodyY - radius + 2);
                dancerCtx.rotate(crownTilt);
                dancerCtx.fillStyle = '#fbbf24';
                dancerCtx.font = 'bold 26px "Font Awesome 6 Free"';
                dancerCtx.textAlign = 'center';
                dancerCtx.textBaseline = 'bottom';
                dancerCtx.fillText('\uf521', 0, 0);
                dancerCtx.restore();

                // Dancing Arms (Grooving up and down)
                const armWave1 = Math.cos(dancePhase * 2) * 20;
                const armWave2 = Math.sin(dancePhase * 2) * 20;

                dancerCtx.lineWidth = 5;
                dancerCtx.strokeStyle = '#fbbf24';

                // Left Arm
                dancerCtx.beginPath();
                dancerCtx.moveTo(bodyX - 22, bodyY);
                dancerCtx.quadraticCurveTo(bodyX - 35, bodyY - 15 + armWave1, bodyX - 28, bodyY - 30 + armWave1);
                dancerCtx.stroke();

                // Right Arm
                dancerCtx.beginPath();
                dancerCtx.moveTo(bodyX + 22, bodyY);
                dancerCtx.quadraticCurveTo(bodyX + 35, bodyY - 15 + armWave2, bodyX + 28, bodyY - 30 + armWave2);
                dancerCtx.stroke();

                dancerAnimationFrame = requestAnimationFrame(animateDancer);
            }

            animateDancer();
        }

        function makeAIMove() {
            if (!isVsAI || currentPlayer !== PLAYER_BLACK || validMoves.length === 0) {
                isAiThinking = false;
                return;
            }

            let chosenMove = null;

            if (aiDifficulty === 'easy') {
                chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            } else if (aiDifficulty === 'medium') {
                const captureMoves = validMoves.filter(m => m.captured && m.captured.length > 0);
                if (captureMoves.length > 0) {
                    chosenMove = captureMoves[Math.floor(Math.random() * captureMoves.length)];
                } else {
                    chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                }
            } else {
                validMoves.sort((a, b) => {
                    const aScore = (a.captured ? a.captured.length * 10 : 0) + (a.to.r === BOARD_SIZE - 1 ? 5 : 0);
                    const bScore = (b.captured ? b.captured.length * 10 : 0) + (b.to.r === BOARD_SIZE - 1 ? 5 : 0);
                    return bScore - aScore;
                });
                chosenMove = validMoves[0];
            }

            isAiThinking = false;
            if (chosenMove) {
                executeMove(chosenMove);
            }
        }

        // --- RENDERING (CANVAS GRAPHICS) ---

        function renderBoard() {
            if (!board || board.length === 0 || tileSize <= 0) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 1. Draw Board Grid
            const lightColor = '#f0d9b5';
            const darkColor = '#b58863';

            for (let r = 0; r < BOARD_SIZE; r++) {
                if (!board[r]) continue;
                for (let c = 0; c < BOARD_SIZE; c++) {
                    const isDark = (r + c) % 2 === 1;
                    ctx.fillStyle = isDark ? darkColor : lightColor;
                    ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
                }
            }

            // 2. Highlight Selected Square & Available Moves
            if (selectedSquare) {
                ctx.fillStyle = 'rgba(251, 191, 36, 0.5)';
                ctx.fillRect(selectedSquare.c * tileSize, selectedSquare.r * tileSize, tileSize, tileSize);

                const movesFromSelected = validMoves.filter(m => m.from.r === selectedSquare.r && m.from.c === selectedSquare.c);
                movesFromSelected.forEach(m => {
                    if (m.intermediateSteps && m.intermediateSteps.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo((selectedSquare.c + 0.5) * tileSize, (selectedSquare.r + 0.5) * tileSize);
                        m.intermediateSteps.forEach(step => {
                            ctx.lineTo((step.c + 0.5) * tileSize, (step.r + 0.5) * tileSize);
                        });
                        ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
                        ctx.lineWidth = 4;
                        ctx.setLineDash([6, 6]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }

                    ctx.fillStyle = 'rgba(34, 197, 94, 0.7)';
                    ctx.beginPath();
                    ctx.arc((m.to.c + 0.5) * tileSize, (m.to.r + 0.5) * tileSize, tileSize * 0.22, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = '#15803d';
                    ctx.lineWidth = 3;
                    ctx.stroke();

                    if (m.captured && m.captured.length > 1) {
                        ctx.fillStyle = '#ef4444';
                        ctx.beginPath();
                        ctx.arc((m.to.c + 0.7) * tileSize, (m.to.r + 0.3) * tileSize, tileSize * 0.14, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#ffffff';
                        ctx.font = `bold ${tileSize * 0.16}px Inter`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(`x${m.captured.length}`, (m.to.c + 0.7) * tileSize, (m.to.r + 0.3) * tileSize);
                    }
                });
            }

            // 3. Highlight Pieces with Mandatory Captures
            if (mandatoryCapturesAvailable && !selectedSquare) {
                validMoves.forEach(m => {
                    if (getPieceOwner(board[m.from.r][m.from.c]) === currentPlayer) {
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 3.5;
                        ctx.beginPath();
                        ctx.arc((m.from.c + 0.5) * tileSize, (m.from.r + 0.5) * tileSize, tileSize * 0.42, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                });
            }

            // 4. Draw Pieces
            for (let r = 0; r < BOARD_SIZE; r++) {
                if (!board[r]) continue;
                for (let c = 0; c < BOARD_SIZE; c++) {
                    const piece = board[r][c];
                    if (piece !== 0) {
                        drawPiece(r, c, piece);
                    }
                }
            }

            // 5. Render Bomb Shockwaves Effect
            if (shockwaves.length > 0) {
                shockwaves.forEach(sw => {
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, sw.alpha);
                    ctx.strokeStyle = sw.color;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                });
            }

            // 6. Render Divine Rays / Glow Effect for Queen
            if (kingGlowEffects.length > 0) {
                kingGlowEffects.forEach(kg => {
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, kg.alpha);
                    
                    const radialGrad = ctx.createRadialGradient(
                        kg.x, kg.y, kg.radius * 0.05,
                        kg.x, kg.y, kg.radius
                    );
                    radialGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
                    radialGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.9)');
                    radialGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.5)');
                    radialGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');

                    ctx.fillStyle = radialGrad;
                    ctx.beginPath();
                    ctx.arc(kg.x, kg.y, kg.radius, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2.5;
                    for (let r = 0; r < kg.rays; r++) {
                        const angle = (r * Math.PI / (kg.rays / 2));
                        const rayLen = kg.radius * 0.9;
                        ctx.beginPath();
                        ctx.moveTo(kg.x, kg.y);
                        ctx.lineTo(kg.x + Math.cos(angle) * rayLen, kg.y + Math.sin(angle) * rayLen);
                        ctx.stroke();
                    }

                    ctx.strokeStyle = '#fbbf24';
                    ctx.lineWidth = 3.5;
                    ctx.beginPath();
                    ctx.arc(kg.x, kg.y, kg.radius * 0.6, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.restore();
                });
            }

            // 7. Render Particle Explosions
            if (captureParticles.length > 0) {
                captureParticles.forEach(p => {
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, p.alpha);
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = p.ringColor;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    ctx.restore();
                });
            }
        }

        function drawPiece(r, c, piece) {
            const centerX = (c + 0.5) * tileSize;
            const centerY = (r + 0.5) * tileSize;
            const radius = tileSize * 0.38;

            const isWhite = (piece === 1 || piece === 3);
            const king = isKing(piece);

            // Continuous Radiant Aura for Queen / King
            if (king) {
                ctx.save();
                const auraPulseRadius = radius * (1.25 + Math.sin(kingAuraPulse) * 0.08);
                const auraAlpha = 0.5 + Math.sin(kingAuraPulse) * 0.25;

                const auraGrad = ctx.createRadialGradient(
                    centerX, centerY, radius * 0.8,
                    centerX, centerY, auraPulseRadius
                );
                auraGrad.addColorStop(0, isWhite ? 'rgba(251, 191, 36, 0.8)' : 'rgba(245, 158, 11, 0.8)');
                auraGrad.addColorStop(0.6, isWhite ? 'rgba(254, 240, 138, 0.4)' : 'rgba(217, 119, 6, 0.4)');
                auraGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');

                ctx.fillStyle = auraGrad;
                ctx.globalAlpha = auraAlpha;
                ctx.beginPath();
                ctx.arc(centerX, centerY, auraPulseRadius, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = isWhite ? '#fef08a' : '#fbbf24';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius * 1.15, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Piece Drop Shadow
            ctx.beginPath();
            ctx.arc(centerX + 2, centerY + 4, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fill();

            // Main Gradient Body
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(
                centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.1,
                centerX, centerY, radius
            );

            if (isWhite) {
                gradient.addColorStop(0, '#ffffff');
                gradient.addColorStop(0.8, '#e2e8f0');
                gradient.addColorStop(1, '#cbd5e1');
            } else {
                gradient.addColorStop(0, '#475569');
                gradient.addColorStop(0.7, '#1e293b');
                gradient.addColorStop(1, '#0f172a');
            }

            ctx.fillStyle = gradient;
            ctx.fill();

            // Outer Border Ring
            ctx.lineWidth = king ? 3.5 : 2.5;
            ctx.strokeStyle = king ? '#fbbf24' : (isWhite ? '#94a3b8' : '#334155');
            ctx.stroke();

            // Inner Decorative Ring
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 0.65, 0, Math.PI * 2);
            ctx.strokeStyle = king ? '#fef08a' : (isWhite ? 'rgba(148, 163, 184, 0.5)' : 'rgba(255, 255, 255, 0.15)');
            ctx.lineWidth = 2;
            ctx.stroke();

            // Crown Icon for King
            if (king) {
                ctx.fillStyle = isWhite ? '#d97706' : '#fbbf24';
                ctx.font = `900 ${tileSize * 0.4}px "Font Awesome 6 Free"`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('\uf521', centerX, centerY + 1);
            }
        }

        // --- INTERACTION HANDLERS ---

        function handleBoardClick(event) {
            if (!board || board.length === 0 || isAiThinking || (isVsAI && currentPlayer === PLAYER_BLACK)) return;

            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const c = Math.floor(x / tileSize);
            const r = Math.floor(y / tileSize);

            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;

            const clickedPiece = board[r][c];
            const clickedOwner = getPieceOwner(clickedPiece);

            // 1. Click on own piece to select
            if (clickedOwner === currentPlayer) {
                const hasCapture = validMoves.some(m => m.from.r === r && m.from.c === c);
                if (mandatoryCapturesAvailable && !hasCapture) {
                    return;
                }

                selectedSquare = { r, c };
                renderBoard();
                return;
            }

            // 2. Click on empty destination square
            if (selectedSquare) {
                const move = validMoves.find(
                    m => m.from.r === selectedSquare.r && m.from.c === selectedSquare.c && m.to.r === r && m.to.c === c
                );

                if (move) {
                    executeMove(move);
                } else {
                    selectedSquare = null;
                    renderBoard();
                }
            }
        }

        canvas.addEventListener('click', handleBoardClick);

        // --- UI UPDATES ---

        function updateUI() {
            const cardWhite = document.getElementById('card-player-white');
            const cardBlack = document.getElementById('card-player-black');
            const indWhite = document.getElementById('turn-indicator-white');
            const indBlack = document.getElementById('turn-indicator-black');

            if (currentPlayer === PLAYER_WHITE) {
                cardWhite.classList.add('border-amber-500');
                cardWhite.classList.remove('border-transparent', 'opacity-60');
                cardBlack.classList.remove('border-amber-500');
                cardBlack.classList.add('border-transparent', 'opacity-60');
                indWhite.classList.remove('hidden');
                indBlack.classList.add('hidden');
            } else {
                cardBlack.classList.add('border-amber-500');
                cardBlack.classList.remove('border-transparent', 'opacity-60');
                cardWhite.classList.remove('border-amber-500');
                cardWhite.classList.add('border-transparent', 'opacity-60');
                indBlack.classList.remove('hidden');
                indWhite.classList.add('hidden');
            }

            document.getElementById('captured-black-count').textContent = `Capturou: ${capturedByWhite}`;
            document.getElementById('captured-white-count').textContent = `Capturou: ${capturedByBlack}`;

            document.getElementById('btn-undo').disabled = moveHistory.length === 0 || (isVsAI && currentPlayer === PLAYER_BLACK);
        }

        // --- EVENT LISTENERS (CONTROLS & MODALS) ---

        document.getElementById('btn-new-game').addEventListener('click', initGame);
        document.getElementById('btn-banner-restart').addEventListener('click', initGame);

        document.getElementById('mode-pvp').addEventListener('click', () => {
            isVsAI = false;
            document.getElementById('mode-pvp').className = 'py-2.5 px-3 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-400 font-semibold text-xs sm:text-sm flex flex-col items-center gap-1 transition';
            document.getElementById('mode-ai').className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-400 font-semibold text-xs sm:text-sm flex flex-col items-center gap-1 transition hover:border-slate-600';
            document.getElementById('ai-difficulty-container').classList.add('hidden');
            document.getElementById('name-black').textContent = 'Escuras';
            initGame();
        });

        document.getElementById('mode-ai').addEventListener('click', () => {
            isVsAI = true;
            document.getElementById('mode-ai').className = 'py-2.5 px-3 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-400 font-semibold text-xs sm:text-sm flex flex-col items-center gap-1 transition';
            document.getElementById('mode-pvp').className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-400 font-semibold text-xs sm:text-sm flex flex-col items-center gap-1 transition hover:border-slate-600';
            document.getElementById('ai-difficulty-container').classList.remove('hidden');
            document.getElementById('ai-difficulty-container').classList.add('flex');
            document.getElementById('name-black').textContent = 'Computador (IA)';
            initGame();
        });

        document.getElementById('ai-difficulty').addEventListener('change', (e) => {
            aiDifficulty = e.target.value;
            initGame();
        });

        document.getElementById('btn-sound').addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            const icon = document.getElementById('sound-icon');
            if (soundEnabled) {
                icon.className = 'fa-solid fa-volume-high';
            } else {
                icon.className = 'fa-solid fa-volume-xmark';
            }
        });

        document.getElementById('btn-undo').addEventListener('click', () => {
            if (moveHistory.length === 0) return;

            let lastState = moveHistory.pop();
            if (isVsAI && lastState.player === PLAYER_BLACK && moveHistory.length > 0) {
                lastState = moveHistory.pop();
            }

            board = lastState.boardState;
            currentPlayer = lastState.player;
            capturedByWhite = lastState.capturedW;
            capturedByBlack = lastState.capturedB;
            selectedSquare = null;

            updateUI();
            calculateAllMovesForCurrentPlayer();
            renderBoard();
        });

        // Rules Modal
        const modalRules = document.getElementById('modal-rules');
        document.getElementById('btn-rules').addEventListener('click', () => modalRules.classList.remove('hidden'));
        document.getElementById('btn-close-rules').addEventListener('click', () => modalRules.classList.add('hidden'));
        document.getElementById('btn-rules-ok').addEventListener('click', () => modalRules.classList.add('hidden'));

        // Initialization
        window.onload = () => {
            initGame();
            resizeCanvas();
        };

(function () {
        const root = document.getElementById('celebrant');
        if (!root || !window.THREE) return;
        const glCanvas = document.getElementById('celebrant-gl');
        const fx = document.getElementById('celebrant-fx');
        const fctx = fx.getContext('2d');
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let renderer, scene, camera, pivot;
        let ready = false, wantShow = false, running = false;
        let raf = 0, hideTimer = 0, tStart = 0, lastT = 0, dpr = 1;
        let confetti = [];

        const COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ec4899', '#fef08a', '#ffffff'];

        function makeConfetti(w) {
            confetti = [];
            for (let i = 0; i < 36; i++) {
                confetti.push({
                    x: Math.random() * w,
                    y: Math.random() * -200,
                    vy: 50 + Math.random() * 70,
                    vx: (Math.random() - 0.5) * 30,
                    s: 4 + Math.random() * 4,
                    r: Math.random() * 6.28,
                    vr: (Math.random() - 0.5) * 6,
                    c: COLORS[(Math.random() * COLORS.length) | 0]
                });
            }
        }

        function resize() {
            if (!renderer) return;
            const w = root.clientWidth, h = root.clientHeight;
            if (!w || !h) return;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            renderer.setPixelRatio(dpr);
            renderer.setSize(w, h, false);
            fx.width = Math.round(w * dpr);
            fx.height = Math.round(h * dpr);
            fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            if (!running) renderFrame(0, 0);
        }

        // Pose da comemoração: pula, balança e, de tempos em tempos, dá uma voltinha
        function renderFrame(t, dt) {
            const beat = t * Math.PI * 2 * 1.1;
            const sway = Math.sin(t * Math.PI * 2 * 0.55);
            let spin = 0;
            const cycle = t % 6;
            if (cycle > 4.7) {
                const k = Math.min((cycle - 4.7) / 1.2, 1);
                spin = (k * k * (3 - 2 * k)) * Math.PI * 2;
            }
            pivot.position.y = -0.9 + Math.abs(Math.sin(beat)) * 0.06;
            pivot.rotation.z = sway * 0.10;
            pivot.rotation.y = sway * 0.4 + spin;
            pivot.rotation.x = Math.sin(beat * 2) * 0.03;
            renderer.render(scene, camera);

            const w = root.clientWidth, h = root.clientHeight;
            fctx.clearRect(0, 0, w, h);
            if (reduceMotion) return;
            for (const p of confetti) {
                p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
                if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
                fctx.save();
                fctx.translate(p.x, p.y);
                fctx.rotate(p.r);
                fctx.fillStyle = p.c;
                fctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
                fctx.restore();
            }
        }

        function loop(now) {
            if (!running) return;
            const t = (now - tStart) / 1000;
            const dt = Math.min(t - lastT, 0.05);
            lastT = t;
            renderFrame(t, dt);
            raf = requestAnimationFrame(loop);
        }

        function startLoop() {
            if (running) return;
            running = true;
            tStart = performance.now();
            lastT = 0;
            raf = requestAnimationFrame(loop);
        }

        function stopLoop() {
            running = false;
            cancelAnimationFrame(raf);
        }

        function show() {
            wantShow = true;
            if (!ready) return; // começa assim que o modelo terminar de carregar
            clearTimeout(hideTimer);
            resize();
            makeConfetti(root.clientWidth);
            root.classList.add('show');
            if (reduceMotion) renderFrame(0.4, 0); else startLoop();
        }

        function hide() {
            wantShow = false;
            root.classList.remove('show');
            clearTimeout(hideTimer);
            hideTimer = setTimeout(stopLoop, 900);
        }

        window.Celebrant = { show, hide };

        async function load() {
            const b64 = document.getElementById('celebrant-data').textContent.trim();
            const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
            const buf = await new Response(stream).arrayBuffer();

            const dv = new DataView(buf);
            const nv = dv.getUint32(0, true), nt = dv.getUint32(4, true);
            const lo = [dv.getFloat32(8, true), dv.getFloat32(12, true), dv.getFloat32(16, true)];
            const ext = [dv.getFloat32(20, true), dv.getFloat32(24, true), dv.getFloat32(28, true)];
            let off = 32;
            const q = new Int16Array(buf.slice(off, off + nv * 6)); off += nv * 6;
            const col = new Uint8Array(buf.slice(off, off + nv * 3)); off += nv * 3;
            const idx = new Uint16Array(buf.slice(off, off + nt * 6));

            const pos = new Float32Array(nv * 3);
            for (let i = 0; i < nv; i++) {
                for (let k = 0; k < 3; k++) {
                    pos[i * 3 + k] = lo[k] + ((q[i * 3 + k] + 32768) / 65535) * ext[k];
                }
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
            geo.setIndex(new THREE.BufferAttribute(idx, 1));
            geo.computeVertexNormals();

            const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.y = -lo[1]; // base do busto no pivô

            renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true });
            renderer.setClearColor(0x000000, 0);
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(30, 0.75, 0.1, 20);
            camera.position.set(0, 0, 2.7);
            scene.add(new THREE.AmbientLight(0xffffff, 0.72));
            const key = new THREE.DirectionalLight(0xffffff, 0.5);
            key.position.set(1, 1.5, 3);
            scene.add(key);

            pivot = new THREE.Group();
            pivot.position.y = -0.9;
            pivot.add(mesh);
            scene.add(pivot);

            if (window.ResizeObserver) new ResizeObserver(resize).observe(root);
            window.addEventListener('resize', resize);
            ready = true;
            resize();
            if (wantShow) show();
        }

        // O jogo funciona normalmente mesmo se o personagem não carregar
        if (typeof DecompressionStream === 'undefined') return;
        load().catch(function (e) { console.warn('Personagem 3D indisponível:', e); });
    })();
