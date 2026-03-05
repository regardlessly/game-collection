import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { GameShell } from '../../components/GameShell/GameShell';
import { useGameCallback } from '../../hooks/useGameCallback';
import styles from './Blocks.module.css';

// ── Board definition ────────────────────────────────────────────────
// Shape (rows 0-4, cols 0-5):
//   Row 0: X X X X X .
//   Row 1: X X X X X .
//   Row 2: X X X X X .
//   Row 3: X X X X X X   ← extra cell at col 5
//   Row 4: X X X X X .
const BOARD_CELLS = new Set([
  '0,0','0,1','0,2','0,3','0,4',
  '1,0','1,1','1,2','1,3','1,4',
  '2,0','2,1','2,2','2,3','2,4',
  '3,0','3,1','3,2','3,3','3,4','3,5',
  '4,0','4,1','4,2','4,3','4,4',
]);

const BOARD_ROWS = 5;
const BOARD_COLS = 6;

// ── Piece definitions ───────────────────────────────────────────────
// cells: [row, col] offsets from bounding-box top-left
// Solution: blue(0,0) yellow(0,3) green(2,0) purple(2,2) cyan(4,0) red-anchor(3,3)
const PIECE_DEFS = [
  {
    id: 'blue',
    color: '#3b7fd4',
    label: 'Blue rectangle',
    cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], // 2×3
    rows: 2, cols: 3,
  },
  {
    id: 'yellow',
    color: '#d4a017',
    label: 'Yellow L-shape',
    cells: [[0,0],[0,1],[1,0],[1,1],[2,1]], // L-pentomino
    rows: 3, cols: 2,
  },
  {
    id: 'green',
    color: '#388e3c',
    label: 'Green square',
    cells: [[0,0],[0,1],[1,0],[1,1]], // 2×2
    rows: 2, cols: 2,
  },
  {
    id: 'purple',
    color: '#7b3fa0',
    label: 'Purple square',
    cells: [[0,0],[0,1],[1,0],[1,1]], // 2×2
    rows: 2, cols: 2,
  },
  {
    id: 'cyan',
    color: '#0097a7',
    label: 'Cyan bar',
    cells: [[0,0],[0,1],[0,2]], // 1×3
    rows: 1, cols: 3,
  },
  {
    id: 'red',
    color: '#c62828',
    label: 'Red S-shape',
    cells: [[0,1],[0,2],[1,0],[1,1]], // S-tetromino (bounding box 2×3)
    rows: 2, cols: 3,
  },
];

const DIFFICULTY_CONFIG = {
  easy:   { timeLimitSeconds: null, hints: true  },
  medium: { timeLimitSeconds: null, hints: false },
  hard:   { timeLimitSeconds: 300,  hints: false },
};

// ── Helpers ─────────────────────────────────────────────────────────
function canPlace(pieceCells, ar, ac, placements) {
  for (const [dr, dc] of pieceCells) {
    const r = ar + dr, c = ac + dc;
    if (!BOARD_CELLS.has(`${r},${c}`)) return false;
    if (placements[`${r},${c}`]) return false;
  }
  return true;
}

// ── Piece preview (mini grid in tray) ───────────────────────────────
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

PiecePreview.propTypes = {
  piece:    PropTypes.object.isRequired,
  cellSize: PropTypes.number,
};

