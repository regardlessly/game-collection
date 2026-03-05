import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { GameShell } from '../../components/GameShell/GameShell';
import { useGameCallback } from '../../hooks/useGameCallback';
import styles from './Blocks.module.css';

// ── Board definition ────────────────────────────────────────────────
const BOARD_CELLS = new Set([
  '0,0','0,1','0,2','0,3','0,4',
  '1,0','1,1','1,2','1,3','1,4',
  '2,0','2,1','2,2','2,3','2,4',
  '3,0','3,1','3,2','3,3','3,4','3,5',
  '4,0','4,1','4,2','4,3','4,4',
]);
const BOARD_ROWS = 5;
const BOARD_COLS = 6;
const GAP = 4; // px — must match CSS gap

// ── Piece definitions ───────────────────────────────────────────────
const PIECE_DEFS = [
  { id: 'blue',   color: '#3b7fd4', label: 'Blue rectangle', cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], rows: 2, cols: 3 },
  { id: 'yellow', color: '#d4a017', label: 'Yellow L-shape',  cells: [[0,0],[0,1],[1,0],[1,1],[2,1]],       rows: 3, cols: 2 },
  { id: 'green',  color: '#388e3c', label: 'Green square',    cells: [[0,0],[0,1],[1,0],[1,1]],             rows: 2, cols: 2 },
  { id: 'purple', color: '#7b3fa0', label: 'Purple square',   cells: [[0,0],[0,1],[1,0],[1,1]],             rows: 2, cols: 2 },
  { id: 'cyan',   color: '#0097a7', label: 'Cyan bar',        cells: [[0,0],[0,1],[0,2]],                   rows: 1, cols: 3 },
  { id: 'red',    color: '#c62828', label: 'Red S-shape',     cells: [[0,1],[0,2],[1,0],[1,1]],             rows: 2, cols: 3 },
];

const DIFFICULTY_CONFIG = {
  easy:   { timeLimitSeconds: null, hints: true  },
  medium: { timeLimitSeconds: null, hints: false },
  hard:   { timeLimitSeconds: 300,  hints: false },
};

// ── Helpers ─────────────────────────────────────────────────────────
function canPlace(pieceCells, ar, ac, placements) {
  for (const [dr, dc] of pieceCells) {
    const key = `${ar + dr},${ac + dc}`;
    if (!BOARD_CELLS.has(key)) return false;
    if (placements[key]) return false;
  }
  return true;
}

