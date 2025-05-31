let board;
let game = new Chess();
let selectedSquare = null;

// 从URL参数读取玩家执棋方，默认白色
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}
let playerColor = getQueryParam('color') || 'white';

window.onload = () => {
  const boardEl = document.getElementById('board');
  const colorSelect = document.getElementById('colorSelect');
  const sizeRange = document.getElementById('sizeRange');
  const sizeValue = document.getElementById('sizeValue');

  // 同步下拉框显示当前playerColor
  if (colorSelect) {
    colorSelect.value = playerColor;
    colorSelect.addEventListener('change', (e) => {
      playerColor = e.target.value;
      resetGame();
    });
  }

  initBoard();

  boardEl.addEventListener('touchmove', e => {
    e.preventDefault();
  }, { passive: false });

  if (sizeRange && sizeValue) {
    sizeRange.addEventListener('input', e => {
      const size = e.target.value;
      sizeValue.textContent = size;
      boardEl.style.width = size + 'px';
      board.resize();
    });
  }
};

// 初始化棋盘
function initBoard() {
  board = Chessboard('board', {
    draggable: true,
    position: 'start',
    orientation: playerColor,
    onDrop,
    onSnapEnd: () => board.position(game.fen()),
    onSquareClick: onSquareClick,
    onDragStart: onDragStart,
  });

  // 玩家执黑，AI执白，AI先走
  if (playerColor === 'black') {
    setTimeout(makeAIMove, 500);
  }
}

// 拖动开始限制
function onDragStart(source, piece, position, orientation) {
  if (game.game_over()) return false;
  if (game.turn() !== playerColor[0]) return false;
  if ((playerColor === 'white' && !piece.startsWith('w')) ||
      (playerColor === 'black' && !piece.startsWith('b'))) {
    return false;
  }
}

// 拖动走棋
function onDrop(source, target) {
  if (game.turn() !== playerColor[0]) return 'snapback';

  const move = game.move({ from: source, to: target, promotion: 'q' });
  if (move === null) return 'snapback';

  board.position(game.fen());
  setTimeout(makeAIMove, 250);
}

// 点击走棋
function onSquareClick(square) {
  if (game.turn() !== playerColor[0]) return;

  const piece = game.get(square);
  if (selectedSquare === null) {
    if (piece && piece.color === game.turn()) {
      selectedSquare = square;
      highlightSquare(square);
    }
  } else {
    if (square === selectedSquare) {
      selectedSquare = null;
      removeHighlight();
    } else {
      const move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
      if (move === null) {
        if (piece && piece.color === game.turn()) {
          selectedSquare = square;
          highlightSquare(square);
        } else {
          selectedSquare = null;
          removeHighlight();
        }
      } else {
        board.position(game.fen());
        selectedSquare = null;
        removeHighlight();
        setTimeout(makeAIMove, 250);
      }
    }
  }
}

// 高亮格子
function highlightSquare(square) {
  removeHighlight();
  const squareEl = document.querySelector(`#board .square-${square}`);
  if (squareEl) {
    squareEl.style.background = 'rgba(255, 255, 0, 0.6)';
  }
}

function removeHighlight() {
  document.querySelectorAll('#board .square-55d63').forEach(el => {
    el.style.background = '';
  });
}

// AI走棋
function makeAIMove() {
  if (game.game_over()) return;

  const fen = game.fen();
  fetch('/move', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ fen })
  })
  .then(res => res.json())
  .then(data => {
    if (data.best_move) {
      game.move({ from: data.best_move.slice(0, 2), to: data.best_move.slice(2, 4), promotion: 'q' });
      board.position(game.fen());
    } else if (data.error) {
      console.error("AI 错误：", data.error);
    }
  })
  .catch(err => console.error("请求AI失败：", err));
}

// 重置游戏
function resetGame() {
  game.reset();
  selectedSquare = null;
  board.destroy();
  initBoard();
}