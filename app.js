/**
 * Tic Tac x2 - Ultimate Tic Tac Toe Game Logic Engine
 * Includes local PvP, heuristic-based PvNPC, undo system, and Web Audio synthesiser.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- GAME STATE ---
  let backgroundAngle = Math.random() * Math.PI * 2;
  let gameMode = 'PvP'; // 'PvP' or 'PvNPC'
  let npcDifficulty = 'easy'; // 'easy', 'expert', 'impossible'
  let currentPlayer = 'X'; // 'X' or 'O'
  let activeBoardIndex = -1; // -1 represents a wildcard (play anywhere)
  let gameActive = false;
  let winner = null; // 'X', 'O', 'tie', or null
  
  // 9x9 board: 9 mini-boards, each with 9 cells
  let board = Array(9).fill(null).map(() => Array(9).fill(''));
  // Status of the 9 mini-boards: '', 'X', 'O', 'tie'
  let miniBoardsWon = Array(9).fill('');
  
  // Stack of move records for Undo:
  // { boardIndex, cellIndex, player, prevActiveBoardIndex, prevMiniBoardState, prevGameWinner }
  let moveHistory = [];
  
  // Settings
  let soundEnabled = true;
  let hapticEnabled = true;

  // Win combinations for a 3x3 grid (works for both mini and large boards)
  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];

  // --- DOM ELEMENTS ---
  const appContainer = document.querySelector('.app-container');
  const ultimateBoard = document.getElementById('ultimate-board');
  const mainMenuView = document.getElementById('main-menu');
  const gameView = document.getElementById('game-view');
  
  // Menu Buttons
  const pvpBtn = document.getElementById('mode-pvp');
  const pveBtn = document.getElementById('mode-pve');
  const diffSelection = document.getElementById('difficulty-selection');
  const diffBtns = document.querySelectorAll('.diff-btn');
  const startGameBtn = document.getElementById('start-game-btn');
  const continueGameBtn = document.getElementById('continue-game-btn');
  const openRulesBtn = document.getElementById('open-rules-btn');
  
  // Game View Header & Footer Controls
  const homeBtn = document.getElementById('home-btn');
  const soundToggle = document.getElementById('sound-toggle');
  const hapticToggle = document.getElementById('haptic-toggle');
  const statusText = document.getElementById('status-text');
  const panelX = document.getElementById('panel-x');
  const panelO = document.getElementById('panel-o');
  const undoBtn = document.getElementById('undo-btn');
  const resetBtn = document.getElementById('reset-btn');
  
  // Modals
  const rulesModal = document.getElementById('rules-modal');
  const closeRulesBtn = document.getElementById('close-rules-btn');
  const gameOverModal = document.getElementById('game-over-modal');
  const replayBtn = document.getElementById('replay-btn');
  const menuBtn = document.getElementById('menu-btn');
  const winnerTitle = document.getElementById('winner-title');
  const winnerSubtitle = document.getElementById('winner-subtitle');
  const winnerDisplaySymbol = document.getElementById('winner-display-symbol');

  // Cells
  const cells = document.querySelectorAll('.cell');
  const miniBoards = document.querySelectorAll('.mini-board');

  // --- AUDIO SYNTHESISER ---
  // Web Audio Context initialized lazily on first user interaction to comply with browser autoplay policies
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  let logoImpactPlayed = false;

  function playSynthSound(type) {
    if (!soundEnabled) return;
    try {
      switch (type) {
        case 'click': {
          playAudioFile('audio/Button_1.mp3');
          break;
        }
        case 'place': {
          playAudioFile('audio/Place_Piece.mp3');
          break;
        }
        case 'board-win': {
          // Play a quick ascending major triad arpeggio (synthesis sound remains for distinct mini-board win feel)
          initAudio();
          const now = audioCtx.currentTime;
          const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
          notes.forEach((freq, index) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.08, now + index * 0.07);
            gain.gain.linearRampToValueAtTime(0.001, now + index * 0.07 + 0.18);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now + index * 0.07);
            osc.stop(now + index * 0.07 + 0.18);
          });
          break;
        }
        case 'victory': {
          playAudioFile('audio/Victory_Voice.mp3');
          playAudioFile('audio/Victory_Music.mp3');
          break;
        }
        case 'defeat': {
          playAudioFile('audio/You_Lose_Voice.mp3');
          playAudioFile('audio/You_Lose_Music.mp3');
          break;
        }
        case 'error': {
          playAudioFile('audio/Error_No.mp3');
          break;
        }
        case 'reset': {
          // Play sweeping synthesizer swoosh (synthesis remains for distinct reset sweep)
          initAudio();
          const now = audioCtx.currentTime;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(150, now + 0.4);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.4);
          break;
        }
        case 'logo-impact': {
          playAudioFileWithAutoplayFallback('audio/MenuStart_2.mp3');
          break;
        }
      }
    } catch (e) {
      console.warn('Audio play failed:', e);
    }
  }

  function playAudioFile(filePath) {
    if (!soundEnabled) return;
    try {
      const audio = new Audio(filePath);
      if (filePath.includes('Place_Piece.mp3')) {
        try {
          audio.currentTime = 0.4;
        } catch (_) {}
        audio.addEventListener('loadedmetadata', () => {
          audio.currentTime = 0.4;
        });
      }
      audio.play().catch(err => console.warn(`Audio play failed for ${filePath}:`, err));
    } catch (e) {
      console.warn(`Audio load failed for ${filePath}:`, e);
    }
  }

  function playAudioFileWithAutoplayFallback(filePath) {
    if (!soundEnabled) return;
    try {
      const audio = new Audio(filePath);
      audio.play().then(() => {
        logoImpactPlayed = true;
      }).catch(err => {
        console.warn('Autoplay prevented startup sound, waiting for user interaction:', err);
        const playOnInteraction = () => {
          if (!logoImpactPlayed && soundEnabled) {
            const audio2 = new Audio(filePath);
            audio2.play().then(() => {
              logoImpactPlayed = true;
            }).catch(e => console.warn('Play on interaction failed:', e));
          }
          document.removeEventListener('click', playOnInteraction);
          document.removeEventListener('keydown', playOnInteraction);
        };
        document.addEventListener('click', playOnInteraction);
        document.addEventListener('keydown', playOnInteraction);
      });
    } catch (e) {
      console.warn('Audio play with fallback failed:', e);
    }
  }

  // --- HAPTIC VIBRATION ---
  function triggerHaptic(type) {
    if (!hapticEnabled || !navigator.vibrate) return;
    try {
      if (type === 'tap') {
        navigator.vibrate(15);
      } else if (type === 'success') {
        navigator.vibrate([40, 30, 40]);
      } else if (type === 'victory') {
        navigator.vibrate([80, 50, 80, 50, 150]);
      } else if (type === 'error') {
        navigator.vibrate(60);
      }
    } catch (e) {
      console.warn('Haptics failed:', e);
    }
  }

  // --- VISUAL IMPACT EFFECTS (FLASH & SCREEN SHAKE) ---
  function triggerVisualImpact(intensity, color) {
    const boardWrapper = document.querySelector('.board-wrapper');
    const flashOverlay = document.getElementById('flash-overlay');
    if (!boardWrapper || !flashOverlay) return;

    // Reset impact classes & style
    boardWrapper.classList.remove('screenshake-mild', 'screenshake-strong', 'screenshake-victory');
    flashOverlay.classList.remove('flash-fast', 'flash-red', 'flash-victory');
    flashOverlay.style.backgroundColor = '';

    // Force reflow to restart animations
    void boardWrapper.offsetWidth;
    void flashOverlay.offsetWidth;

    if (intensity === 'mild') {
      boardWrapper.classList.add('screenshake-mild');
      // Mild screen-shake only, no screen flash!
    } else if (intensity === 'strong') {
      boardWrapper.classList.add('screenshake-strong');
      if (color) {
        flashOverlay.style.backgroundColor = color;
      }
      flashOverlay.classList.add('flash-red');
    } else if (intensity === 'victory') {
      boardWrapper.classList.add('screenshake-victory');
      flashOverlay.classList.add('flash-victory');
    }
  }

  // --- LOGO IMPACT WITH SMASH KO FANFARE ---
  function triggerLogoImpact() {
    const logoContainer = document.querySelector('.logo-container');
    if (!logoContainer) return;

    logoContainer.classList.remove('impact-active');
    void logoContainer.offsetWidth; // Force reflow
    logoContainer.classList.add('impact-active');

    // Trigger random direction angle for background
    if (typeof randomizeBackgroundAngle === 'function') {
      randomizeBackgroundAngle();
    }

    // Play swing sound
    playSynthSound('logo-impact');

    // Delayed visual flash to match the slam landing (150ms)
    setTimeout(() => {
      const flashOverlay = document.getElementById('flash-overlay');
      if (flashOverlay) {
        flashOverlay.classList.remove('flash-fast', 'flash-red', 'flash-victory');
        flashOverlay.style.backgroundColor = '#ffffff';
        void flashOverlay.offsetWidth;
        flashOverlay.classList.add('flash-fast');
      }
    }, 150);
  }

  function syncDifficultyTheme() {
    appContainer.classList.remove('easy-mode', 'expert-mode', 'impossible-mode');
    if (gameMode === 'PvNPC') {
      if (npcDifficulty === 'easy') {
        appContainer.classList.add('easy-mode');
      } else if (npcDifficulty === 'expert') {
        appContainer.classList.add('expert-mode');
      } else if (npcDifficulty === 'impossible') {
        appContainer.classList.add('impossible-mode');
      }
    }
  }

  // --- MENU INTERACTION EVENT HANDLERS ---
  
  // Game Mode Toggle
  pvpBtn.addEventListener('click', () => {
    initAudio();
    playSynthSound('click');
    triggerHaptic('tap');
    gameMode = 'PvP';
    pvpBtn.classList.add('active');
    pveBtn.classList.remove('active');
    diffSelection.classList.add('hidden');
    syncDifficultyTheme();
    saveGameState();
  });

  pveBtn.addEventListener('click', () => {
    initAudio();
    playSynthSound('click');
    triggerHaptic('tap');
    gameMode = 'PvNPC';
    npcDifficulty = 'easy';
    pveBtn.classList.add('active');
    pvpBtn.classList.remove('active');
    diffSelection.classList.remove('hidden');
    diffBtns.forEach(b => {
      if (b.getAttribute('data-difficulty') === 'easy') {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    syncDifficultyTheme();
    saveGameState();
  });

  // Difficulty Toggle
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      playSynthSound('click');
      triggerHaptic('tap');
      diffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      npcDifficulty = btn.getAttribute('data-difficulty');
      syncDifficultyTheme();
      saveGameState();
    });
  });

  // Start Button Click
  startGameBtn.addEventListener('click', () => {
    initAudio();
    playSynthSound('click');
    triggerHaptic('tap');
    
    // Hide menu, show game board
    mainMenuView.classList.remove('active');
    gameView.classList.add('active');
    
    startGame();
  });

  // Continue Button Click
  continueGameBtn.addEventListener('click', () => {
    initAudio();
    playSynthSound('click');
    triggerHaptic('tap');
    
    // Hide menu, show active game board
    mainMenuView.classList.remove('active');
    gameView.classList.add('active');
  });

  // How to Play Modal
  openRulesBtn.addEventListener('click', () => {
    initAudio();
    playSynthSound('click');
    triggerHaptic('tap');
    rulesModal.classList.add('active');
    setTimeout(() => {
      if (closeRulesBtn) closeRulesBtn.focus();
    }, 50);
  });

  closeRulesBtn.addEventListener('click', () => {
    playSynthSound('click');
    rulesModal.classList.remove('active');
    if (openRulesBtn) openRulesBtn.focus();
  });

  rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) {
      rulesModal.classList.remove('active');
      if (openRulesBtn) openRulesBtn.focus();
    }
  });

  // Home Button (Exit to Main Menu - pause/continue mid-game allowed)
  homeBtn.addEventListener('click', () => {
    playSynthSound('click');
    triggerHaptic('tap');
    
    // Return to main menu without ending active status
    gameView.classList.remove('active');
    mainMenuView.classList.add('active');
    updateMainMenuButtons();
    triggerLogoImpact();
  });

  // Sound/Haptic toggles
  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
      soundToggle.classList.add('active');
      soundToggle.querySelector('.sound-on').classList.remove('hidden');
      soundToggle.querySelector('.sound-off').classList.add('hidden');
      playSynthSound('click');
    } else {
      soundToggle.classList.remove('active');
      soundToggle.querySelector('.sound-on').classList.add('hidden');
      soundToggle.querySelector('.sound-off').classList.remove('hidden');
    }
  });

  hapticToggle.addEventListener('click', () => {
    hapticEnabled = !hapticEnabled;
    if (hapticEnabled) {
      hapticToggle.classList.add('active');
      triggerHaptic('tap');
    } else {
      hapticToggle.classList.remove('active');
    }
  });

  // Game Play Actions
  resetBtn.addEventListener('click', () => {
    if (confirm('Restart the game? All progress will be lost.')) {
      playSynthSound('reset');
      triggerHaptic('success');
      startGame();
    }
  });

  undoBtn.addEventListener('click', () => {
    if (!undoBtn.classList.contains('disabled')) {
      playSynthSound('click');
      triggerHaptic('tap');
      undoLastMove();
    }
  });

  replayBtn.addEventListener('click', () => {
    playSynthSound('reset');
    triggerHaptic('success');
    gameOverModal.classList.remove('active');
    startGame();
  });

  menuBtn.addEventListener('click', () => {
    playSynthSound('click');
    gameOverModal.classList.remove('active');
    gameView.classList.remove('active');
    mainMenuView.classList.add('active');
    updateMainMenuButtons();
    triggerLogoImpact();
  });


  // --- GAME INITIALIZATION ---
  function startGame() {
    if (typeof randomizeBackgroundAngle === 'function') {
      randomizeBackgroundAngle();
    }
    board = Array(9).fill(null).map(() => Array(9).fill(''));
    miniBoardsWon = Array(9).fill('');
    moveHistory = [];
    currentPlayer = 'X';
    activeBoardIndex = -1; // -1 means wildcard
    gameActive = true;
    winner = null;
    updateMainMenuButtons();

    // Reset visual elements
    cells.forEach(cell => {
      cell.className = 'cell';
      cell.textContent = '';
      cell.setAttribute('aria-label', `Board ${parseInt(cell.dataset.board) + 1}, Cell ${parseInt(cell.dataset.cell) + 1}`);
    });

    miniBoards.forEach(boardEl => {
      boardEl.className = 'mini-board';
      const overlaySymbol = boardEl.querySelector('.win-symbol');
      if (overlaySymbol) overlaySymbol.className = 'win-symbol';
    });

    updateUI();

    // Auto-focus the center cell of the board for keyboard navigation convenience
    setTimeout(() => {
      const defaultCell = document.querySelector('.cell[data-board="4"][data-cell="4"]');
      if (defaultCell) defaultCell.focus();
    }, 100);

    saveGameState();
  }

  // --- CORE GAME PLAY MECHANICS ---

  // Handle cell click
  cells.forEach(cell => {
    cell.addEventListener('click', () => {
      if (!gameActive) return;
      
      // If PvNPC mode and it's the NPC's turn, lock player interaction
      if (gameMode === 'PvNPC' && currentPlayer === 'O') return;

      const boardIndex = parseInt(cell.dataset.board);
      const cellIndex = parseInt(cell.dataset.cell);

      // Check if move is legal
      if (isMoveLegal(boardIndex, cellIndex)) {
        makeMove(boardIndex, cellIndex);
      } else {
        playSynthSound('error');
        triggerHaptic('error');
        // Visual shake animation for invalid moves
        const miniBoardEl = document.getElementById(`board-${boardIndex}`);
        miniBoardEl.classList.add('shake');
        setTimeout(() => miniBoardEl.classList.remove('shake'), 400);
      }
    });
  });

  // Verify if a move is valid
  function isMoveLegal(boardIndex, cellIndex) {
    // Game must be active and target cell empty
    if (!gameActive || board[boardIndex][cellIndex] !== '') return false;
    
    // Target board must not already be won or tied
    if (miniBoardsWon[boardIndex] !== '') return false;

    // Must match activeBoardIndex (unless wildcard)
    if (activeBoardIndex !== -1 && boardIndex !== activeBoardIndex) return false;

    return true;
  }

  // Apply a move to the game state
  function makeMove(boardIndex, cellIndex) {
    const prevActiveBoardIndex = activeBoardIndex;
    const prevMiniBoardState = miniBoardsWon[boardIndex];
    
    // Save to history
    moveHistory.push({
      boardIndex,
      cellIndex,
      player: currentPlayer,
      prevActiveBoardIndex,
      prevMiniBoardState,
      prevGameWinner: winner
    });

    // Update board state
    board[boardIndex][cellIndex] = currentPlayer;
    
    // Render mark on cell
    const cellEl = document.querySelector(`.cell[data-board="${boardIndex}"][data-cell="${cellIndex}"]`);
    cellEl.classList.add(currentPlayer.toLowerCase());
    cellEl.setAttribute('aria-label', `Board ${boardIndex + 1}, Cell ${cellIndex + 1} - Played ${currentPlayer}`);

    // Check if this move wins the mini-board
    const winsMiniBoard = check3x3Win(board[boardIndex], currentPlayer);

    if (winsMiniBoard) {
      miniBoardsWon[boardIndex] = currentPlayer;
      
      // Update visual overlay for mini board
      const miniBoardEl = document.getElementById(`board-${boardIndex}`);
      miniBoardEl.classList.add(`won-${currentPlayer.toLowerCase()}`);
      
      playSynthSound('board-win');
      triggerHaptic('success');
      
      // Check if this wins the entire game
      if (check3x3Win(miniBoardsWon, currentPlayer)) {
        endGame(currentPlayer);
        return;
      }
      
      // Compute specific color flash on winning a main board spot
      let flashColor = '#ffffff';
      if (gameMode === 'PvP') {
        flashColor = (currentPlayer === 'X') ? '#FEFE00' : '#4700FE';
      } else {
        // PvNPC mode: Player is X (Green), NPC is O (Red)
        flashColor = (currentPlayer === 'X') ? '#00F756' : '#FE004D';
      }
      triggerVisualImpact('strong', flashColor);
    } 
    // Check if the mini-board tied
    else if (isMiniBoardFull(board[boardIndex])) {
      miniBoardsWon[boardIndex] = 'tie';
      const miniBoardEl = document.getElementById(`board-${boardIndex}`);
      miniBoardEl.classList.add('won-tie');
      triggerVisualImpact('mild');
      playSynthSound('place');
      triggerHaptic('tap');
    } else {
      triggerVisualImpact('mild');
      playSynthSound('place');
      triggerHaptic('tap');
    }

    // Check if the entire board is in a tie state
    if (checkGameTie()) {
      endGame('tie');
      return;
    }

    // Determine the next active board index
    // If the board corresponding to the selected cell is already won or full, it's a wildcard!
    const targetBoard = cellIndex;
    if (miniBoardsWon[targetBoard] !== '' || isMiniBoardFull(board[targetBoard])) {
      activeBoardIndex = -1; // Wildcard!
    } else {
      activeBoardIndex = targetBoard;
    }

    // Switch player turn
    currentPlayer = (currentPlayer === 'X') ? 'O' : 'X';

    updateUI();
    saveGameState();

    // Trigger NPC if applicable
    if (gameActive && gameMode === 'PvNPC' && currentPlayer === 'O') {
      setTimeout(makeNpcMove, 600); // 600ms delay to feel natural
    }
  }

  // Undo last move (or last two moves if in PvNPC mode)
  function undoLastMove() {
    if (moveHistory.length === 0) return;

    if (gameMode === 'PvNPC') {
      // In PvNPC mode, undoing must revert BOTH the NPC move and the player move
      // Pop NPC move
      if (moveHistory.length >= 2) {
        revertMove(moveHistory.pop());
        revertMove(moveHistory.pop());
      } else {
        // Just in case there's only 1 move in history
        revertMove(moveHistory.pop());
      }
    } else {
      // PvP mode, just undo 1 move
      revertMove(moveHistory.pop());
    }

    // Update UI after reverting
    updateUI();
    saveGameState();
  }

  function revertMove(moveRecord) {
    if (!moveRecord) return;
    const { boardIndex, cellIndex, player, prevActiveBoardIndex, prevMiniBoardState, prevGameWinner } = moveRecord;

    // Reset board cell
    board[boardIndex][cellIndex] = '';
    const cellEl = document.querySelector(`.cell[data-board="${boardIndex}"][data-cell="${cellIndex}"]`);
    cellEl.classList.remove('x', 'o');
    cellEl.setAttribute('aria-label', `Board ${boardIndex + 1}, Cell ${cellIndex + 1}`);

    // Reset mini board win status
    miniBoardsWon[boardIndex] = prevMiniBoardState;
    const miniBoardEl = document.getElementById(`board-${boardIndex}`);
    miniBoardEl.classList.remove('won-x', 'won-o', 'won-tie');

    // Reset game winner state
    winner = prevGameWinner;
    gameActive = true;

    // Reset current active board & player
    activeBoardIndex = prevActiveBoardIndex;
    currentPlayer = player;
  }

  // Update game interface status display, highlights, and undo button
  function updateUI() {
    // Toggle active board classes on board wrapper
    if (activeBoardIndex === -1) {
      ultimateBoard.classList.remove('has-active-target');
      
      // All mini-boards that are playable (not won, not full) get high light
      miniBoards.forEach((mb, idx) => {
        if (miniBoardsWon[idx] === '' && !isMiniBoardFull(board[idx])) {
          mb.classList.add('active-play');
        } else {
          mb.classList.remove('active-play');
        }
      });
    } else {
      ultimateBoard.classList.add('has-active-target');
      miniBoards.forEach((mb, idx) => {
        if (idx === activeBoardIndex) {
          mb.classList.add('active-play');
        } else {
          mb.classList.remove('active-play');
        }
      });
    }

    // Toggle container classes for turn-based hover previews
    appContainer.classList.remove('turn-x', 'turn-o');
    appContainer.classList.add(`turn-${currentPlayer.toLowerCase()}`);

    // Update Player active panels
    if (currentPlayer === 'X') {
      panelX.classList.add('active');
      panelO.classList.remove('active');
    } else {
      panelO.classList.add('active');
      panelX.classList.remove('active');
    }

    // Update Turn helper message
    updateStatusText();

    // Enable/Disable undo button
    if (moveHistory.length > 0) {
      undoBtn.classList.remove('disabled');
      undoBtn.disabled = false;
    } else {
      undoBtn.classList.add('disabled');
      undoBtn.disabled = true;
    }
  }

  // Compose helpful status instructions
  function updateStatusText() {
    statusText.className = 'status-text';
    
    if (!gameActive) {
      if (winner === 'tie') {
        statusText.innerHTML = `<span class="status-badge tie-badge">DRAW GAME</span>`;
      } else {
        statusText.innerHTML = `<span class="status-badge winner-badge winner-${winner.toLowerCase()}">VICTORY: ${winner}</span>`;
      }
      return;
    }

    const isNpcActive = (gameMode === 'PvNPC' && currentPlayer === 'O');
    const playerString = isNpcActive ? 'NPC' : currentPlayer;
    const boardNames = ['TOP-LEFT', 'TOP-CENTER', 'TOP-RIGHT', 'MIDDLE-LEFT', 'CENTER', 'MIDDLE-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-CENTER', 'BOTTOM-RIGHT'];

    if (activeBoardIndex === -1) {
      statusText.innerHTML = `
        <span class="status-badge turn-badge turn-${currentPlayer.toLowerCase()}">TURN: ${playerString}</span>
        <span class="status-badge target-badge wildcard-badge">TARGET: WILDCARD!</span>
      `;
    } else {
      statusText.innerHTML = `
        <span class="status-badge turn-badge turn-${currentPlayer.toLowerCase()}">TURN: ${playerString}</span>
        <span class="status-badge target-badge">TARGET: ${boardNames[activeBoardIndex]}</span>
      `;
    }
  }

  // --- CORE GAME RULES MATHS ---

  // Check 3x3 victory
  function check3x3Win(grid3x3, symbol) {
    return WIN_LINES.some(line => {
      return line.every(index => grid3x3[index] === symbol);
    });
  }

  // Check if a mini board is completely full
  function isMiniBoardFull(miniGrid) {
    return miniGrid.every(cell => cell !== '');
  }

  // Check if entire board is full or drawn
  function checkGameTie() {
    // If all mini-boards are won/tied, the game must end
    let allBoardsFinished = true;
    for (let i = 0; i < 9; i++) {
      if (miniBoardsWon[i] === '' && !isMiniBoardFull(board[i])) {
        allBoardsFinished = false;
        break;
      }
    }
    return allBoardsFinished;
  }

  // End of game handler
  function endGame(gameWinner) {
    gameActive = false;
    winner = gameWinner;

    updateUI();
    saveGameState();

    // Trigger visual impact for game end
    if (gameWinner === 'tie') {
      triggerVisualImpact('strong');
    } else {
      triggerVisualImpact('victory');
    }

    // Populate Game Over screen
    gameOverModal.className = 'modal-overlay active';
    gameOverModal.classList.remove('winner-x', 'winner-o', 'winner-tie');
    
    // Hide bouncing winner display symbol in PvNPC mode
    if (gameMode === 'PvNPC') {
      winnerDisplaySymbol.style.display = 'none';
    } else {
      winnerDisplaySymbol.style.display = 'flex';
    }
    
    if (gameWinner === 'tie') {
      gameOverModal.classList.add('winner-tie');
      winnerTitle.textContent = "Tie Game!";
      winnerSubtitle.textContent = "The grid ended in a deadlock.";
      winnerDisplaySymbol.textContent = "=";
      playSynthSound('defeat');
    } else {
      gameOverModal.classList.add(`winner-${gameWinner.toLowerCase()}`);
      const isPlayerWinner = (gameWinner === 'X' || gameMode === 'PvP');
      
      if (isPlayerWinner) {
        winnerTitle.textContent = "Victory!";
        winnerSubtitle.textContent = `Congratulations! Player ${gameWinner} conquered the grid.`;
      } else {
        const lossPhrases = ["Ouch!", "Maybe Next Time...", "OOF", "Noob Alert!", "Yikes!"];
        const randomPhrase = lossPhrases[Math.floor(Math.random() * lossPhrases.length)];
        winnerTitle.textContent = randomPhrase;
        winnerSubtitle.textContent = `Defeat! The NPC has outplayed you.`;
      }
        
      winnerDisplaySymbol.textContent = gameWinner;
      
      if (isPlayerWinner) {
        playSynthSound('victory');
        triggerHaptic('victory');
      } else {
        playSynthSound('defeat');
      }
    }
  }

  // --- NPC STRATEGIC ENGINE ---

  function makeNpcMove() {
    if (!gameActive || currentPlayer !== 'O') return;

    // Get list of legal moves
    const legalMoves = [];
    if (activeBoardIndex !== -1) {
      for (let cellIdx = 0; cellIdx < 9; cellIdx++) {
        if (board[activeBoardIndex][cellIdx] === '') {
          legalMoves.push({ boardIndex: activeBoardIndex, cellIndex: cellIdx });
        }
      }
    } else {
      // Wildcard, can play in any board that is not won/full
      for (let boardIdx = 0; boardIdx < 9; boardIdx++) {
        if (miniBoardsWon[boardIdx] === '' && !isMiniBoardFull(board[boardIdx])) {
          for (let cellIdx = 0; cellIdx < 9; cellIdx++) {
            if (board[boardIdx][cellIdx] === '') {
              legalMoves.push({ boardIndex: boardIdx, cellIndex: cellIdx });
            }
          }
        }
      }
    }

    if (legalMoves.length === 0) return;

    let chosenMove = null;
    const roll = Math.random();

    if (npcDifficulty === 'easy') {
      // Easy Mode: 30% blunder rate, 2-ply Minimax lookahead
      if (roll < 0.30) {
        const randomIdx = Math.floor(Math.random() * legalMoves.length);
        chosenMove = legalMoves[randomIdx];
      } else {
        chosenMove = findBestNpcMoveMinimax(legalMoves, 2);
      }
    } else if (npcDifficulty === 'expert') {
      // Expert Mode: 15% blunder rate, 3-ply Minimax lookahead
      if (roll < 0.15) {
        const randomIdx = Math.floor(Math.random() * legalMoves.length);
        chosenMove = legalMoves[randomIdx];
      } else {
        chosenMove = findBestNpcMoveMinimax(legalMoves, 3);
      }
    } else if (npcDifficulty === 'impossible') {
      // Impossible Mode: 5% blunder rate, 4-ply Minimax lookahead (capped at 3 on wildcard turns for safety)
      if (roll < 0.05) {
        const randomIdx = Math.floor(Math.random() * legalMoves.length);
        chosenMove = legalMoves[randomIdx];
      } else {
        const depth = (activeBoardIndex === -1) ? 3 : 4;
        chosenMove = findBestNpcMoveMinimax(legalMoves, depth);
      }
    }

    if (chosenMove) {
      makeMove(chosenMove.boardIndex, chosenMove.cellIndex);
    }
  }

  // --- EXPERT & IMPOSSIBLE MINIMAX STRATEGY ---
  function findBestNpcMoveMinimax(legalMoves, depth) {
    let bestMove = null;
    let bestScore = -Infinity;

    // Shuffle moves slightly to prevent deterministic opening paths
    const shuffledMoves = [...legalMoves].sort(() => Math.random() - 0.5);

    shuffledMoves.forEach(move => {
      // Simulate move
      const undoRecord = simMakeMove(move.boardIndex, move.cellIndex, 'O');

      // Calculate minimax value
      const score = minimax(depth - 1, -Infinity, Infinity, false);

      // Revert move
      simUnmakeMove(undoRecord);

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    });

    return bestMove || legalMoves[0];
  }

  // State mutation simulation (make/unmake move) to avoid object allocations
  function simMakeMove(boardIdx, cellIdx, player) {
    const prevBoardCell = board[boardIdx][cellIdx];
    const prevMiniWon = miniBoardsWon[boardIdx];
    const prevActiveIdx = activeBoardIndex;

    board[boardIdx][cellIdx] = player;

    let wonMiniState = '';
    if (check3x3Win(board[boardIdx], player)) {
      wonMiniState = player;
      miniBoardsWon[boardIdx] = player;
    } else if (isMiniBoardFull(board[boardIdx])) {
      wonMiniState = 'tie';
      miniBoardsWon[boardIdx] = 'tie';
    }

    // Determine next active board index
    if (miniBoardsWon[cellIdx] !== '' || isMiniBoardFull(board[cellIdx])) {
      activeBoardIndex = -1;
    } else {
      activeBoardIndex = cellIdx;
    }

    return {
      boardIdx,
      cellIdx,
      prevBoardCell,
      prevMiniWon,
      prevActiveIdx,
      wonMiniState
    };
  }

  function simUnmakeMove(undoRecord) {
    const { boardIdx, cellIdx, prevBoardCell, prevMiniWon, prevActiveIdx } = undoRecord;
    board[boardIdx][cellIdx] = prevBoardCell;
    miniBoardsWon[boardIdx] = prevMiniWon;
    activeBoardIndex = prevActiveIdx;
  }

  function minimax(depth, alpha, beta, isMaximizing) {
    // 1. Terminal cases: game wins
    if (check3x3Win(miniBoardsWon, 'O')) return 100000 + depth;
    if (check3x3Win(miniBoardsWon, 'X')) return -100000 - depth;

    if (depth === 0) {
      return evaluateState();
    }

    // 2. Collect legal moves
    const moves = [];
    if (activeBoardIndex !== -1) {
      const b = activeBoardIndex;
      for (let c = 0; c < 9; c++) {
        if (board[b][c] === '') {
          moves.push({ boardIndex: b, cellIndex: c });
        }
      }
    } else {
      for (let b = 0; b < 9; b++) {
        if (miniBoardsWon[b] === '' && !isMiniBoardFull(board[b])) {
          for (let c = 0; c < 9; c++) {
            if (board[b][c] === '') {
              moves.push({ boardIndex: b, cellIndex: c });
            }
          }
        }
      }
    }

    if (moves.length === 0) return 0; // Draw

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const undoRecord = simMakeMove(move.boardIndex, move.cellIndex, 'O');

        const evaluation = minimax(depth - 1, alpha, beta, false);

        simUnmakeMove(undoRecord);

        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break; // Prune
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const undoRecord = simMakeMove(move.boardIndex, move.cellIndex, 'X');

        const evaluation = minimax(depth - 1, alpha, beta, true);

        simUnmakeMove(undoRecord);

        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break; // Prune
      }
      return minEval;
    }
  }

  // Heuristic evaluation of the overall board state
  function evaluateState() {
    let score = 0;

    // Check large board win
    if (check3x3Win(miniBoardsWon, 'O')) return 100000;
    if (check3x3Win(miniBoardsWon, 'X')) return -100000;

    // Positional weights for mini-boards inside large grid
    const boardWeights = [3, 2, 3, 2, 4, 2, 3, 2, 3];
    const cellWeights = [3, 2, 3, 2, 4, 2, 3, 2, 3];

    for (let b = 0; b < 9; b++) {
      if (miniBoardsWon[b] === 'O') {
        score += boardWeights[b] * 100;
      } else if (miniBoardsWon[b] === 'X') {
        score -= boardWeights[b] * 100;
      } else if (miniBoardsWon[b] === '') {
        // Evaluate cells inside the active mini-board
        let miniScore = 0;
        for (let c = 0; c < 9; c++) {
          if (board[b][c] === 'O') {
            miniScore += cellWeights[c] * 2;
          } else if (board[b][c] === 'X') {
            miniScore -= cellWeights[c] * 2;
          }
        }

        // Check local threats
        if (checkCloseToWin(board[b], 'O')) {
          miniScore += 15;
        }
        if (checkCloseToWin(board[b], 'X')) {
          miniScore -= 15;
        }

        // Scale by large board position weight
        score += miniScore * boardWeights[b];
      }
    }

    // Add score for global won-board 2-in-a-rows (match setup threats)
    score += countTwoInARows(miniBoardsWon, 'O') * 500;
    score -= countTwoInARows(miniBoardsWon, 'X') * 500;

    return score;
  }

  // Count threat lines (2 cells owned, 1 empty) on any 3x3 layout
  function countTwoInARows(grid3x3, symbol) {
    let count = 0;
    WIN_LINES.forEach(line => {
      let countSymbol = 0;
      let countEmpty = 0;
      line.forEach(idx => {
        if (grid3x3[idx] === symbol) countSymbol++;
        else if (grid3x3[idx] === '') countEmpty++;
      });
      if (countSymbol === 2 && countEmpty === 1) {
        count++;
      }
    });
    return count;
  }

  // Checks if playing in cellIndex would create a 2-in-a-row for player
  function createsTwoInARow(grid3x3, cellIndex, symbol) {
    // If checking a generic grid (like mini-board) where we want to simulate
    if (cellIndex !== -1) {
      grid3x3[cellIndex] = symbol;
    }
    
    let isTwo = WIN_LINES.some(line => {
      if (cellIndex !== -1 && !line.includes(cellIndex)) return false;
      let countSymbol = 0;
      let countEmpty = 0;
      line.forEach(idx => {
        if (grid3x3[idx] === symbol) countSymbol++;
        else if (grid3x3[idx] === '') countEmpty++;
      });
      return (countSymbol === 2 && countEmpty === 1);
    });

    if (cellIndex !== -1) {
      grid3x3[cellIndex] = '';
    }
    return isTwo;
  }

  // Helper: Checks if a player has 2-in-a-row in a 3x3 grid and the third cell is empty (immediate threat)
  function checkCloseToWin(grid3x3, symbol) {
    return WIN_LINES.some(line => {
      let countSymbol = 0;
      let countEmpty = 0;
      line.forEach(idx => {
        if (grid3x3[idx] === symbol) countSymbol++;
        else if (grid3x3[idx] === '') countEmpty++;
      });
      return (countSymbol === 2 && countEmpty === 1);
    });
  }

  // Toggle main menu buttons based on if a game is currently ongoing
  function updateMainMenuButtons() {
    if (gameActive && moveHistory.length > 0) {
      continueGameBtn.classList.remove('hidden');
    } else {
      continueGameBtn.classList.add('hidden');
    }
  }

  // --- PANOPTICON STATE INTEGRATION ---
  function saveGameState() {
    if (window.parent && window.parent !== window) {
      const state = {
        board,
        miniBoardsWon,
        moveHistory,
        currentPlayer,
        activeBoardIndex,
        gameActive,
        winner,
        gameMode,
        npcDifficulty
      };
      window.parent.postMessage({ type: 'PANOPTICON_SYNC', payload: state }, '*');
    }
  }

  function restoreGameState(state) {
    if (!state) return;
    board = state.board || Array(9).fill(null).map(() => Array(9).fill(''));
    miniBoardsWon = state.miniBoardsWon || Array(9).fill('');
    moveHistory = state.moveHistory || [];
    currentPlayer = state.currentPlayer || 'X';
    activeBoardIndex = state.activeBoardIndex !== undefined ? state.activeBoardIndex : -1;
    const hasOngoingGame = (state.gameActive !== undefined ? state.gameActive : false) && (state.moveHistory && state.moveHistory.length > 0);
    if (hasOngoingGame) {
      gameActive = true;
      winner = state.winner || null;
      gameMode = state.gameMode || 'PvP';
      npcDifficulty = state.npcDifficulty || 'easy';
    } else {
      gameActive = false;
      winner = null;
      gameMode = 'PvP';
      npcDifficulty = 'easy';
    }

    // Refresh cells
    cells.forEach(cell => {
      const bIdx = parseInt(cell.dataset.board);
      const cIdx = parseInt(cell.dataset.cell);
      const val = board[bIdx][cIdx];
      cell.className = 'cell';
      if (val) {
        cell.classList.add(val.toLowerCase());
        cell.setAttribute('aria-label', `Board ${bIdx + 1}, Cell ${cIdx + 1} - Played ${val}`);
      } else {
        cell.setAttribute('aria-label', `Board ${bIdx + 1}, Cell ${cIdx + 1}`);
      }
    });

    // Refresh mini-boards win overlays
    miniBoards.forEach((boardEl, idx) => {
      boardEl.className = 'mini-board';
      const wonState = miniBoardsWon[idx];
      if (wonState === 'X' || wonState === 'O') {
        boardEl.classList.add(`won-${wonState.toLowerCase()}`);
      } else if (wonState === 'tie') {
        boardEl.classList.add('won-tie');
      }
    });

    // Sync menu views
    if (gameActive && moveHistory.length > 0) {
      mainMenuView.classList.remove('active');
      gameView.classList.add('active');
    } else {
      mainMenuView.classList.add('active');
      gameView.classList.remove('active');
    }

    // Sync modes
    if (gameMode === 'PvP') {
      pvpBtn.classList.add('active');
      pveBtn.classList.remove('active');
      diffSelection.classList.add('hidden');
    } else {
      pveBtn.classList.add('active');
      pvpBtn.classList.remove('active');
      diffSelection.classList.remove('hidden');
    }

    // Sync difficulty controls
    diffBtns.forEach(btn => {
      if (btn.getAttribute('data-difficulty') === npcDifficulty) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    syncDifficultyTheme();

    updateUI();
  }

  // Initial call to hide/show Continue Game button on page load
  updateMainMenuButtons();

  // Listen for state load from Panopticon host
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PANOPTICON_LOAD') {
      restoreGameState(event.data.payload);
    }
  });

  // Notify Panopticon host that this app is ready to load state
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'PANOPTICON_READY' }, '*');
  }

  // --- DYNAMIC BACKGROUND PARTICLE SYSTEM ---
  const canvas = document.getElementById('bg-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    const maxParticles = 300; // High density capacity for a thick field of particles
    const initialParticlesCount = 100; // Starting count to prevent rendering spikes on load

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Global background angle randomizer (hooked up to main module)
    window.randomizeBackgroundAngle = function() {
      backgroundAngle = Math.random() * Math.PI * 2;
    };

    // Particle factory
    function createParticle(initOpacity = 0.08) {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 30 + Math.random() * 170, // Twice as large (up to 200px)
        type: Math.random() < 0.5 ? 'X' : 'O',
        opacity: initOpacity,
        fadeDelay: 60 + Math.random() * 120, // Frames to stay visible before fading
        fadeSpeed: 0.003 + Math.random() * 0.007,
        shakeAmount: 12 + Math.random() * 15, // Birth shake offset
        shakeDecay: 0.88,
        rotation: Math.random() * Math.PI * 2,
        driftSpeed: 0.15 + Math.random() * 0.25
      };
    }

    // Populate initial particles
    for (let i = 0; i < initialParticlesCount; i++) {
      particles.push(createParticle(Math.random() * 0.08));
    }

    function animateBackground() {
      // Check if main menu is currently active to use Kidmon font and colors
      const isMenu = mainMenuView && mainMenuView.classList.contains('active');
      const isImpossible = appContainer && appContainer.classList.contains('impossible-mode');
      const isEasy = appContainer && appContainer.classList.contains('easy-mode');
      const isExpert = appContainer && appContainer.classList.contains('expert-mode');

      // Draw dynamic background gradient (from dark crimson/blue to deep charcoal)
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      if (isImpossible) {
        // Inverted: pitch black top, intense red/crimson bottom glow
        grad.addColorStop(0, '#000000');
        grad.addColorStop(1, '#3d000f');
      } else if (isEasy) {
        // Easy Mode: deep dark violet/blue top
        grad.addColorStop(0, '#0a0024'); // Darkish #4700FE
        grad.addColorStop(1, '#0f1015');
      } else if (isExpert) {
        // Expert Mode: deep dark olive/yellow top
        grad.addColorStop(0, '#222000'); // Darkish #FEFE00
        grad.addColorStop(1, '#0f1015');
      } else if (isMenu) {
        grad.addColorStop(0, '#28000b'); // Darkish #FE004D
        grad.addColorStop(1, '#0f1015'); // Current dark gray
      } else {
        grad.addColorStop(0, '#00043a'); // Darkish #0018FE
        grad.addColorStop(1, '#0f1015'); // Current dark gray
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Spawn new particles if we have space (faster spawn rate)
      if (particles.length < maxParticles && Math.random() < 0.45) {
        particles.push(createParticle(0.08));
      }

      // Draw and update particles
      particles.forEach((p) => {
        // Drift according to current backgroundAngle (doubled speed in impossible mode)
        const speedMultiplier = isImpossible ? 2.2 : 1;
        p.x += Math.cos(backgroundAngle) * p.driftSpeed * speedMultiplier;
        p.y += Math.sin(backgroundAngle) * p.driftSpeed * speedMultiplier;

        // Apply birth shake decay
        let sx = 0, sy = 0;
        if (p.shakeAmount > 0.1) {
          const shakeAngle = Math.random() * Math.PI * 2;
          sx = Math.cos(shakeAngle) * p.shakeAmount;
          sy = Math.sin(shakeAngle) * p.shakeAmount;
          p.shakeAmount *= p.shakeDecay;
        }

        // Wrap particles around borders if they drift off screen
        if (p.x < -p.size * 2) p.x = canvas.width + p.size * 2;
        if (p.x > canvas.width + p.size * 2) p.x = -p.size * 2;
        if (p.y < -p.size * 2) p.y = canvas.height + p.size * 2;
        if (p.y > canvas.height + p.size * 2) p.y = -p.size * 2;

        // Opacity fade logic
        if (p.fadeDelay > 0) {
          p.fadeDelay--;
        } else {
          p.opacity -= p.fadeSpeed;
        }

        // Draw particle if visible
        if (p.opacity > 0.001) {
          ctx.save();
          ctx.translate(p.x + sx, p.y + sy);
          ctx.rotate(p.rotation);

          // Draw using Kidmon Demo font in both menu and gameplay
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `900 ${p.size}px 'Kidmon Demo', sans-serif`;

          if (isImpossible) {
            // Highly prominent hot red particles
            ctx.fillStyle = `rgba(254, 0, 77, ${Math.min(0.65, p.opacity * 2.2)})`;
          } else if (isEasy) {
            ctx.fillStyle = `rgba(71, 0, 254, ${p.opacity})`; // Indigo/Blue (#4700FE)
          } else if (isExpert) {
            ctx.fillStyle = `rgba(254, 254, 0, ${p.opacity})`; // Neon Yellow (#FEFE00)
          } else if (isMenu) {
            ctx.fillStyle = `rgba(254, 0, 77, ${p.opacity})`; // Hot Red (#FE004D)
          } else {
            ctx.fillStyle = `rgba(0, 24, 254, ${p.opacity})`; // Deep Blue (#0018FE)
          }
          ctx.fillText(p.type, 0, 0);
          ctx.restore();
        }
      });

      // Remove completely faded out particles
      particles = particles.filter(p => p.opacity > 0.001);

      requestAnimationFrame(animateBackground);
    }
    
    // Start loop
    animateBackground();
  }

  // --- KEYBOARD NAVIGATION & ACCESSIBILITY ---
  document.addEventListener('keydown', (e) => {
    const isGameActiveView = gameView && gameView.classList.contains('active');
    
    // Check if the pressed key is an arrow key or spacebar
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      // Prevent default page scroll
      e.preventDefault();
      
      if (isGameActiveView) {
        // --- GAMEPLAY KEYBOARD NAVIGATION ---
        const activeEl = document.activeElement;
        const isCell = activeEl && activeEl.classList.contains('cell');
        
        let boardIdx = 4; // Default starting board
        let cellIdx = 4;  // Default starting cell
        
        if (isCell) {
          boardIdx = parseInt(activeEl.dataset.board);
          cellIdx = parseInt(activeEl.dataset.cell);
        } else {
          // If no cell is focused, default to activeBoardIndex if specified, or center
          if (activeBoardIndex !== -1) {
            boardIdx = activeBoardIndex;
          }
        }
        
        if (e.key === ' ') {
          // Space bar triggers click
          if (isCell) {
            activeEl.click();
          } else {
            const targetCell = document.querySelector(`.cell[data-board="${boardIdx}"][data-cell="${cellIdx}"]`);
            if (targetCell) {
              targetCell.focus();
              targetCell.click();
            }
          }
        } else {
          // Arrow keys: move focus in 9x9 layout
          let r = Math.floor(boardIdx / 3) * 3 + Math.floor(cellIdx / 3);
          let c = (boardIdx % 3) * 3 + (cellIdx % 3);
          
          if (e.key === 'ArrowUp') {
            r = (r - 1 + 9) % 9;
          } else if (e.key === 'ArrowDown') {
            r = (r + 1) % 9;
          } else if (e.key === 'ArrowLeft') {
            c = (c - 1 + 9) % 9;
          } else if (e.key === 'ArrowRight') {
            c = (c + 1) % 9;
          }
          
          const newBoardIdx = Math.floor(r / 3) * 3 + Math.floor(c / 3);
          const newCellIdx = (r % 3) * 3 + (c % 3);
          
          const targetCell = document.querySelector(`.cell[data-board="${newBoardIdx}"][data-cell="${newCellIdx}"]`);
          if (targetCell) {
            targetCell.focus();
          }
        }
      } else {
        // --- MENU/MODAL KEYBOARD NAVIGATION ---
        let activeContainer = mainMenuView;
        if (rulesModal && rulesModal.classList.contains('active')) {
          activeContainer = rulesModal;
        } else if (gameOverModal && gameOverModal.classList.contains('active')) {
          activeContainer = gameOverModal;
        }
        
        const focusableSelectors = 'button:not(.hidden):not([disabled]), [tabindex="0"]';
        const focusables = Array.from(activeContainer.querySelectorAll(focusableSelectors))
          .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
          
        if (focusables.length === 0) return;
        
        const activeEl = document.activeElement;
        let index = focusables.indexOf(activeEl);
        
        if (e.key === ' ') {
          if (activeEl && focusables.includes(activeEl)) {
            activeEl.click();
          }
        } else {
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            index = (index + 1) % focusables.length;
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            index = (index - 1 + focusables.length) % focusables.length;
          }
          focusables[index].focus();
        }
      }
    }
  });

  // Trigger initial logo impact and background drift angle
  setTimeout(triggerLogoImpact, 100);
});
