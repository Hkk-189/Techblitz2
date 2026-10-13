// api/admin/remove-user.js
// Admin Endpoint: Remove Student from Registered User Database
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

  const regNum = String(req.body?.register_number || '').trim();

  if (!regNum) {
    return res.status(400).json({ error: 'Register number is required' });
  }

  if (regNum.toLowerCase() === 'gowtham123' || regNum.toLowerCase() === auth.user.register_number.toLowerCase()) {
    return res.status(400).json({ error: 'Cannot remove primary administrator or your own account' });
  }

  if (supabase) {
    // submissions, hints, fullscreen_requests, participant_sessions go via ON DELETE CASCADE
    // ilike: match regardless of case; role filter keeps other admins safe
    const { error } = await supabase.from('users').delete().ilike('register_number', regNum.replace(/[\\%_]/g, '\\$&')).eq('role', 'participant');
    if (error) {
      return res.status(500).json({ error: 'Database delete failed: ' + error.message });
    }
  } else {
    const key = regNum.toLowerCase();
    const hit = r => r.register_number.toLowerCase() === key && r.role !== 'admin';
    for (const m of [localStore.users, localStore.participant_sessions]) {
      for (const [k, r] of m.entries()) if (hit(r)) m.delete(k);
    }
    localStore.fullscreen_requests = localStore.fullscreen_requests.filter(r => !hit(r));
    localStore.submissions = localStore.submissions.filter(r => !hit(r));
    localStore.hints = localStore.hints.filter(r => !hit(r));
  }

  return res.status(200).json({ success: true, removed: regNum });
}