// ── Inner game ──────────────────────────────────────────────────────
function BlocksGame({ difficulty, onComplete, reportScore }) {
  const { hints } = DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG.easy;

  const [placements,  setPlacements]  = useState({});   // "r,c" → pieceId
  const [placed,      setPlaced]      = useState(new Set());
  const [selectedId,  setSelectedId]  = useState(null);
  const [invalidKey,  setInvalidKey]  = useState(null); // flashes red
  const [elapsed,     setElapsed]     = useState(0);
  const [done,        setDone]        = useState(false);

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

  // Hint cells (easy mode): all board cells coverable by the selected piece
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

  const handlePieceSelect = useCallback((id) => {
    setSelectedId(prev => prev === id ? null : id);
    setInvalidKey(null);
  }, []);

  const handleCellTap = useCallback((r, c) => {
    if (!selectedId) return;
    const piece = PIECE_DEFS.find(p => p.id === selectedId);
    if (!piece) return;

    // Candidates: shift piece so each of its cells lands at (r, c)
    const candidates = [
      [r, c], // top-left of bounding box at tapped cell
      ...piece.cells.map(([dr, dc]) => [r - dr, c - dc]),
    ];

    // Deduplicate
    const seen = new Set();
    const unique = candidates.filter(([ar, ac]) => {
      const k = `${ar},${ac}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    for (const [ar, ac] of unique) {
      if (canPlace(piece.cells, ar, ac, placements)) {
        const next = { ...placements };
        for (const [dr, dc] of piece.cells) next[`${ar + dr},${ac + dc}`] = selectedId;
        setPlacements(next);
        setPlaced(prev => new Set([...prev, selectedId]));
        setSelectedId(null);
        return;
      }
    }

    // No valid placement — flash
    setInvalidKey(`${r},${c}`);
    setTimeout(() => setInvalidKey(null), 500);
  }, [selectedId, placements]);

  const selectedPiece = PIECE_DEFS.find(p => p.id === selectedId);
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
        className={styles.board}
        style={{ gridTemplateColumns: `repeat(${BOARD_COLS}, var(--cell))` }}
        role="grid"
        aria-label="Puzzle board"
      >
        {Array.from({ length: BOARD_ROWS }, (_, r) =>
          Array.from({ length: BOARD_COLS }, (_, c) => {
            const key = `${r},${c}`;
            const isBoard   = BOARD_CELLS.has(key);
            const pieceId   = placements[key];
            const piece     = pieceId ? PIECE_DEFS.find(p => p.id === pieceId) : null;
            const isHint    = hintCells.has(key);
            const isInvalid = invalidKey === key;
            const isTarget  = isBoard && !pieceId && !!selectedId;

            if (!isBoard) {
              return <div key={key} className={styles.emptyCell} aria-hidden="true" />;
            }

            return (
              <div
                key={key}
                className={[
                  styles.boardCell,
                  pieceId   ? styles.filledCell  : styles.emptyBoardCell,
                  isHint    ? styles.hintCell    : '',
                  isInvalid ? styles.invalidCell : '',
                  isTarget  ? styles.targetCell  : '',
                ].join(' ')}
                style={piece ? { backgroundColor: piece.color, borderColor: `color-mix(in srgb, ${piece.color} 70%, black)` } : {}}
                onClick={() => isTarget && handleCellTap(r, c)}
                role="gridcell"
                aria-label={`Row ${r + 1}, column ${c + 1}${piece ? `, ${piece.label}` : ''}`}
                tabIndex={isTarget ? 0 : -1}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') isTarget && handleCellTap(r, c); }}
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
            <button className={styles.cancelBtn} onClick={() => setSelectedId(null)}>
              Cancel
            </button>
          </>
        ) : (
          <span className={styles.hintText}>
            {placed.size === PIECE_DEFS.length
              ? '🎉 All pieces placed!'
              : 'Tap a piece below to pick it up'}
          </span>
        )}
      </div>

      {/* Piece tray */}
      <div className={styles.tray} role="list" aria-label="Pieces to place">
        {PIECE_DEFS.map(piece => {
          const isPlaced   = placed.has(piece.id);
          const isSelected = selectedId === piece.id;
          return (
            <button
              key={piece.id}
              className={[
                styles.pieceTile,
                isPlaced   ? styles.piecePlaced   : '',
                isSelected ? styles.pieceSelected : '',
              ].join(' ')}
              onClick={() => !isPlaced && handlePieceSelect(piece.id)}
              disabled={isPlaced}
              aria-label={`${piece.label}${isPlaced ? ' — placed' : isSelected ? ' — selected' : ''}`}
              aria-pressed={isSelected}
            >
              <PiecePreview piece={piece} cellSize={22} />
            </button>
          );
        })}
      </div>
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
        <li>Tap a piece at the bottom to pick it up.</li>
        <li>Tap the board where you want it to go.</li>
        <li>Fill every square on the board to win.</li>
      </ol>
      <p style={{ marginTop: 8, color: 'var(--color-text-muted, #666)' }}>
        Pieces cannot be rotated.{config.hints ? ' Blue cells show where the selected piece can go.' : ''}
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