/** Try all snap positions so any piece-cell can land at (r, c). */
function findValidAnchor(piece, r, c, placements) {
  const candidates = [[r, c], ...piece.cells.map(([dr, dc]) => [r - dr, c - dc])];
  const seen = new Set();
  for (const [ar, ac] of candidates) {
    const k = `${ar},${ac}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (canPlace(piece.cells, ar, ac, placements)) return [ar, ac];
  }
  return null;
}

/** Convert a client-coordinate point into board [row, col]. */
function clientToCell(boardEl, clientX, clientY) {
  if (!boardEl) return null;
  const rect = boardEl.getBoundingClientRect();
  const cellW = (rect.width  - (BOARD_COLS - 1) * GAP) / BOARD_COLS;
  const cellH = (rect.height - (BOARD_ROWS - 1) * GAP) / BOARD_ROWS;
  const c = Math.floor((clientX - rect.left) / (cellW + GAP));
  const r = Math.floor((clientY - rect.top)  / (cellH + GAP));
  if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return null;
  return [r, c];
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

  const [placements,  setPlacements]  = useState({});
  const [placed,      setPlaced]      = useState(new Set());
  const [selectedId,  setSelectedId]  = useState(null);
  const [invalidKey,  setInvalidKey]  = useState(null);
  const [elapsed,     setElapsed]     = useState(0);
  const [done,        setDone]        = useState(false);

  // Drag state
  const [dragging, setDragging] = useState(null); // { pieceId, ghostX, ghostY }
  const boardRef = useRef(null);

  // Count-up timer
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  // Push progress to HUD
  useEffect(() => { reportScore(placed.size); }, [placed.size, reportScore]);

  // Win detection
  useEffect(() => {
    if (placed.size === PIECE_DEFS.length && !done) {
      setDone(true);
      onComplete({ finalScore: PIECE_DEFS.length, maxScore: PIECE_DEFS.length, completed: true });
    }
  }, [placed.size, done, onComplete]);

  // Hint cells (easy mode)
  const hintCells = useMemo(() => {
    if (!hints || !selectedId) return new Set();
    const piece = PIECE_DEFS.find(p => p.id === selectedId);
    if (!piece) return new Set();
    const result = new Set();
    for (let ar = 0; ar < BOARD_ROWS; ar++) {
      for (let ac = 0; ac < BOARD_COLS; ac++) {
        if (canPlace(piece.cells, ar, ac, placements)) {
          for (const [dr, dc] of piece.cells) result.add(`${ar + dr},${ac + dc}`);
        }
      }
    }
    return result;
  }, [hints, selectedId, placements]);

  // ── Place a piece ───────────────────────────────────────────────
  const placePiece = useCallback((pieceId, r, c) => {
    const piece = PIECE_DEFS.find(p => p.id === pieceId);
    if (!piece) return false;
    const anchor = findValidAnchor(piece, r, c, placements);
    if (!anchor) return false;
    const [ar, ac] = anchor;
    const next = { ...placements };
    for (const [dr, dc] of piece.cells) next[`${ar + dr},${ac + dc}`] = pieceId;
    setPlacements(next);
    setPlaced(prev => new Set([...prev, pieceId]));
    setSelectedId(null);
    return true;
  }, [placements]);

  // ── Remove a piece from board ───────────────────────────────────
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

  // ── Clear all ───────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    setPlacements({});
    setPlaced(new Set());
    setSelectedId(null);
  }, []);

  // ── Tap handlers ────────────────────────────────────────────────
  const handlePieceSelect = useCallback((id) => {
    setSelectedId(prev => prev === id ? null : id);
    setInvalidKey(null);
  }, []);

  const handleCellTap = useCallback((r, c) => {
    // If a piece is selected, try to place it
    if (selectedId) {
      if (!placePiece(selectedId, r, c)) {
        setInvalidKey(`${r},${c}`);
        setTimeout(() => setInvalidKey(null), 500);
      }
      return;
    }
    // If tapping a filled cell, remove that piece
    const pieceId = placements[`${r},${c}`];
    if (pieceId) removePiece(pieceId);
  }, [selectedId, placements, placePiece, removePiece]);

  // ── Drag handlers (pointer events) ──────────────────────────────
  const handleDragStart = useCallback((e, pieceId) => {
    if (placed.has(pieceId)) return;
    e.target.releasePointerCapture(e.pointerId); // let events flow freely
    setDragging({ pieceId, ghostX: e.clientX, ghostY: e.clientY });
    setSelectedId(null);
  }, [placed]);

  // Attach pointermove/pointerup on window during drag
  useEffect(() => {
    if (!dragging) return;
    function onMove(e) {
      setDragging(prev => prev ? { ...prev, ghostX: e.clientX, ghostY: e.clientY } : null);
    }
    function onUp(e) {
      setDragging(prev => {
        if (!prev) return null;
        const cell = clientToCell(boardRef.current, e.clientX, e.clientY);
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
  }, [dragging, placePiece]);

  // Prevent touch scrolling during drag
  useEffect(() => {
    if (!dragging) return;
    function prevent(e) { e.preventDefault(); }
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, [dragging]);

  const selectedPiece = PIECE_DEFS.find(p => p.id === selectedId);
  const draggingPiece = dragging ? PIECE_DEFS.find(p => p.id === dragging.pieceId) : null;
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className={styles.gameWrapper}>
      {/* Elapsed timer */}
      <div className={styles.timerRow} aria-live="off" role="timer">
        <span className={styles.timerLabel}>Time</span>
        <span className={styles.timerValue}>{fmt(elapsed)}</span>
        <span className={styles.progress}>{placed.size}/{PIECE_DEFS.length} pieces</span>
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className={styles.board}
        style={{ gridTemplateColumns: `repeat(${BOARD_COLS}, var(--cell))` }}
        role="grid"
        aria-label="Puzzle board"
      >
        {Array.from({ length: BOARD_ROWS }, (_, r) =>
          Array.from({ length: BOARD_COLS }, (_, c) => {
            const key     = `${r},${c}`;
            const isBoard = BOARD_CELLS.has(key);
            const pieceId = placements[key];
            const piece   = pieceId ? PIECE_DEFS.find(p => p.id === pieceId) : null;
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

      {/* Status hint */}
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
            {placed.size === PIECE_DEFS.length
              ? 'All pieces placed!'
              : dragging ? 'Drop on the board…' : 'Tap or drag a piece. Tap a placed piece to remove it.'}
          </span>
        )}
        {placed.size > 0 && !done && (
          <button className={styles.clearAllBtn} onClick={clearAll}>Clear all</button>
        )}
      </div>

      {/* Piece tray */}
      <div className={styles.tray} role="list" aria-label="Pieces to place">
        {PIECE_DEFS.map(piece => {
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

      {/* Drag ghost */}
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
