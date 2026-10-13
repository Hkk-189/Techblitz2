// api/admin/add-user.js
// Admin Endpoint: Add Participant or Admin to Roster
import { supabase } from '../_lib/db.js';
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
        register_number: regNum,
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
          register_number: regNum,
          score: 0,
          is_blocked: false
        });
    }
  }

  return res.status(200).json({
    success: true,
    user: { register_number: regNum, role }
  });
}
