// api/_lib/answers.js
// Authoritative Answer Key Validation & Normalization
import fs from 'node:fs';
import path from 'node:path';

let answersData = null;

function getAnswers() {
  if (!answersData) {
    const answersPath = path.join(process.cwd(), 'puzzles', 'server-only', 'puzzles.answers.json');
    if (fs.existsSync(answersPath)) {
      answersData = JSON.parse(fs.readFileSync(answersPath, 'utf8'));
    } else {
      console.error('[ANSWERS ERROR] puzzles/server-only/puzzles.answers.json not found!');
      answersData = { answers: [], accusation: { correct: 'Dr. Sam Whitley' } };
    }
  }
  return answersData;
}

export function normalizeAnswer(ans) {
  if (ans == null) return '';
  return String(ans)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' '); // collapse repeated whitespace
}

export function checkAnswer(puzzleId, rawAnswer) {
  const data = getAnswers();
  const puzzle = data.answers.find(a => a.puzzle_id === puzzleId);
  if (!puzzle) return false;

  const normalizedInput = normalizeAnswer(rawAnswer);
  if (!normalizedInput) return false;

  return puzzle.accepted_answers.some(accepted => {
    return normalizeAnswer(accepted) === normalizedInput;
  });
}

export function getHint(puzzleId) {
  const data = getAnswers();
  const puzzle = data.answers.find(a => a.puzzle_id === puzzleId);
  return puzzle ? puzzle.hint : null;
}

export function checkAccusation(suspectId) {
  // Suspect id 'sam' corresponds to 'Dr. Sam Whitley'
  if (!suspectId) return false;
  const normalized = String(suspectId).trim().toLowerCase();
  return normalized === 'sam' || normalized === 'dr. sam whitley';
}
