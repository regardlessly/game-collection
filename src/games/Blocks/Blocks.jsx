import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { GameShell } from '../../components/GameShell/GameShell';
import { useGameCallback } from '../../hooks/useGameCallback';
import styles from './Blocks.module.css';

// ── Board parsing ──────────────────────────────────────────────────
function parseBoard(str) {
  const rows = str.split('|');
  const cells = new Set();
  const numRows = rows.length;
  let numCols = 0;
  for (let r = 0; r < numRows; r++) {
    numCols = Math.max(numCols, rows[r].length);
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === '1') cells.add(`${r},${c}`);
    }
  }
  return { cells, rows: numRows, cols: numCols };
}

function dims(cells) {
  let maxR = 0, maxC = 0;
  for (const [r, c] of cells) { maxR = Math.max(maxR, r); maxC = Math.max(maxC, c); }
  return { rows: maxR + 1, cols: maxC + 1 };
}

// ── Colour palette ─────────────────────────────────────────────────
const COLORS = [
  '#3b7fd4', '#d4a017', '#388e3c', '#7b3fa0', '#0097a7',
  '#c62828', '#e67e22', '#2e7d32', '#8e24aa', '#00838f',
];
const LABELS = [
  'Blue', 'Yellow', 'Green', 'Purple', 'Cyan',
  'Red', 'Orange', 'Forest', 'Violet', 'Teal',
];

// ── Puzzle definitions (all built by placing pieces first → board derived) ──
// Each piece has `cells` (relative offsets) and `solution` [anchorRow, anchorCol].
const RAW_PUZZLES = [
  // P0 — 4×5 rectangle (20 cells, 5 pieces)
  {
    board: '11111|11111|11111|11111',
    pieces: [
      { cells: [[0,0],[0,1],[1,0],[1,1]],                         solution: [0,0] }, // 2×2
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],             solution: [0,2] }, // 2×3
      { cells: [[0,0],[0,1],[1,0],[1,1]],                         solution: [2,0] }, // 2×2
      { cells: [[0,0],[0,1],[1,0],[1,1]],                         solution: [2,2] }, // 2×2
      { cells: [[0,0],[1,0]],                                     solution: [2,4] }, // 2×1 vert
    ],
  },
  // P1 — 4×6 rectangle (24 cells, 4 pieces)
  {
    board: '111111|111111|111111|111111',
    pieces: [
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], solution: [0,0] },
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], solution: [0,3] },
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], solution: [2,0] },
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], solution: [2,3] },
    ],
  },
  // P2 — 3×6 rectangle (18 cells, 6 pieces)
  {
    board: '111111|111111|111111',
    pieces: [
      { cells: [[0,0],[0,1],[1,0],[1,1]], solution: [0,0] },
      { cells: [[0,0],[0,1],[1,0],[1,1]], solution: [0,2] },
      { cells: [[0,0],[0,1],[1,0],[1,1]], solution: [0,4] },
      { cells: [[0,0],[0,1]],             solution: [2,0] },
      { cells: [[0,0],[0,1]],             solution: [2,2] },
      { cells: [[0,0],[0,1]],             solution: [2,4] },
    ],
  },
  // P3 — 5×4 rectangle (20 cells, 5 pieces)
  {
    board: '1111|1111|1111|1111|1111',
    pieces: [
      { cells: [[0,0],[0,1],[1,0],[1,1]],             solution: [0,0] },
      { cells: [[0,0],[0,1],[1,0],[1,1]],             solution: [0,2] },
      { cells: [[0,0],[0,1],[0,2],[0,3]],             solution: [2,0] }, // 1×4 bar
      { cells: [[0,0],[0,1],[1,0],[1,1]],             solution: [3,0] },
      { cells: [[0,0],[0,1],[1,0],[1,1]],             solution: [3,2] },
    ],
  },
  // P4 — L-shape (21 cells, 4 pieces)
  {
    board: '111111|111111|111111|111...',
    pieces: [
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], solution: [0,0] },
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], solution: [0,3] },
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], solution: [2,0] },
      { cells: [[0,0],[0,1],[0,2]],                   solution: [2,3] }, // 1×3 bar
    ],
  },
  // P5 — irregular with S-tetromino (21 cells, 5 pieces)
  // AABBB | AACCC | DDDCC | DD.EE | ...EE
  {
    board: '11111|11111|1111.|1111.|.111.',
    pieces: [
      { cells: [[0,0],[0,1],[1,0],[1,1]],                         solution: [0,0] }, // 2×2
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],             solution: [0,2] }, // 2×3
      { cells: [[0,0],[1,0],[1,1],[2,1]],                         solution: [2,0] }, // S-tet
      { cells: [[0,0],[0,1],[0,2]],                               solution: [2,1] }, // 1×3 bar
      { cells: [[0,0],[0,1],[1,0],[1,1]],                         solution: [3,3] }, // 2×2
    ],
  },
  // P6 — 4×4 square (16 cells, 4 pieces)
  {
    board: '1111|1111|1111|1111',
    pieces: [
      { cells: [[0,0],[0,1],[1,0],[1,1]], solution: [0,0] },
      { cells: [[0,0],[0,1],[1,0],[1,1]], solution: [0,2] },
      { cells: [[0,0],[0,1],[1,0],[1,1]], solution: [2,0] },
      { cells: [[0,0],[0,1],[1,0],[1,1]], solution: [2,2] },
    ],
  },
  // P7 — 3×5 rectangle (15 cells, 4 pieces)
  {
    board: '11111|11111|11111',
    pieces: [
      { cells: [[0,0],[0,1],[1,0],[1,1]],             solution: [0,0] }, // 2×2
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], solution: [0,2] }, // 2×3
      { cells: [[0,0],[0,1],[0,2]],                   solution: [2,0] }, // 1×3
      { cells: [[0,0],[0,1]],                         solution: [2,3] }, // 1×2
    ],
  },
  // P8 — with T-tetromino (18 cells, 4 pieces)
  // AAABB | AAABB | CCCDD | .C.DD
  {
    board: '11111|11111|11111|.1.11',
    pieces: [
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], solution: [0,0] }, // 2×3
      { cells: [[0,0],[0,1],[1,0],[1,1]],             solution: [0,3] }, // 2×2
      { cells: [[0,0],[0,1],[0,2],[1,1]],             solution: [2,0] }, // T-tet
      { cells: [[0,0],[0,1],[1,0],[1,1]],             solution: [2,3] }, // 2×2
    ],
  },
  // P9 — 5×6 with bite (27 cells, 6 pieces)
  {
    board: '111111|111111|111111|111111|111...',
    pieces: [
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], solution: [0,0] },
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], solution: [0,3] },
      { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], solution: [2,0] },
      { cells: [[0,0],[0,1],[0,2]],                   solution: [2,3] },
      { cells: [[0,0],[0,1],[0,2]],                   solution: [3,3] },
      { cells: [[0,0],[0,1],[0,2]],                   solution: [4,0] },
    ],
  },
];

