// api/admin/add-user.js
// Admin Endpoint: Add Participant or Admin to Roster
import { supabase, localStore } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { register_number, role = 'participant' } = req.body || {};
  const regNum = String(register_number || '').trim();
  const key = role === 'participant' ? regNum.toUpperCase() : regNum; // participants are stored upper-case

  if (!regNum) {
    return res.status(400).json({ error: 'Register number is required' });
  }
  if (!['admin', 'participant'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or participant' });
  }

  if (supabase) {
    const { error: insertError } = await supabase
      .from('users')
      .upsert({
        register_number: key,
        role,
        created_by: auth.user.register_number
      });

    if (insertError) {
      return res.status(500).json({ error: 'Database insert failed: ' + insertError.message });
    }

    if (role === 'participant') {
      await supabase
        .from('participant_sessions')
        .upsert({
          register_number: key,
          score: 0,
          is_blocked: false
        });
    }
  } else {
    localStore.users.set(key.toLowerCase(), { register_number: key, role, created_at: new Date().toISOString() });
    if (role === 'participant' && !localStore.participant_sessions.has(key)) {
      localStore.participant_sessions.set(key, {
        register_number: key, score: 0, hints_used: 0, penalty_seconds: 0,
        accusation_suspect: null, is_blocked: false, last_active_at: new Date().toISOString()
      });
    }
  }

  return res.status(200).json({
    success: true,
    user: { register_number: key, role }
  });
}
