// api/fullscreen/exit.js
// Participant Endpoint: Report Fullscreen Exit Violation
import { supabase, localStore } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';
import { broadcastEvent } from '../_lib/realtime.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const regNum = auth.user.register_number;
  const nowIso = new Date().toISOString();
  let requestId = Date.now();

  if (supabase) {
    // 1. Mark participant as blocked in session
    await supabase
      .from('participant_sessions')
      .update({ is_blocked: true, last_active_at: nowIso })
      .eq('register_number', regNum);

    // 2. Append request to fullscreen_requests queue
    const { data: newReq } = await supabase
      .from('fullscreen_requests')
      .insert({
        register_number: regNum,
        status: 'pending',
        exited_at: nowIso
      })
      .select('id')
      .single();

    if (newReq) requestId = newReq.id;
  } else {
    const session = localStore.participant_sessions.get(regNum);
    if (session) {
      session.is_blocked = true;
      session.last_active_at = nowIso;
    }
    localStore.fullscreen_requests.push({
      id: requestId,
      register_number: regNum,
      status: 'pending',
      exited_at: nowIso
    });
  }

  // 3. Immediately emit real-time event to Admin channel
  await broadcastEvent('admin:live', 'FULLSCREEN_EXITED', {
    request_id: requestId,
    register_number: regNum,
    exited_at: nowIso
  });

  return res.status(200).json({
    status: 'blocked',
    is_blocked: true,
    register_number: regNum,
    request_id: requestId
  });
}