// Pre-parse all puzzles
const PUZZLES = RAW_PUZZLES.map(raw => {
  const board = parseBoard(raw.board);
  const pieces = raw.pieces.map((p, i) => ({
    id: `p${i}`,
    cells: p.cells,
    solution: p.solution,
    ...dims(p.cells),
  }));
  return { board, pieces };
});

const DIFFICULTY_CONFIG = {
  easy:   { timeLimitSeconds: null, hints: true  },
  medium: { timeLimitSeconds: null, hints: false },
  hard:   { timeLimitSeconds: 300,  hints: false },
};

const GAP = 4;

// ── Helpers ─────────────────────────────────────────────────────────
function canPlace(boardCells, pieceCells, ar, ac, placements) {
  for (const [dr, dc] of pieceCells) {
    const key = `${ar + dr},${ac + dc}`;
    if (!boardCells.has(key)) return false;
    if (placements[key]) return false;
  }
  return true;
}

function findValidAnchor(boardCells, piece, r, c, placements) {
  const candidates = [[r, c], ...piece.cells.map(([dr, dc]) => [r - dr, c - dc])];
  const seen = new Set();
  for (const [ar, ac] of candidates) {
    const k = `${ar},${ac}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (canPlace(boardCells, piece.cells, ar, ac, placements)) return [ar, ac];
  }
  return null;
}

function clientToCell(boardEl, clientX, clientY, boardRows, boardCols) {
  if (!boardEl) return null;
  const rect = boardEl.getBoundingClientRect();
  const cellW = (rect.width  - (boardCols - 1) * GAP) / boardCols;
  const cellH = (rect.height - (boardRows - 1) * GAP) / boardRows;
  const c = Math.floor((clientX - rect.left) / (cellW + GAP));
  const r = Math.floor((clientY - rect.top)  / (cellH + GAP));
  if (r < 0 || r >= boardRows || c < 0 || c >= boardCols) return null;
  return [r, c];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Piece preview (mini grid) ───────────────────────────────────────
function PiecePreview({ piece, cellSize = 20 }) {
  return (
    <div
      className={styles.piecePreview}
      style={{
        gridTemplateColumns: `repeat(${piece.cols}, ${cellSize}px)`,
        gridTemplateRows:    `repeat(${piece.rows}, ${cellSize}px)`,
      }}
    >
      {Array.from({ length: piece.rows }, (_, r) =>
        Array.from({ length: piece.cols }, (_, c) => {
          const filled = piece.cells.some(([dr, dc]) => dr === r && dc === c);
          return (
            <div
              key={`${r},${c}`}
              className={styles.previewCell}
              style={filled ? { backgroundColor: piece.color } : {}}
            />
          );
        })
      )}
    </div>
  );
}

PiecePreview.propTypes = { piece: PropTypes.object.isRequired, cellSize: PropTypes.number };

// ── Inner game ──────────────────────────────────────────────────────
function BlocksGame({ difficulty, onComplete, reportScore }) {
  const { hints } = DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG.easy;

  // Pick a random puzzle on mount, assign shuffled colors
  const puzzle = useMemo(() => {
    const idx = Math.floor(Math.random() * PUZZLES.length);
    const { board, pieces } = PUZZLES[idx];
    const colorOrder = shuffle(COLORS);
    const labelOrder = shuffle(LABELS);
    const trayOrder = shuffle(pieces.map((_, i) => i));
    const coloredPieces = pieces.map((p, i) => ({
      ...p,
      color: colorOrder[i % colorOrder.length],
      label: `${labelOrder[i % labelOrder.length]} piece`,
    }));
    return { board, pieces: coloredPieces, trayOrder };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { board, pieces: pieceDefs, trayOrder } = puzzle;

  const [placements,  setPlacements]  = useState({});
  const [placed,      setPlaced]      = useState(new Set());
  const [selectedId,  setSelectedId]  = useState(null);
  const [invalidKey,  setInvalidKey]  = useState(null);
  const [elapsed,     setElapsed]     = useState(0);
  const [done,        setDone]        = useState(false);
  const [dragging, setDragging] = useState(null);
  const boardRef = useRef(null);

  // Count-up timer
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => { reportScore(placed.size); }, [placed.size, reportScore]);

  // Win detection
  useEffect(() => {
    if (placed.size === pieceDefs.length && !done) {
      setDone(true);
      onComplete({ finalScore: pieceDefs.length, maxScore: pieceDefs.length, completed: true });
    }
  }, [placed.size, done, onComplete, pieceDefs.length]);

  // Hint cells (easy mode)
  const hintCells = useMemo(() => {
    if (!hints || !selectedId) return new Set();
    const piece = pieceDefs.find(p => p.id === selectedId);
    if (!piece) return new Set();
    const result = new Set();
    for (let ar = 0; ar < board.rows; ar++) {
      for (let ac = 0; ac < board.cols; ac++) {
        if (canPlace(board.cells, piece.cells, ar, ac, placements)) {
          for (const [dr, dc] of piece.cells) result.add(`${ar + dr},${ac + dc}`);
        }
      }
    }
    return result;
  }, [hints, selectedId, placements, pieceDefs, board]);

  const placePiece = useCallback((pieceId, r, c) => {
    const piece = pieceDefs.find(p => p.id === pieceId);
    if (!piece) return false;
    const anchor = findValidAnchor(board.cells, piece, r, c, placements);
    if (!anchor) return false;
    const [ar, ac] = anchor;
    const next = { ...placements };
    for (const [dr, dc] of piece.cells) next[`${ar + dr},${ac + dc}`] = pieceId;
    setPlacements(next);
    setPlaced(prev => new Set([...prev, pieceId]));
    setSelectedId(null);
    return true;
  }, [placements, pieceDefs, board.cells]);

  const removePiece = useCallback((pieceId) => {
    setPlacements(prev => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v !== pieceId) next[k] = v;
      }
      return next;
    });
    setPlaced(prev => {
      const next = new Set(prev);
      next.delete(pieceId);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setPlacements({});
    setPlaced(new Set());
    setSelectedId(null);
  }, []);

  // ── Solve ─────────────────────────────────────────────────────────
  const handleSolve = useCallback(() => {
    const next = {};
    for (const piece of pieceDefs) {
      const [ar, ac] = piece.solution;
      for (const [dr, dc] of piece.cells) {
        next[`${ar + dr},${ac + dc}`] = piece.id;
      }
    }
    setPlacements(next);
    setPlaced(new Set(pieceDefs.map(p => p.id)));
    setSelectedId(null);
  }, [pieceDefs]);

  const handlePieceSelect = useCallback((id) => {
    setSelectedId(prev => prev === id ? null : id);
    setInvalidKey(null);
  }, []);

  const handleCellTap = useCallback((r, c) => {
    if (selectedId) {
      if (!placePiece(selectedId, r, c)) {
        setInvalidKey(`${r},${c}`);
        setTimeout(() => setInvalidKey(null), 500);
      }
      return;
    }
    const pieceId = placements[`${r},${c}`];
    if (pieceId) removePiece(pieceId);
  }, [selectedId, placements, placePiece, removePiece]);

  // ── Drag handlers ─────────────────────────────────────────────────
  const handleDragStart = useCallback((e, pieceId) => {
    if (placed.has(pieceId)) return;
    e.target.releasePointerCapture(e.pointerId);
    setDragging({ pieceId, ghostX: e.clientX, ghostY: e.clientY });
    setSelectedId(null);
  }, [placed]);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e) {
      setDragging(prev => prev ? { ...prev, ghostX: e.clientX, ghostY: e.clientY } : null);
    }
    function onUp(e) {
      setDragging(prev => {
        if (!prev) return null;
        const cell = clientToCell(boardRef.current, e.clientX, e.clientY, board.rows, board.cols);
        if (cell) placePiece(prev.pieceId, cell[0], cell[1]);
        return null;
      });
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };
  }, [dragging, placePiece, board.rows, board.cols]);

  useEffect(() => {
    if (!dragging) return;
    function prevent(e) { e.preventDefault(); }
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, [dragging]);

  const selectedPiece = pieceDefs.find(p => p.id === selectedId);
  const draggingPiece = dragging ? pieceDefs.find(p => p.id === dragging.pieceId) : null;
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className={styles.gameWrapper}>
      <div className={styles.timerRow} aria-live="off" role="timer">
        <span className={styles.timerLabel}>Time</span>
        <span className={styles.timerValue}>{fmt(elapsed)}</span>
        <span className={styles.progress}>{placed.size}/{pieceDefs.length} pieces</span>
      </div>

      <div
        ref={boardRef}
        className={styles.board}
        style={{ gridTemplateColumns: `repeat(${board.cols}, var(--cell))` }}
        role="grid"
        aria-label="Puzzle board"
      >
        {Array.from({ length: board.rows }, (_, r) =>
          Array.from({ length: board.cols }, (_, c) => {
            const key     = `${r},${c}`;
            const isBoard = board.cells.has(key);
            const pieceId = placements[key];
            const piece   = pieceId ? pieceDefs.find(p => p.id === pieceId) : null;
            const isHint  = hintCells.has(key);
            const isInv   = invalidKey === key;
            const canTap  = isBoard && (!!selectedId && !pieceId || pieceId);

            if (!isBoard) return <div key={key} className={styles.emptyCell} aria-hidden="true" />;

            return (
              <div
                key={key}
                className={[
                  styles.boardCell,
                  pieceId             ? styles.filledCell     : styles.emptyBoardCell,
                  pieceId && !selectedId ? styles.clearable   : '',
                  isHint              ? styles.hintCell       : '',
                  isInv               ? styles.invalidCell    : '',
                  !pieceId && selectedId ? styles.targetCell  : '',
                ].join(' ')}
                style={piece ? { backgroundColor: piece.color, borderColor: `color-mix(in srgb, ${piece.color} 70%, black)` } : {}}
                onClick={() => canTap && handleCellTap(r, c)}
                role="gridcell"
                aria-label={`Row ${r + 1}, column ${c + 1}${piece ? `, ${piece.label} — tap to remove` : ''}`}
                tabIndex={canTap ? 0 : -1}
                onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && canTap) handleCellTap(r, c); }}
              />
            );
          })
        )}
      </div>

      <div className={styles.statusRow}>
        {selectedPiece ? (
          <>
            <span className={styles.hintText}>
              Tap the board to place the{' '}
              <strong style={{ color: selectedPiece.color }}>{selectedPiece.label}</strong>
            </span>
            <button className={styles.cancelBtn} onClick={() => setSelectedId(null)}>Cancel</button>
          </>
        ) : (
          <span className={styles.hintText}>
            {placed.size === pieceDefs.length
              ? 'All pieces placed!'
              : dragging ? 'Drop on the board…' : 'Tap or drag a piece. Tap a placed piece to remove it.'}
          </span>
        )}
        {!done && (
          <div className={styles.actionBtns}>
            {placed.size > 0 && (
              <button className={styles.clearAllBtn} onClick={clearAll}>Clear all</button>
            )}
            <button className={styles.solveBtn} onClick={handleSolve}>Solve</button>
          </div>
        )}
      </div>

      <div className={styles.tray} role="list" aria-label="Pieces to place">
        {trayOrder.map(i => {
          const piece = pieceDefs[i];
          const isPlaced   = placed.has(piece.id);
          const isSelected = selectedId === piece.id;
          const isDragging = dragging?.pieceId === piece.id;
          return (
            <button
              key={piece.id}
              className={[
                styles.pieceTile,
                isPlaced   ? styles.piecePlaced   : '',
                isSelected ? styles.pieceSelected  : '',
                isDragging ? styles.pieceDragging  : '',
              ].join(' ')}
              onClick={() => !isPlaced && !dragging && handlePieceSelect(piece.id)}
              onPointerDown={e => handleDragStart(e, piece.id)}
              disabled={isPlaced}
              aria-label={`${piece.label}${isPlaced ? ' — placed' : isSelected ? ' — selected' : ''}`}
              aria-pressed={isSelected}
              style={{ touchAction: 'none' }}
            >
              <PiecePreview piece={piece} cellSize={22} />
            </button>
          );
        })}
      </div>

      {draggingPiece && dragging && (
        <div
          className={styles.ghost}
          style={{ left: dragging.ghostX, top: dragging.ghostY }}
          aria-hidden="true"
        >
          <PiecePreview piece={draggingPiece} cellSize={44} />
        </div>
      )}
    </div>
  );
}

BlocksGame.propTypes = {
  difficulty:  PropTypes.oneOf(['easy', 'medium', 'hard']).isRequired,
  onComplete:  PropTypes.func.isRequired,
  reportScore: PropTypes.func.isRequired,
};

// ── Outer wrapper ───────────────────────────────────────────────────
export function Blocks({
  memberId,
  difficulty = 'easy',
  onComplete,
  callbackUrl,
  onBack,
  musicMuted,
  onToggleMusic,
}) {
  const config = DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG.easy;
  const fireCallback = useGameCallback({ memberId, gameId: 'blocks', callbackUrl, onComplete });

  const instructions = (
    <>
      <p>Fit all the coloured blocks into the puzzle board!</p>
      <ol style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.8 }}>
        <li><strong>Tap:</strong> select a piece, then tap the board to place it.</li>
        <li><strong>Drag:</strong> drag a piece directly onto the board.</li>
        <li><strong>Remove:</strong> tap a placed piece on the board to pick it back up.</li>
      </ol>
      <p style={{ marginTop: 8, color: 'var(--color-text-muted, #666)' }}>
        Pieces cannot be rotated. Fill every square to win!
        {config.hints ? ' Blue cells show where the selected piece can go.' : ''}
      </p>
    </>
  );

  return (
    <GameShell
      gameId="blocks"
      title="Blocks"
      instructions={instructions}
      difficulty={difficulty}
      timeLimitSeconds={config.timeLimitSeconds}
      onGameComplete={fireCallback}
      onBack={onBack}
      musicMuted={musicMuted}
      onToggleMusic={onToggleMusic}
    >
      {({ onComplete: shellComplete, reportScore }) => (
        <BlocksGame
          difficulty={difficulty}
          onComplete={shellComplete}
          reportScore={reportScore}
        />
      )}
    </GameShell>
  );
}

Blocks.propTypes = {
  memberId:      PropTypes.string.isRequired,
  difficulty:    PropTypes.oneOf(['easy', 'medium', 'hard']),
  onComplete:    PropTypes.func.isRequired,
  callbackUrl:   PropTypes.string,
  onBack:        PropTypes.func,
  musicMuted:    PropTypes.bool,
  onToggleMusic: PropTypes.func,
};
