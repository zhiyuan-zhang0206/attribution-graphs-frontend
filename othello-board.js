/**
 * Othello board visualization for the Circuit Tracer frontend.
 *
 * Provides:
 *  - OthelloGame: minimal game engine (replay moves, compute legal moves)
 *  - initOthelloBoard: renders an interactive SVG board into a container
 *
 * Token format: numeric index only (e.g. "8", "22"). Each index = row * boardSize + col.
 */

// ── Othello Game Engine ─────────────────────────────────────────────
window.OthelloGame = (function () {
  var EMPTY = 0, BLACK = 1, WHITE = 2
  var DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]

  function create(boardSize) {
    boardSize = boardSize || 6
    var passMove = boardSize * boardSize
    var board = []
    for (var i = 0; i < boardSize; i++) {
      board[i] = []
      for (var j = 0; j < boardSize; j++) board[i][j] = EMPTY
    }
    var c = boardSize / 2
    board[c-1][c-1] = WHITE
    board[c-1][c]   = BLACK
    board[c][c-1]   = BLACK
    board[c][c]     = WHITE

    var currentPlayer = BLACK
    var moveHistory = []

    function inBounds(r, c) { return r >= 0 && r < boardSize && c >= 0 && c < boardSize }
    function opponent(p) { return p === BLACK ? WHITE : BLACK }

    function getFlips(row, col, player) {
      if (board[row][col] !== EMPTY) return []
      var opp = opponent(player)
      var allFlips = []
      for (var d = 0; d < DIRS.length; d++) {
        var dr = DIRS[d][0], dc = DIRS[d][1]
        var r = row + dr, cc = col + dc
        var flips = []
        while (inBounds(r, cc) && board[r][cc] === opp) {
          flips.push([r, cc])
          r += dr; cc += dc
        }
        if (flips.length > 0 && inBounds(r, cc) && board[r][cc] === player) {
          allFlips = allFlips.concat(flips)
        }
      }
      return allFlips
    }

    function getLegalMoves() {
      var moves = []
      for (var r = 0; r < boardSize; r++) {
        for (var cc = 0; cc < boardSize; cc++) {
          if (getFlips(r, cc, currentPlayer).length > 0) {
            moves.push(r * boardSize + cc)
          }
        }
      }
      if (moves.length === 0) moves.push(passMove)
      return moves
    }

    function applyMove(moveIdx) {
      if (moveIdx === passMove) {
        currentPlayer = opponent(currentPlayer)
        moveHistory.push(moveIdx)
        return
      }
      var row = Math.floor(moveIdx / boardSize)
      var col = moveIdx % boardSize
      var flips = getFlips(row, col, currentPlayer)
      board[row][col] = currentPlayer
      for (var i = 0; i < flips.length; i++) {
        board[flips[i][0]][flips[i][1]] = currentPlayer
      }
      currentPlayer = opponent(currentPlayer)
      moveHistory.push(moveIdx)
    }

    return {
      board: board,
      boardSize: boardSize,
      passMove: passMove,
      applyMove: applyMove,
      getLegalMoves: getLegalMoves,
      getCurrentPlayer: function() { return currentPlayer },
      getMoveHistory: function() { return moveHistory.slice() },
      EMPTY: EMPTY, BLACK: BLACK, WHITE: WHITE
    }
  }

  /**
   * Replay a sequence of numeric move tokens up to `upTo` moves.
   * `tokens` is the prompt_tokens array: ["BOS", "8", "7", ...].
   */
  function replay(tokens, upTo, boardSize) {
    var game = create(boardSize)
    var lastMove = null
    var n = Math.min(upTo, tokens.length - 1)
    for (var i = 1; i <= n; i++) {
      var tok = tokens[i]
      if (tok === 'BOS' || tok === 'EOS') continue
      var moveIdx = parseInt(tok, 10)
      if (isNaN(moveIdx)) continue
      game.applyMove(moveIdx)
      lastMove = moveIdx
    }
    return {game: game, lastMove: lastMove}
  }

  return {create: create, replay: replay, EMPTY: 0, BLACK: 1, WHITE: 2}
})()


