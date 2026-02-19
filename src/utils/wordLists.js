// Curated word pools for Word Recall game
// Easy: concrete household objects (very familiar)
// Medium: broader common nouns
// Hard: mixed categories including abstract/less common

export const WORD_POOLS = {
  easy: [
    'apple', 'chair', 'table', 'clock', 'bread',
    'glass', 'towel', 'lamp', 'phone', 'flower',
    'door', 'cup', 'book', 'keys', 'spoon',
    'brush', 'soap', 'shoe', 'coat', 'hat',
  ],
  medium: [
    'garden', 'market', 'bridge', 'camera', 'letter',
    'candle', 'bottle', 'basket', 'mirror', 'window',
    'pillow', 'carpet', 'ribbon', 'wallet', 'pencil',
    'vessel', 'lantern', 'feather', 'pebble', 'anchor',
    'curtain', 'blanket', 'cabinet', 'pitcher', 'hammer',
  ],
  hard: [
    'freedom', 'harvest', 'journey', 'silence', 'whisper',
    'crystal', 'compass', 'balance', 'texture', 'pattern',
    'shelter', 'courage', 'mystery', 'chapter', 'horizon',
    'climate', 'segment', 'mineral', 'current', 'portion',
    'contract', 'venture', 'complex', 'passage', 'reserve',
  ],
};

/**
 * Returns a random sample of n words from the given difficulty pool.
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {number} count
 * @returns {string[]}
 */
export function sampleWords(difficulty, count) {
  const pool = WORD_POOLS[difficulty] ?? WORD_POOLS.easy;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, pool.length));
}
