/**
 * Tic Tac x2 - Ultimate Tic Tac Toe Game Logic Engine
 * Includes local PvP, heuristic-based PvNPC, undo system, and Web Audio synthesiser.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- GAME STATE ---
  let gameMode = 'PvP'; // 'PvP' or 'PvNPC'
  let npcDifficulty = 'expert'; // 'easy', 'expert', 'impossible'
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

  function playSynthSound(type) {
    if (!soundEnabled) return;
    try {
      initAudio();
      const now = audioCtx.currentTime;
      
      switch (type) {
        case 'click': {
          // Play a short, subtle UI click
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.08);
          break;
        }
        case 'place': {
          // Play a sharp, elastic move placement sound
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(250, now);
          osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.12);
          break;
        }
        case 'board-win': {
          // Play a quick ascending major triad arpeggio
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
          // Play a triumphant arpeggio and chord
          const chords = [
            [523.25, 659.25, 783.99], // C Major
            [587.33, 739.99, 880.00], // D Major
            [659.25, 830.61, 987.77]  // E Major
          ];
          chords.forEach((chord, chordIdx) => {
            chord.forEach((freq) => {
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(freq, now + chordIdx * 0.15);
              gain.gain.setValueAtTime(0.04, now + chordIdx * 0.15);
              gain.gain.linearRampToValueAtTime(0.001, now + chordIdx * 0.15 + 0.4);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start(now + chordIdx * 0.15);
              osc.stop(now + chordIdx * 0.15 + 0.4);
            });
          });
          break;
        }
        case 'defeat': {
          // Play a sad descending slide
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(300, now);
          osc.frequency.linearRampToValueAtTime(100, now + 0.6);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.6);
          
          // Filter to soften the sawtooth
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 600;

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.6);
          break;
        }
        case 'error': {
          // Play a short, low pitch warning buzz
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(110, now);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
          
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 220;

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.15);
          break;
        }
        case 'reset': {
          // Play a sweeping synthesizer swoosh
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
      }
    } catch (e) {
      console.warn('Audio play failed:', e);
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
  function triggerVisualImpact(intensity) {
    const boardWrapper = document.querySelector('.board-wrapper');
    const flashOverlay = document.getElementById('flash-overlay');
    if (!boardWrapper || !flashOverlay) return;

    // Reset impact classes
    boardWrapper.classList.remove('screenshake-mild', 'screenshake-strong', 'screenshake-victory');
    flashOverlay.classList.remove('flash-fast', 'flash-red', 'flash-victory');

    // Force reflow to restart animations
    void boardWrapper.offsetWidth;
    void flashOverlay.offsetWidth;

    if (intensity === 'mild') {
      boardWrapper.classList.add('screenshake-mild');
      flashOverlay.classList.add('flash-fast');
    } else if (intensity === 'strong') {
      boardWrapper.classList.add('screenshake-strong');
      flashOverlay.classList.add('flash-red');
    } else if (intensity === 'victory') {
      boardWrapper.classList.add('screenshake-victory');
      flashOverlay.classList.add('flash-victory');
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
  });

  pveBtn.addEventListener('click', () => {
    initAudio();
    playSynthSound('click');
    triggerHaptic('tap');
    gameMode = 'PvNPC';
    pveBtn.classList.add('active');
    pvpBtn.classList.remove('active');
    diffSelection.classList.remove('hidden');
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
    });
  });

  // Start Button Click
  startGameBtn.addEventListener('click', () => {
    initAudio();
    playSynthSound('place');
    triggerHaptic('tap');
    
    // Hide menu, show game board
    mainMenuView.classList.remove('active');
    gameView.classList.add('active');
    
    startGame();
  });

  // Continue Button Click
  continueGameBtn.addEventListener('click', () => {
    initAudio();
    playSynthSound('place');
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
  });

  closeRulesBtn.addEventListener('click', () => {
    playSynthSound('click');
    rulesModal.classList.remove('active');
  });

  rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) {
      rulesModal.classList.remove('active');
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
  });


  // --- GAME INITIALIZATION ---
  function startGame() {
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

    playSynthSound('place');
    triggerHaptic('tap');

    // Check if this move wins the mini-board
    if (check3x3Win(board[boardIndex], currentPlayer)) {
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
      triggerVisualImpact('strong');
    } 
    // Check if the mini-board tied
    else if (isMiniBoardFull(board[boardIndex])) {
      miniBoardsWon[boardIndex] = 'tie';
      const miniBoardEl = document.getElementById(`board-${boardIndex}`);
      miniBoardEl.classList.add('won-tie');
      triggerVisualImpact('mild');
    } else {
      triggerVisualImpact('mild');
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

    // Decide whether to play a "bad" blunder move based on difficulty
    let selectRandom = false;
    const roll = Math.random();
    
    if (npcDifficulty === 'easy') {
      selectRandom = (roll < 0.50); // 50% blunder
    } else if (npcDifficulty === 'expert') {
      selectRandom = (roll < 0.30); // 30% blunder
    } else if (npcDifficulty === 'impossible') {
      selectRandom = (roll < 0.10); // 10% blunder
    }

    let chosenMove;
    if (selectRandom) {
      // Pick random legal move
      const randomIdx = Math.floor(Math.random() * legalMoves.length);
      chosenMove = legalMoves[randomIdx];
    } else {
      // Compute best move using positional scoring heuristic
      chosenMove = findBestNpcMove(legalMoves);
    }

    if (chosenMove) {
      makeMove(chosenMove.boardIndex, chosenMove.cellIndex);
    }
  }

  // Evaluate moves based on win/block/positional scoring
  function findBestNpcMove(legalMoves) {
    let bestMove = null;
    let bestScore = -Infinity;

    legalMoves.forEach(move => {
      const score = evaluateNpcMove(move.boardIndex, move.cellIndex);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    });

    return bestMove;
  }

  // Scoring function for potential NPC moves
  function evaluateNpcMove(boardIndex, cellIndex) {
    let score = 0;
    
    // --- SIMULATE MOVE ---
    // Place move
    board[boardIndex][cellIndex] = 'O';
    let wonMini = false;
    let wonGame = false;
    
    // Check mini board win
    if (check3x3Win(board[boardIndex], 'O')) {
      wonMini = true;
      miniBoardsWon[boardIndex] = 'O';
      
      // Check large board win
      if (check3x3Win(miniBoardsWon, 'O')) {
        wonGame = true;
      }
    }
    
    // --- EVALUATIONS ---
    
    // 1. Instant game win is top priority
    if (wonGame) {
      score += 100000;
    }
    
    // 2. Win the mini-board
    if (wonMini && !wonGame) {
      score += 5000;
    }

    // --- REVERT SIMULATED MOVE (Stage 1) ---
    board[boardIndex][cellIndex] = '';
    if (wonMini) miniBoardsWon[boardIndex] = '';

    // --- SIMULATE OPPONENT BLOCK CHECK ---
    // Check if playing here blocks the player 'X' from winning this mini board
    board[boardIndex][cellIndex] = 'X';
    let playerWonMini = false;
    let playerWonGame = false;

    if (check3x3Win(board[boardIndex], 'X')) {
      playerWonMini = true;
      miniBoardsWon[boardIndex] = 'X';
      if (check3x3Win(miniBoardsWon, 'X')) {
        playerWonGame = true;
      }
    }

    // 3. Block opponent's instant game win
    if (playerWonGame) {
      score += 50000;
    }

    // 4. Block opponent's mini board win
    if (playerWonMini && !playerWonGame) {
      score += 2000;
    }

    // --- REVERT SIMULATED MOVE (Stage 2) ---
    board[boardIndex][cellIndex] = '';
    if (playerWonMini) miniBoardsWon[boardIndex] = '';

    // --- STRATEGIC TARGET BOARD ANALYSIS ---
    // Moving at cellIndex sends Player X to mini-board cellIndex.
    const targetBoard = cellIndex;
    
    // 5. Avoid sending opponent to wildcard state (target board won/full)
    if (miniBoardsWon[targetBoard] !== '' || isMiniBoardFull(board[targetBoard])) {
      score -= 3000; // Sending to wildcard is generally terrible
    } else {
      // Opponent is locked to targetBoard. Check its safety.
      
      // Let's count how close Player X is to winning targetBoard
      let xCloseToWin = checkCloseToWin(board[targetBoard], 'X');
      if (xCloseToWin) {
        // If we send them there, they can win it immediately! Very dangerous!
        score -= 2000;
      }
      
      // Check if we are close to winning targetBoard if they fail to play there
      let oCloseToWin = checkCloseToWin(board[targetBoard], 'O');
      if (oCloseToWin) {
        score += 200;
      }
    }

    // --- POSITIONAL STRATEGY ---
    
    // 6. Prefer center and corners in the mini-board
    if (cellIndex === 4) {
      score += 15; // Center
    } else if ([0, 2, 6, 8].includes(cellIndex)) {
      score += 8; // Corners
    } else {
      score += 2; // Edges
    }

    // 7. Prefer playing in center and corners on the large board
    if (boardIndex === 4) {
      score += 30; // Center board
    } else if ([0, 2, 6, 8].includes(boardIndex)) {
      score += 15; // Corner boards
    } else {
      score += 5; // Edge boards
    }

    // 8. Set up a 2-in-a-row inside this mini-board
    if (createsTwoInARow(board[boardIndex], cellIndex, 'O')) {
      score += 100;
    }

    // 9. Block opponent's 2-in-a-row setups
    if (createsTwoInARow(board[boardIndex], cellIndex, 'X')) {
      score += 50;
    }

    // Add small random noise to prevent predictable/repetitive play
    score += Math.random() * 5;

    return score;
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

  // Helper: Checks if playing in cellIndex would create a 2-in-a-row for player
  function createsTwoInARow(grid3x3, cellIndex, symbol) {
    // Temporarily place
    grid3x3[cellIndex] = symbol;
    
    let isTwo = WIN_LINES.some(line => {
      if (!line.includes(cellIndex)) return false;
      let countSymbol = 0;
      let countEmpty = 0;
      line.forEach(idx => {
        if (grid3x3[idx] === symbol) countSymbol++;
        else if (grid3x3[idx] === '') countEmpty++;
      });
      return (countSymbol === 2 && countEmpty === 1);
    });

    // Revert
    grid3x3[cellIndex] = '';
    return isTwo;
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
    gameActive = state.gameActive !== undefined ? state.gameActive : false;
    winner = state.winner || null;
    gameMode = state.gameMode || 'PvP';
    npcDifficulty = state.npcDifficulty || 'expert';

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
});
