// api/_lib/schedule.js
// Server copy of DATA.timing in tech-blitz-jane-protocol.html. Keep the two in sync.
const MIN = 60000;
const READING_MIN = 5;
const SECTIONS = [['cho', 15], ['rigsby', 15], ['van-pelt', 15], ['lisbon', 20]];

// Returns { open, close } (ms) for a puzzle id like 'van-pelt-b', or null if unknown.
export function windowFor(puzzleId, startMs) {
  const det = String(puzzleId).replace(/-[ab]$/, '');
  let t = startMs + READING_MIN * MIN;
  for (const [id, min] of SECTIONS) {
    if (id === det) return { open: t, close: t + min * MIN };
    t += min * MIN;
  }
  return null;
}

// Error message if the puzzle can't be acted on right now, else null.
export function windowError(puzzleId, eventState, nowMs = Date.now()) {
  if (!eventState?.is_started || !eventState.server_start_time) return 'The event has not started';
  const w = windowFor(puzzleId, new Date(eventState.server_start_time).getTime());
  if (!w) return 'Unknown puzzle';
  if (nowMs < w.open) return 'This section is not open yet';
  if (nowMs > w.close + 5000) return 'This section has closed'; // 5s grace for network lag
  return null;
}
