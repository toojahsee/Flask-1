let board;
let game = new Chess();

let selectedSquare = null; // 记录点击选中的棋子格子

window.onload = () => {
  const boardEl = document.getElementById('board');
  const sizeRange = document.getElementById('sizeRange');
  const sizeValue = document.getElementById('sizeValue');

  board = Chessboard('board', {
    draggable: true,
    position: 'start',
    onDrop,
    onSnapEnd: () => board.position(game.fen()),
    onSquareClick: onSquareClick,
  });

  // 防止移动端拖动棋盘时页面滚动
  boardEl.addEventListener('touchmove', e => {
    e.preventDefault();
  }, { passive: false });

  // 监听滑块调整棋盘大小
  sizeRange.addEventListener('input', e => {
    const size = e.target.value;
    sizeValue.textContent = size;
    boardEl.style.width = size + 'px';
    board.resize();
  });
};

// 拖动走棋事件
function onDrop(source, target) {
  const move = game.move({ from: source, to: target, promotion: 'q' });
  if (move === null) return 'snapback';

  board.position(game.fen());
  setTimeout(makeAIMove, 250);
}

// 点击走棋逻辑（增强版）
function onSquareClick(square) {
  const piece = game.get(square);

  if (selectedSquare === null) {
    // 没有选中棋子，点击己方棋子则选中
    if (piece && piece.color === game.turn()) {
      selectedSquare = square;
      highlightSquare(square);
    }
  } else {
    if (square === selectedSquare) {
      // 点击同一格，取消选中
      selectedSquare = null;
      removeHighlight();
    } else {
      // 尝试走棋
      const move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
      if (move === null) {
        // 非法走法，尝试切换选中到新格（如果是己方棋子）
        if (piece && piece.color === game.turn()) {
          selectedSquare = square;
          highlightSquare(square);
        } else {
          // 否则取消选中
          selectedSquare = null;
          removeHighlight();
        }
      } else {
        // 走棋成功，更新棋盘并取消选中
        board.position(game.fen());
        selectedSquare = null;
        removeHighlight();

        // AI回应
        setTimeout(makeAIMove, 250);
      }
    }
  }
}

// 高亮选中格子
function highlightSquare(square) {
  removeHighlight();
  const squareEl = document.querySelector(`#board .square-${square}`);
  if (squareEl) {
    squareEl.style.background = 'rgba(255, 255, 0, 0.6)';
  }
}

// 移除所有高亮
function removeHighlight() {
  document.querySelectorAll('#board .square-55d63').forEach(el => {
    el.style.background = '';
  });
}

// AI 走棋（调用后端）
function makeAIMove() {
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