let board = null;
let game = new Chess();
let selectedSquare = null;
window.boardInitialized = false; // 全局变量声明
let playerColor = localStorage.getItem('color') || 'white';

function initBoard(onDropCallback, onClickCallback) {
  board = Chessboard('board', {
    draggable: true,
    position: 'start',
    orientation: playerColor,
    onDrop: onDropCallback,
    onSnapEnd: () => board.position(game.fen()),
    onSquareClick: onClickCallback,
    onDragStart: onDragStart,
  });
  window.boardInitialized = true;
}

function onDragStart(source, piece) {
  if (game.game_over()) return false;
  if (game.turn() !== playerColor[0]) return false;
  if ((playerColor === 'white' && !piece.startsWith('w')) ||
      (playerColor === 'black' && !piece.startsWith('b'))) {
    return false;
  }
}

function highlightSquare(square) {
  removeHighlight();
  const squareEl = document.querySelector(`#board .square-${square}`);
  if (squareEl) squareEl.classList.add('highlight');
}

function removeHighlight() {
  document.querySelectorAll('#board .square.highlight').forEach(el => {
    el.classList.remove('highlight');
  });
}

function updateStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}