import { useState, useCallback } from 'react';

const DIFFICULTY_CONFIG = {
  easy:   { ops: ['+'],        range: [1, 20],  questions: 8 },
  medium: { ops: ['+', '-'],   range: [1, 50],  questions: 10 },
  hard:   { ops: ['+', '-', '×'], range: [1, 12], questions: 12 },
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateQuestion(ops, range) {
  const op = ops[Math.floor(Math.random() * ops.length)];
  const [min, max] = range;

  if (op === '×') {
    const a = randInt(1, max);
    const b = randInt(1, max);
    return { a, op, b, answer: a * b };
  }
  if (op === '-') {
    const a = randInt(min, max);
    const b = randInt(min, a); // b <= a to avoid negatives
    return { a, op, b, answer: a - b };
  }
  // +
  const a = randInt(min, max);
  const b = randInt(min, max);
  return { a, op, b, answer: a + b };
}

export function useDailyArithmetic(difficulty = 'easy') {
  const config = DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG.easy;

  const [questions] = useState(() =>
    Array.from({ length: config.questions }, () =>
      generateQuestion(config.ops, config.range)
    )
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState(null); // null | 'correct' | 'wrong'
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const currentQuestion = questions[currentIndex];

  const submit = useCallback(() => {
    if (done || feedback !== null) return;
    const given = parseInt(inputValue, 10);
    if (isNaN(given)) return;

    const isCorrect = given === currentQuestion.answer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setScore((s) => s + 1);

    setTimeout(() => {
      const next = currentIndex + 1;
      if (next >= questions.length) {
        setDone(true);
      } else {
        setCurrentIndex(next);
        setInputValue('');
        setFeedback(null);
      }
    }, 800);
  }, [done, feedback, inputValue, currentQuestion, currentIndex, questions.length]);

  return {
    question: currentQuestion,
    currentIndex,
    totalQuestions: questions.length,
    inputValue,
    setInputValue,
    feedback,
    score,
    maxScore: questions.length,
    done,
    submit,
  };
}
