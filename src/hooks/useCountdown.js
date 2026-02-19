import { useState, useEffect, useRef } from 'react';

/**
 * Reusable countdown timer hook.
 *
 * @param {object} options
 * @param {number|null} options.seconds - Total seconds to count down. null = no timer.
 * @param {boolean} options.active - Only counts when true.
 * @param {function} options.onExpire - Called exactly once when countdown reaches 0.
 * @returns {{ secondsLeft: number|null }}
 */
export function useCountdown({ seconds, active, onExpire }) {
  const [secondsLeft, setSecondsLeft] = useState(seconds ?? null);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  // Keep onExpire ref up-to-date without re-running the effect
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  // Reset when seconds/active changes
  useEffect(() => {
    if (!active || seconds == null) return;
    expiredRef.current = false;
    setSecondsLeft(seconds);

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [active, seconds]);

  // Fire onExpire in a separate effect that watches secondsLeft reaching 0
  useEffect(() => {
    if (secondsLeft === 0 && active && !expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current?.();
    }
  }, [secondsLeft, active]);

  return { secondsLeft };
}
