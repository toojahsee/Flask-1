const socket = io();

// 获取房间号
const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get("room") || localStorage.getItem("room");

if (!room) {
  alert("无效房间，请返回主页重新进入。");
  window.location.href = "/";
}
localStorage.setItem("room", room);

let board = null;
let game = new Chess();
let color = null;
let isMyTurn = false;
let gameStarted = false;
let dropLock = false;
window.boardInitialized = false;

// 从 HTML 获取音效和动画资源路径
const lightningGifPath = document.getElementById('lightningGifPath')?.getAttribute('data-src') || '/static/img/effects/lightning.gif';
const lightningAudioPath = document.getElementById('lightningAudioPath')?.getAttribute('data-src') || '/static/audio/lightning.mp3';

const lightningAudio = new Audio(lightningAudioPath);
lightningAudio.volume = 0.8;

window.setDraggingState = function (isDragging) {
  console.log("拖动状态：", isDragging);
};

function initBoard(playerColor) {
  if (window.boardInitialized) {
    board.orientation(playerColor);
    board.position(game.fen());
    return;
  }

  board = Chessboard('board', {
    draggable: true,
    position: 'start',
    orientation: playerColor,
    onDrop: onDrop,
    onDragStart: onDragStartWithGhost,
    moveSpeed: 'fast',
    snapbackSpeed: 100,
    snapSpeed: 80,
    pieceTheme: '/static/img/chesspieces/wikipedia/{piece}.png',
  });

  window.boardInitialized = true;
}

function onDragStartWithGhost(source, piece, position, orientation) {
  window.setDraggingState?.(true);
  const draggedPiece = document.querySelector('.chessboard-piece-being-dragged');
  if (draggedPiece) {
    const ghost = draggedPiece.cloneNode(true);
    ghost.classList.add('ghost-piece');
    ghost.style.opacity = '0.3';
    ghost.style.pointerEvents = 'none';
    draggedPiece.parentNode.appendChild(ghost);
  }
}

function updatePlayerStatus(players = []) {
  const findPlayer = color => players.find(p => p.color === color);
  ['white', 'black'].forEach(c => {
    const player = findPlayer(c);
    const statusEl = document.getElementById(`${c}-status`);
    if (!statusEl) return;
    if (!player) {
      statusEl.textContent = '等待中...';
      statusEl.style.color = '';
    } else {
      statusEl.textContent = player.ready ? '已就绪' : '已加入';
      statusEl.style.color = player.ready ? 'green' : '';
    }
  });
}

function showCheckEffect() {
  const kingSquare = findKingSquare(game, color);
  if (!kingSquare) return;

  const squareEl = document.querySelector(`.square-${kingSquare}`);
  if (!squareEl) return;

  const lightning = document.createElement('img');
  lightning.src = lightningGifPath;
  lightning.className = 'lightning-effect';
  lightning.style.position = 'absolute';
  lightning.style.top = '0';
  lightning.style.left = '0';
  lightning.style.width = '100%';
  lightning.style.height = '100%';
  lightning.style.zIndex = '9';
  lightning.style.pointerEvents = 'none';

  squareEl.appendChild(lightning);
  lightningAudio.currentTime = 0;
  lightningAudio.play();

  setTimeout(() => {
    lightning.remove();
  }, 1000);
}

function findKingSquare(gameInstance, playerColor) {
  const boardState = gameInstance.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = boardState[rank][file];
      if (piece && piece.type === 'k' && piece.color === playerColor[0]) {
        const fileChar = 'abcdefgh'[file];
        const rankChar = (8 - rank).toString();
        return fileChar + rankChar;
      }
    }
  }
  return null;
}

function updateStatus() {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;

  if (game.in_checkmate()) {
    statusEl.textContent = `将死！游戏结束。你${isMyTurn ? "输了" : "赢了"}`;
  } else if (game.in_draw() || game.in_stalemate() || game.insufficient_material()) {
    statusEl.textContent = "平局。";
  } else if (game.in_check()) {
    statusEl.textContent = isMyTurn ? "你的回合（被将军）" : "对方回合（你将军）";
    if (isMyTurn) {
      showCheckEffect();
    }
  } else {
    statusEl.textContent = isMyTurn ? "你的回合" : "对方回合";
  }

  const restartBtn = document.getElementById("restartBtn");
  if (restartBtn) {
    restartBtn.disabled = !game.game_over();
  }
}

