/**
 * Builds the standard game completion payload.
 * This is the data contract between every game and the CaritaHub platform.
 *
 * @param {object} params
 * @param {string} params.memberId
 * @param {string} params.gameId
 * @param {number} params.score
 * @param {number} params.maxScore
 * @param {boolean} params.completed
 * @param {number} params.durationSeconds
 * @returns {object} Standard payload object
 */
export function buildPayload({ memberId, gameId, score, maxScore, completed, durationSeconds }) {
  return {
    memberId: String(memberId),
    gameId: String(gameId),
    score: Number(score),
    maxScore: Number(maxScore),
    completed: Boolean(completed),
    durationSeconds: Number(durationSeconds),
    timestamp: new Date().toISOString(),
  };
}
