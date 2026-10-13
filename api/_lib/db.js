// api/_lib/db.js
// Authoritative Supabase Database Client (Server-Side with Service Role)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[DB WARNING] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Check .env configuration.');
}

export const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

// Resilient in-memory local store for development & automated tests
export const localStore = {
  users: new Map([
    ['gowtham123', { register_number: 'Gowtham123', role: 'admin', created_at: new Date().toISOString() }],
    ['21bce1001', { register_number: '21BCE1001', role: 'participant', created_at: new Date().toISOString() }]
  ]),
  event_state: {
    id: 1,
    is_started: false,
    server_start_time: null,
    total_duration_ms: 4200000
  },
  participant_sessions: new Map([
    ['21BCE1001', {
      register_number: '21BCE1001',
      score: 0,
      hints_used: 0,
      penalty_seconds: 0,
      accusation_suspect: null,
      is_blocked: false,
      last_active_at: new Date().toISOString()
    }]
  ]),
  submissions: [],
  fullscreen_requests: []
};
