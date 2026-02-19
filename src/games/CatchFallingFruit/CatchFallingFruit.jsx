import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { GameShell } from '../../components/GameShell/GameShell';
import { useGameCallback } from '../../hooks/useGameCallback';
import styles from './CatchFallingFruit.module.css';

// ── Difficulty config ──────────────────────────────────────────────
const DIFFICULTY_CONFIG = {
  easy:   { fallSpeed: 2,   spawnMs: 2000, timeLimitSeconds: null, lives: 5, basketWidth: 110 },
  medium: { fallSpeed: 3.5, spawnMs: 1400, timeLimitSeconds: 120,  lives: 3, basketWidth: 90  },
  hard:   { fallSpeed: 5,   spawnMs: 900,  timeLimitSeconds: 90,   lives: 3, basketWidth: 70  },
};

const FRUITS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🍒', '🥝'];
const FRUIT_SIZE  = 40; // px — rendered size
const BASKET_H    = 44; // px

let nextId = 0;

// ── Inner game (rAF loop, input handling) ─────────────────────────
function CatchGame({ difficulty, onComplete, reportScore, secondsLeft }) {
  const config = DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG.easy;

  const areaRef     = useRef(null);
  const rafRef      = useRef(null);
  const fruitsRef   = useRef([]);        // mutable array, no re-render per frame
  const basketXRef  = useRef(0.5);       // 0–1 normalised position
  const scoreRef    = useRef(0);
  const livesRef    = useRef(config.lives);
  const spawnTimerRef = useRef(null);
  const doneRef     = useRef(false);
  const totalSpawnedRef = useRef(0);

  // React state only for things that drive UI repaints
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(config.lives);
  const [, forceUpdate] = useState(0); // triggers re-render to reposition fruit spans

  // ── Finish game ────────────────────────────────────────────────
  const finish = useCallback((completed) => {
    if (doneRef.current) return;
    doneRef.current = true;
    clearInterval(spawnTimerRef.current);
    cancelAnimationFrame(rafRef.current);
    onComplete({
      finalScore: scoreRef.current,
      maxScore: totalSpawnedRef.current || 1,
      completed,
    });
  }, [onComplete]);

  // ── Time-up detection ──────────────────────────────────────────
  useEffect(() => {
    if (secondsLeft === 0 && !doneRef.current) {
      finish(false);
    }
  }, [secondsLeft, finish]);

  // ── Spawn fruit ────────────────────────────────────────────────
  useEffect(() => {
    spawnTimerRef.current = setInterval(() => {
      if (doneRef.current) return;
      const x = Math.random() * 0.8 + 0.1; // 10%–90% of area width
      fruitsRef.current.push({
        id:    nextId++,
        emoji: FRUITS[Math.floor(Math.random() * FRUITS.length)],
        x,      // normalised 0–1
        y: -FRUIT_SIZE,  // px from top, starts above visible area
      });
      totalSpawnedRef.current += 1;
    }, config.spawnMs);

    return () => clearInterval(spawnTimerRef.current);
  }, [config.spawnMs]);

  // ── rAF loop ───────────────────────────────────────────────────
  useEffect(() => {
    let lastTime = null;

    function tick(timestamp) {
      if (doneRef.current) return;
      const dt = lastTime ? Math.min((timestamp - lastTime) / 16.67, 3) : 1; // cap at 3× normal
      lastTime = timestamp;

      const area = areaRef.current;
      if (!area) { rafRef.current = requestAnimationFrame(tick); return; }
      const areaH = area.clientHeight;
      const areaW = area.clientWidth;
      const basketX = basketXRef.current * areaW; // pixel centre of basket
      const catchBottom = areaH - BASKET_H - 4;   // y threshold to test catch
      const catchTop    = catchBottom - FRUIT_SIZE;

      const survived = [];
      let scoreChanged = false;
      let livesChanged = false;

      for (const fruit of fruitsRef.current) {
        fruit.y += config.fallSpeed * dt;

        if (fruit.y >= catchTop && fruit.y <= catchBottom + config.fallSpeed * dt + 4) {
          // In the catch zone — check horizontal overlap
          const fruitCx = fruit.x * areaW;
          const halfBasket = (config.basketWidth / 2) + FRUIT_SIZE / 2;
          if (Math.abs(fruitCx - basketX) <= halfBasket) {
            // CAUGHT
            scoreRef.current += 1;
            scoreChanged = true;
            continue; // remove fruit
          }
        }

        if (fruit.y > areaH) {
          // MISSED
          livesRef.current -= 1;
          livesChanged = true;
          continue; // remove fruit
        }

        survived.push(fruit);
      }

      fruitsRef.current = survived;

      if (scoreChanged) {
        setDisplayScore(scoreRef.current);
        reportScore(scoreRef.current);
      }
      if (livesChanged) {
        setDisplayLives(livesRef.current);
        if (livesRef.current <= 0) {
          finish(true);
          return;
        }
      }

      forceUpdate(n => n + 1); // repaint fruit positions
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [config.fallSpeed, config.basketWidth, finish, reportScore]);

  // ── Input: mouse ───────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    basketXRef.current = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
  }, []);

  // ── Input: touch ───────────────────────────────────────────────
  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touch = e.touches[0];
    basketXRef.current = Math.max(0.05, Math.min(0.95, (touch.clientX - rect.left) / rect.width));
  }, []);

  // ── Input: keyboard ────────────────────────────────────────────
  useEffect(() => {
    const step = 0.06; // ~6% of width per keypress
    function handleKey(e) {
      if (e.key === 'ArrowLeft')  basketXRef.current = Math.max(0.05, basketXRef.current - step);
      if (e.key === 'ArrowRight') basketXRef.current = Math.min(0.95, basketXRef.current + step);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Render ─────────────────────────────────────────────────────
  const area = areaRef.current;
  const areaW = area?.clientWidth ?? 320;

  return (
    <div className={styles.wrapper}>
      {/* Lives + score row */}
      <div className={styles.statusRow}>
        <div className={styles.livesRow} aria-label={`${displayLives} lives remaining`}>
          {Array.from({ length: config.lives }).map((_, i) => (
            <span key={i} className={i < displayLives ? styles.heartFull : styles.heartEmpty}>
              {i < displayLives ? '❤️' : '🖤'}
            </span>
          ))}
        </div>
        <div className={styles.scoreDisplay} aria-live="polite" aria-atomic="true">
          Score: <strong>{displayScore}</strong>
        </div>
      </div>

      {/* Game area */}
      <div
        ref={areaRef}
        className={styles.gameArea}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchMove}
        role="application"
        aria-label="Catch the fruit — move left or right with arrow keys"
      >
        {/* Falling fruit */}
        {fruitsRef.current.map(fruit => (
          <span
            key={fruit.id}
            className={styles.fruit}
            style={{
              left: `calc(${fruit.x * 100}% - ${FRUIT_SIZE / 2}px)`,
              top:  fruit.y,
            }}
            aria-hidden="true"
          >
            {fruit.emoji}
          </span>
        ))}

        {/* Basket */}
        <div
          className={styles.basket}
          style={{
            left: `calc(${basketXRef.current * 100}% - ${config.basketWidth / 2}px)`,
            width: config.basketWidth,
          }}
          aria-hidden="true"
        >
          🧺
        </div>

        {/* Left/right tap zones (senior-friendly alternative to precise drag) */}
        <button
          className={`${styles.tapZone} ${styles.tapZoneLeft}`}
          onPointerDown={() => { basketXRef.current = Math.max(0.05, basketXRef.current - 0.15); }}
          aria-label="Move basket left"
          tabIndex={-1}
        >‹</button>
        <button
          className={`${styles.tapZone} ${styles.tapZoneRight}`}
          onPointerDown={() => { basketXRef.current = Math.min(0.95, basketXRef.current + 0.15); }}
          aria-label="Move basket right"
          tabIndex={-1}
        >›</button>
      </div>

      <p className={styles.hint}>Move your finger or mouse to guide the basket</p>
    </div>
  );
}

CatchGame.propTypes = {
  difficulty:  PropTypes.oneOf(['easy', 'medium', 'hard']).isRequired,
  onComplete:  PropTypes.func.isRequired,
  reportScore: PropTypes.func.isRequired,
  secondsLeft: PropTypes.number,
};

// ── Outer wrapper (GameShell wiring) ──────────────────────────────
export function CatchFallingFruit({
  memberId,
  difficulty = 'easy',
  onComplete,
  callbackUrl,
  onBack,
  musicMuted,
  onToggleMusic,
}) {
  const config = DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG.easy;
  const fireCallback = useGameCallback({ memberId, gameId: 'catch-falling-fruit', callbackUrl, onComplete });

  const instructions = (
    <>
      <p>Fruit will fall from the sky — guide the basket to catch them!</p>
      <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.8 }}>
        <li><strong>Mouse / finger:</strong> move over the game area</li>
        <li><strong>Touch:</strong> tap the ‹ › arrows on the sides</li>
        <li><strong>Keyboard:</strong> ← → arrow keys</li>
      </ul>
      <p style={{ marginTop: 8 }}>
        You have {config.lives} {config.lives === 5 ? '❤️❤️❤️❤️❤️' : '❤️❤️❤️'} lives.
        Miss a fruit and you lose one!
      </p>
    </>
  );

  return (
    <GameShell
      gameId="catch-falling-fruit"
      title="Catch the Falling Fruit"
      instructions={instructions}
      difficulty={difficulty}
      timeLimitSeconds={config.timeLimitSeconds}
      onGameComplete={fireCallback}
      onBack={onBack}
      musicMuted={musicMuted}
      onToggleMusic={onToggleMusic}
    >
      {({ onComplete: shellComplete, reportScore, secondsLeft }) => (
        <CatchGame
          difficulty={difficulty}
          onComplete={shellComplete}
          reportScore={reportScore}
          secondsLeft={secondsLeft}
        />
      )}
    </GameShell>
  );
}

CatchFallingFruit.propTypes = {
  memberId:      PropTypes.string.isRequired,
  difficulty:    PropTypes.oneOf(['easy', 'medium', 'hard']),
  onComplete:    PropTypes.func.isRequired,
  callbackUrl:   PropTypes.string,
  onBack:        PropTypes.func,
  musicMuted:    PropTypes.bool,
  onToggleMusic: PropTypes.func,
};
