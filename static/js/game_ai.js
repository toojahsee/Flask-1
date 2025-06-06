// 假设 game-common.js 已引入

let aiThinking = false;

window.onload = () => {
  playerColor = localStorage.getItem('color') || 'white';
  game.reset();
  initBoard(onDropAI, onSquareClickAI);

  if (playerColor === 'black') {
    setTimeout(() => makeAIMove(), 500);
  }

  updateStatus('游戏开始，等待你的操作');
};

function onDropAI(source, target) {
  if (game.game_over()) return 'snapback';
  if (game.turn() !== playerColor[0]) return 'snapback';

  const move = game.move({ from: source, to: target, promotion: 'q' });
  if (move === null) return 'snapback';

  board.position(game.fen());
  updateStatus('等待 AI 思考...');

  setTimeout(() => makeAIMove(), 300);
}

function onSquareClickAI(square) {
  if (game.game_over()) return;

  if (game.turn() !== playerColor[0]) return;

  const piece = game.get(square);

  if (!selectedSquare) {
    if (piece && piece.color === game.turn()) {
      selectedSquare = square;
      highlightSquare(square);
    }
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
      updateStatus('等待 AI 思考...');
      setTimeout(() => makeAIMove(), 300);
    }
  }
}

function makeAIMove() {
  if (aiThinking || game.game_over()) return;

  aiThinking = true;
  fetch('/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen: game.fen(), mode: 'ai' })
  })
    .then(res => res.json())
    .then(data => {
      aiThinking = false;
      if (data.best_move) {
        const move = {
          from: data.best_move.slice(0, 2),
          to: data.best_move.slice(2, 4),
          promotion: 'q'
        };
        game.move(move);
        board.position(game.fen());
        updateStatus('你的回合');
      } else {
        updateStatus('AI 无法走棋');
      }
    })
    .catch(err => {
      aiThinking = false;
      updateStatus('AI 请求失败');
      console.error(err);
    });
}