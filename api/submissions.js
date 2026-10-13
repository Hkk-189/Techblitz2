// api/submissions.js
// Authoritative Answer Evaluation & Submission Endpoint
import { supabase, localStore } from './_lib/db.js';
import { requireUser } from './_lib/auth.js';
import { checkAnswer } from './_lib/answers.js';
import { broadcastEvent } from './_lib/realtime.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { puzzle_id, submitted_answer } = req.body || {};
  const regNum = auth.user.register_number;

  if (!puzzle_id || submitted_answer == null) {
    return res.status(400).json({ error: 'puzzle_id and submitted_answer are required' });
  }

  const nowIso = new Date().toISOString();

  // Evaluate correctness server-side against secret key
  const isCorrect = checkAnswer(puzzle_id, submitted_answer);

  if (supabase) {
    // Check if participant is currently blocked
    const { data: session } = await supabase
      .from('participant_sessions')
      .select('is_blocked, score, hints_used, penalty_seconds')
      .eq('register_number', regNum)
      .single();

    if (session?.is_blocked) {
      return res.status(403).json({ error: 'fullscreen mode exited. Inform an admin to get unblocked.' });
    }

    // Insert submission record (unique per user + puzzle)
    const { error: subError } = await supabase
      .from('submissions')
      .insert({
        register_number: regNum,
        puzzle_id,
        raw_answer: String(submitted_answer),
        is_correct: isCorrect,
        recorded_at: nowIso
      });

    // If duplicate submission (already answered), log and return existing receipt
    if (subError && subError.code === '23505') {
      return res.status(200).json({ status: 'recorded', recorded_at: nowIso });
    }

    // If correct, increment participant score and emit live update to admin
    if (isCorrect && session) {
      const newScore = (session.score || 0) + 1;
      await supabase
        .from('participant_sessions')
        .update({
          score: newScore,
          last_active_at: nowIso
        })
        .eq('register_number', regNum);

      // Broadcast updated score to Admin leaderboard
      await broadcastEvent('admin:live', 'SCORE_UPDATED', {
        register_number: regNum,
        score: newScore,
        hints_used: session.hints_used || 0,
        penalty_seconds: session.penalty_seconds || 0,
        last_solved_puzzle: puzzle_id,
        recorded_at: nowIso
      });
    }
  } else {
    const session = localStore.participant_sessions.get(regNum);
    if (session?.is_blocked) {
      return res.status(403).json({ error: 'fullscreen mode exited. Inform an admin to get unblocked.' });
    }
    localStore.submissions.push({
      register_number: regNum,
      puzzle_id,
      raw_answer: String(submitted_answer),
      is_correct: isCorrect,
      recorded_at: nowIso
    });
    if (isCorrect && session) {
      session.score = (session.score || 0) + 1;
      session.last_active_at = nowIso;
    }
  }

  // Strict Rule: UI never reveals correctness during the event
  return res.status(200).json({
    status: 'recorded',
    recorded_at: nowIso
  });
}
