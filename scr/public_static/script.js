let board;
let game = new Chess();
let selectedSquare = null; // 当前选中的格子

window.onload = () => {
  const boardEl = document.getElementById('board');
  const sizeRange = document.getElementById('sizeRange');
  const sizeValue = document.getElementById('sizeValue');

  board = Chessboard('board', {
    draggable: true,
    position: 'start',
    pieceTheme: '/static/img/chesspieces/wikipedia/{piece}.png', // ✅ 设置棋子图像路径
    onDrop: onDrop,
    onSnapEnd: () => board.position(game.fen()),
    onSquareClick: onSquareClick,
  });

  // 防止移动端拖动棋盘时页面滚动
  boardEl.addEventListener('touchmove', e => {
    e.preventDefault();
  }, { passive: false });

  // 监听滑块调整棋盘大小（如果有）
  if (sizeRange && sizeValue) {
    sizeRange.addEventListener('input', e => {
      const size = e.target.value;
      sizeValue.textContent = size;
      boardEl.style.width = size + 'px';
      board.resize();
    });
  }
};

// 拖动走棋事件
function onDrop(source, target) {
  const move = game.move({
    from: source,
    to: target,
    promotion: 'q' // 自动升变为皇后
  });

  if (move === null) return 'snapback';

  board.position(game.fen());
  setTimeout(makeAIMove, 250);
}

// 点击格子走棋逻辑
function onSquareClick(square) {
  const piece = game.get(square);

  if (selectedSquare === null) {
    // 第一次点击，选中棋子
    if (piece && piece.color === game.turn()) {
      selectedSquare = square;
      highlightSquare(square);
    }
  } else {
    // 再次点击（尝试移动）
    if (square === selectedSquare) {
      selectedSquare = null;
      removeHighlight();
    } else {
      const move = game.move({
        from: selectedSquare,
        to: square,
        promotion: 'q'
      });

      if (move === null) {
        // 如果非法移动但点到其他自己的棋子，就切换选择
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

// 移除高亮
function removeHighlight() {
  document.querySelectorAll('#board .square-55d63').forEach(el => {
    el.style.background = '';
  });
}

// AI 走棋（从后端获取 best move）
function makeAIMove() {
  const fen = game.fen();

  fetch('/move', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fen })
  })
    .then(res => res.json())
    .then(data => {
      if (data.best_move) {
        game.move({
          from: data.best_move.slice(0, 2),
          to: data.best_move.slice(2, 4),
          promotion: 'q'
        });
        board.position(game.fen());
      } else if (data.error) {
        console.error("AI 错误：", data.error);
      }
    })
    .catch(err => {
      console.error("请求AI失败：", err);
    });
}