// game_online.js

const socket = io();

// 获取房间号，优先从 URL 参数，其次从 localStorage
const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get("room") || localStorage.getItem("room");

// 无效房间处理
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
let dropLock = false; // 防止 onDrop 多次触发

window.boardInitialized = false;

/**
 * 初始化棋盘
 * @param {string} playerColor - 'white' 或 'black'
 */
function initBoard(playerColor) {
  if (window.boardInitialized) {
    // 如果已经初始化，只切换棋盘方向和重置棋盘显示
    board.orientation(playerColor);
    board.position(game.fen());
    return;
  }
  board = Chessboard('board', {
    draggable: true,
    position: 'start',
    orientation: playerColor,
    onDrop: onDrop,
    moveSpeed: 'fast',
    snapbackSpeed: 100,
    snapSpeed: 80,
    pieceTheme: '/static/img/chesspieces/wikipedia/{piece}.png',
  });
  window.boardInitialized = true;
}

/**
 * 更新玩家状态显示
 * @param {Array} players - 玩家列表，包含 color 和 ready 属性
 */
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

/**
 * 更新游戏状态栏和按钮状态
 */
function updateStatus() {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;

  if (game.in_checkmate()) {
    statusEl.textContent = `将死！游戏结束。你${isMyTurn ? "输了" : "赢了"}`;
  } else if (game.in_draw() || game.in_stalemate() || game.insufficient_material()) {
    statusEl.textContent = "平局。";
  } else if (game.in_check()) {
    statusEl.textContent = isMyTurn ? "你的回合（被将军）" : "对方回合（你将军）";
  } else {
    statusEl.textContent = isMyTurn ? "你的回合" : "对方回合";
  }

  const restartBtn = document.getElementById("restartBtn");
  if (restartBtn) {
    restartBtn.disabled = !game.game_over();
  }
}

/**
 * 下棋动作回调，防止重复触发，判断合法性并同步给服务器
 * @param {string} source 起始格
 * @param {string} target 目标格
 * @returns {string|undefined} 返回 'snapback' 表示非法走子回退
 */
function onDrop(source, target) {
  if (!gameStarted || !isMyTurn || game.game_over()) return 'snapback';

  if (dropLock) return 'snapback'; // 防止多次触发
  dropLock = true;

  // 尝试走子
  const move = game.move({ from: source, to: target, promotion: 'q' });
  if (!move) {
    dropLock = false; // 走子失败时释放锁
    return 'snapback';
  }

  // 更新棋盘显示
  board.position(game.fen());

  // 发送走子给服务器
  socket.emit('move', { room, move });

  isMyTurn = false;
  updateStatus();

  // 放开锁，允许下次走子
  setTimeout(() => { dropLock = false; }, 300);

  return;
}

// socket 事件绑定和容错处理
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

    // 对方走子：用服务器数据走棋
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

// 绑定重新开始按钮事件
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

// 初始化所有逻辑
function main() {
  setupSocketListeners();
  setupRestartButton();
}

main();

/**
 * 对外暴露初始化函数，用于外部调用，传入房间号
 * @param {string} roomId
 */
function connectGame(roomId) {
  // 可以加逻辑确认 roomId 与当前 room 是否一致，或者重新连接
  // 这里只演示简单版
  console.log(`连接游戏，房间号：${roomId}`);
}

window.connectGame = connectGame;