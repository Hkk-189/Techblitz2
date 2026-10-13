// api/auth/login.js
// Single Login Endpoint: Admin & Participant Verification
import { supabase, localStore } from '../_lib/db.js';
import { signToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { register_number } = req.body || {};
  const regNum = String(register_number || '').trim();

  if (!regNum) {
    return res.status(400).json({ error: 'Register number is required' });
  }

  // 1. Check for Default Admin: "Gowtham123"
  const isDefaultAdmin = regNum.toLowerCase() === 'gowtham123';
  const canonicalRegNum = isDefaultAdmin ? 'Gowtham123' : regNum;

  let role = isDefaultAdmin ? 'admin' : 'participant';

  if (supabase) {
    // Query database users roster
    const { data: user, error } = await supabase
      .from('users')
      .select('register_number, role')
      .eq('register_number', canonicalRegNum)
      .single();

    if (error || !user) {
      if (isDefaultAdmin) {
        await supabase
          .from('users')
          .insert({ register_number: 'Gowtham123', role: 'admin' })
          .select()
          .single();
        role = 'admin';
      } else {
        return res.status(403).json({
          error: 'Register number not found in event roster. Contact administrator.'
        });
      }
    } else {
      role = user.role;
    }

    if (role === 'participant') {
      const { data: existingSession } = await supabase
        .from('participant_sessions')
        .select('is_blocked')
        .eq('register_number', canonicalRegNum)
        .single();

      if (!existingSession) {
        await supabase
          .from('participant_sessions')
          .insert({ register_number: canonicalRegNum, score: 0, is_blocked: false });
      } else {
        await supabase
          .from('participant_sessions')
          .update({ last_active_at: new Date().toISOString() })
          .eq('register_number', canonicalRegNum);
      }
    }
  } else {
    // Local fallback for local dev & testing
    const lookup = localStore.users.get(canonicalRegNum.toLowerCase());
    if (!lookup && !isDefaultAdmin) {
      return res.status(403).json({
        error: 'Register number not found in event roster. Contact administrator.'
      });
    }
    if (lookup) {
      role = lookup.role;
    } else if (isDefaultAdmin) {
      localStore.users.set('gowtham123', { register_number: 'Gowtham123', role: 'admin' });
      role = 'admin';
    }

    if (role === 'participant' && !localStore.participant_sessions.has(canonicalRegNum)) {
      localStore.participant_sessions.set(canonicalRegNum, {
        register_number: canonicalRegNum,
        score: 0,
        hints_used: 0,
        penalty_seconds: 0,
        accusation_suspect: null,
        is_blocked: false,
        last_active_at: new Date().toISOString()
      });
    }
  }

  // Generate signed JWT session token
  const token = signToken({
    register_number: canonicalRegNum,
    role
  });

  return res.status(200).json({
    token,
    role,
    register_number: canonicalRegNum
  });
}