function onDrop(source, target) {
  if (!gameStarted || !isMyTurn || game.game_over()) {
    window.setDraggingState?.(false);
    return 'snapback';
  }

  if (dropLock) {
    window.setDraggingState?.(false);
    return 'snapback';
  }

  dropLock = true;

  const move = game.move({ from: source, to: target, promotion: 'q' });
  if (!move) {
    dropLock = false;
    window.setDraggingState?.(false);
    return 'snapback';
  }

  board.position(game.fen());
  socket.emit('move', { room, move });

  isMyTurn = false;
  updateStatus();

  setTimeout(() => { dropLock = false; }, 300);
  window.setDraggingState?.(false);
}

function setupSocketListeners() {
  socket.on("connect", () => {
    socket.emit('join', { room });
    console.log(`[Socket] 已连接，加入房间 ${room}`);
  });

  socket.on('joined', (data) => {
    color = data.your_color;
    if (!color) {
      alert("房间已满或服务器错误，未分配颜色。");
      window.location.href = "/";
      return;
    }

    localStorage.setItem("color", color);
    initBoard(color);

    gameStarted = data.ready;
    isMyTurn = (color === "white" && gameStarted);

    document.getElementById('status').textContent = `你是 ${color === "white" ? "白棋" : "黑棋"}`;
    document.getElementById('restartBtn').disabled = true;

    updatePlayerStatus(data.players);
    updateStatus();
  });

  socket.on("player_joined", (data) => {
    updatePlayerStatus(data.players);
  });

  socket.on('ready', (data) => {
    if (!data || !data.color) return;
    const statusEl = document.getElementById(`${data.color}-status`);
    if (statusEl) {
      statusEl.textContent = '已就绪';
      statusEl.style.color = 'green';
    }
  });

  socket.on("player_left", (data) => {
    updatePlayerStatus(data.players);
    document.getElementById("status").textContent = "对手已离开房间。";
    gameStarted = false;
    document.getElementById('restartBtn').disabled = true;
  });

  socket.on('start', (data) => {
    initBoard(color);
    game.reset();
    board.start();
    gameStarted = true;
    isMyTurn = (color === 'white');

    updatePlayerStatus(data.players);
    document.getElementById('status').textContent = `对局开始！你执 ${color === 'white' ? '白棋' : '黑棋'}`;
    updateStatus();
    document.getElementById('restartBtn').disabled = true;
  });

  socket.on('move', (data) => {
    if (!data || !data.move) return;
    const moveResult = game.move(data.move);
    if (moveResult) {
      board.position(game.fen());
      isMyTurn = true;
      updateStatus();
    } else {
      console.error("[Error] 收到无效走子：", data.move);
    }
  });

  socket.on('opponent_left', () => {
    document.getElementById('status').textContent = "对手已离开房间。";
    gameStarted = false;
    document.getElementById('restartBtn').disabled = true;
  });

  socket.on('restart', () => {
    game.reset();
    board.start();
    isMyTurn = (color === "white");
    gameStarted = true;
    updateStatus();
  });

  socket.on('room_full', (data) => {
    alert(data.message || "房间已满或错误，请稍后再试。");
    window.location.href = "/";
  });

  socket.on('error', (err) => {
    console.error('[Socket Error]', err);
  });

  socket.on('disconnect', (reason) => {
    console.warn(`[Socket] 断开连接: ${reason}`);
  });
}

function setupRestartButton() {
  const restartBtn = document.getElementById("restartBtn");
  if (!restartBtn) return;

  restartBtn.addEventListener("click", () => {
    if (!confirm("确定要重新开始游戏吗？")) return;

    game.reset();
    board.start();
    isMyTurn = (color === "white");
    gameStarted = true;
    updateStatus();

    socket.emit('restart', { room });
  });
}

function main() {
  setupSocketListeners();
  setupRestartButton();
}

main();

function connectGame(roomId) {
  console.log(`连接游戏，房间号：${roomId}`);
}
window.connectGame = connectGame;