// ── Board Renderer ──────────────────────────────────────────────────
window.initOthelloBoard = function (containerSel, tokens, currentPos, boardSize) {
  boardSize = boardSize || 6

  var {game, lastMove} = OthelloGame.replay(tokens, currentPos, boardSize)
  var legalMoves = game.getLegalMoves()
  var legalSet = new Set(legalMoves)
  var player = game.getCurrentPlayer()

  var cellSize = 44
  var totalW = cellSize * boardSize
  var totalH = cellSize * boardSize

  var svg = containerSel.append('svg')
    .attr('viewBox', '0 0 ' + totalW + ' ' + totalH)
    .style('width', '100%')
    .style('max-width', totalW + 'px')
    .style('height', 'auto')

  // Board background
  svg.append('rect')
    .attr('width', totalW).attr('height', totalH)
    .attr('fill', '#2e8b57').attr('rx', 3)

  // Grid lines
  for (var i = 0; i <= boardSize; i++) {
    svg.append('line')
      .attr('x1', i * cellSize).attr('y1', 0)
      .attr('x2', i * cellSize).attr('y2', totalH)
      .attr('stroke', '#1a6b3a').attr('stroke-width', 1)
    svg.append('line')
      .attr('x1', 0).attr('y1', i * cellSize)
      .attr('x2', totalW).attr('y2', i * cellSize)
      .attr('stroke', '#1a6b3a').attr('stroke-width', 1)
  }

  // ── Cells ──
  for (var r = 0; r < boardSize; r++) {
    for (var cc = 0; cc < boardSize; cc++) {
      var moveIdx = r * boardSize + cc
      var cx = cc * cellSize + cellSize / 2
      var cy = r * cellSize + cellSize / 2
      var val = game.board[r][cc]

      // Last move highlight
      if (moveIdx === lastMove) {
        svg.append('rect')
          .attr('x', cc * cellSize + 1).attr('y', r * cellSize + 1)
          .attr('width', cellSize - 2).attr('height', cellSize - 2)
          .attr('fill', 'rgba(255, 255, 0, 0.3)').attr('rx', 2)
      }

      // Pieces
      if (val === OthelloGame.BLACK) {
        svg.append('circle')
          .attr('cx', cx).attr('cy', cy)
          .attr('r', cellSize / 2 - 4)
          .attr('fill', '#111').attr('stroke', '#333').attr('stroke-width', 1)
      } else if (val === OthelloGame.WHITE) {
        svg.append('circle')
          .attr('cx', cx).attr('cy', cy)
          .attr('r', cellSize / 2 - 4)
          .attr('fill', '#f0f0f0').attr('stroke', '#aaa').attr('stroke-width', 1)
      }

      // Legal move indicator
      if (legalSet.has(moveIdx) && val === OthelloGame.EMPTY) {
        svg.append('circle')
          .attr('cx', cx).attr('cy', cy).attr('r', 6)
          .attr('fill', player === OthelloGame.BLACK ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)')
      }

      // Index overlay — light text on every cell
      var hasStone = val !== OthelloGame.EMPTY
      svg.append('text')
        .attr('x', cx).attr('y', cy + (hasStone ? 0 : 1))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', hasStone ? '9px' : '11px')
        .attr('font-family', 'monospace')
        .attr('fill', hasStone
          ? (val === OthelloGame.BLACK ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)')
          : 'rgba(255,255,255,0.35)')
        .attr('pointer-events', 'none')
        .text(moveIdx)
    }
  }

  // ── Info ──
  var info = containerSel.append('div')
    .style('font-size', '12px')
    .style('color', '#555')
    .style('margin-top', '6px')
    .style('font-family', 'system-ui, sans-serif')
    .style('line-height', '1.6')

  var moveNum = currentPos
  var totalMoves = tokens.length - 1
  var legalCount = legalMoves.filter(function(m) { return m !== game.passMove }).length
  var isPass = legalMoves.length === 1 && legalMoves[0] === game.passMove

  info.append('div').html(
    '<b>Move:</b> ' + moveNum + ' / ' + totalMoves +
    '&nbsp;&nbsp;' +
    '<b>Next:</b> ' + (player === OthelloGame.BLACK ? '● Black' : '○ White') +
    '&nbsp;&nbsp;' +
    '<b>Legal:</b> ' + legalCount + (isPass ? ' (pass)' : '')
  )

  var blackCount = 0, whiteCount = 0
  for (var r = 0; r < boardSize; r++) {
    for (var cc = 0; cc < boardSize; cc++) {
      if (game.board[r][cc] === OthelloGame.BLACK) blackCount++
      if (game.board[r][cc] === OthelloGame.WHITE) whiteCount++
    }
  }
  info.append('div').html('● ' + blackCount + ' &nbsp; ○ ' + whiteCount)

  if (lastMove !== null && lastMove !== game.passMove) {
    info.append('div').html('<b>Last move:</b> ' + lastMove)
  }
}
