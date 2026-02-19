import { useCallback, useRef } from 'react';
import { buildPayload } from '../utils/buildPayload';

/**
 * Returns a stable `fireComplete` function that handles all CaritaHub
 * callback modes in sequence:
 *   1. JS onComplete callback — always, synchronous
 *   2. window.parent.postMessage — always (safe no-op when not in iframe)
 *   3. REST POST to callbackUrl — only when callbackUrl is provided
 *
 * @param {object} options
 * @param {string} options.memberId
 * @param {string} options.gameId
 * @param {string} [options.callbackUrl]
 * @param {function} options.onComplete
 * @returns {{ fireComplete: function }}
 */
export function useGameCallback({ memberId, gameId, callbackUrl, onComplete }) {
  // Use refs for values that may change but shouldn't retrigger useCallback
  const callbackUrlRef = useRef(callbackUrl);
  const onCompleteRef = useRef(onComplete);

  callbackUrlRef.current = callbackUrl;
  onCompleteRef.current = onComplete;

  const fireComplete = useCallback(
    async (rawResult) => {
      const payload = buildPayload({
        memberId,
        gameId,
        score: rawResult.score ?? 0,
        maxScore: rawResult.maxScore ?? 0,
        completed: rawResult.completed ?? true,
        durationSeconds: rawResult.durationSeconds ?? 0,
      });

      // 1. JS callback — synchronous, always fires first
      if (typeof onCompleteRef.current === 'function') {
        onCompleteRef.current(payload);
      }

      // 2. postMessage to parent window (iframe embedding)
      // Safe even when not in an iframe — window.parent === window.self in that case
      try {
        window.parent.postMessage(
          { type: 'GAME_COMPLETE', payload },
          '*' // targetOrigin '*' — embedding host should validate memberId server-side
        );
      } catch {
        // postMessage can throw in sandboxed iframes without allow-same-origin
      }

      // 3. REST POST — only when callbackUrl is supplied
      if (callbackUrlRef.current) {
        try {
          await fetch(callbackUrlRef.current, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch (err) {
          // Network failure must not crash the game or block the UI.
          // The game is complete from the user's perspective.
          console.error('[useGameCallback] REST callback failed:', err);
        }
      }
    },
    [memberId, gameId] // callbackUrl and onComplete are accessed via refs
  );

  return { fireComplete };
}
