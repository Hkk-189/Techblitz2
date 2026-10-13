// api/admin/overview.js
// Admin Endpoint: Full State Snapshot for Admin Dashboard
import { supabase, localStore } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';
import { getCulprit } from '../_lib/answers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  // Hobby plan caps functions at 12, so the culprit reveal lives here: GET ?culprit=1
  if (req.query?.culprit || req.url?.includes('culprit=1')) {
    return res.status(200).json({ culprit: getCulprit() });
  }

  let eventState = { is_started: false, server_start_time: null, total_duration_ms: 4200000 };
  let leaderboard = [];
  let requests = [];
  let roster = [];

  if (supabase) {
    // 1. Event State
    const { data: eState } = await supabase
      .from('event_state')
      .select('*')
      .eq('id', 1)
      .single();
    if (eState) eventState = eState;

    // 2. Live Leaderboard
    const { data: board } = await supabase
      .from('participant_sessions')
      .select('register_number, score, hints_used, penalty_seconds, accusation_suspect, is_blocked, last_active_at')
      .order('score', { ascending: false })
      .order('penalty_seconds', { ascending: true })
      .order('last_active_at', { ascending: false });
    if (board) leaderboard = board;

    // 3. Pending Fullscreen Requests
    const { data: reqs } = await supabase
      .from('fullscreen_requests')
      .select('id, register_number, status, exited_at')
      .eq('status', 'pending')
      .order('exited_at', { ascending: false });
    if (reqs) requests = reqs;

    // 4. User Roster
    const { data: users } = await supabase
      .from('users')
      .select('register_number, role, created_at')
      .order('created_at', { ascending: false });
    if (users) roster = users;
  } else {
    eventState = localStore.event_state;
    leaderboard = [...localStore.participant_sessions.values()].sort((a,b) => b.score - a.score || a.penalty_seconds - b.penalty_seconds);
    requests = localStore.fullscreen_requests.filter(r => r.status === 'pending');
    roster = [...localStore.users.values()];
  }

  return res.status(200).json({
    event_state: eventState,
    leaderboard,
    requests,
    roster
  });
}
