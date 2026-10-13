// qa/test-api.mjs - Quick test for API endpoints
import syncHandler from '../api/clock/sync.js';
import loginHandler from '../api/auth/login.js';
import submitHandler from '../api/submissions.js';
import hintHandler from '../api/hints.js';
import addUserHandler from '../api/admin/add-user.js';
import removeHandler from '../api/admin/remove-user.js';
import { localStore } from '../api/_lib/db.js';
import { checkAnswer, getHint, checkAccusation } from '../api/_lib/answers.js';
import { signToken, verifyToken } from '../api/_lib/auth.js';

console.log('--- Testing Answer Evaluation ---');
console.assert(checkAnswer('cho-a', '9:43') === true, 'cho-a 9:43 should be true');
console.assert(checkAnswer('cho-a', '  9:43 PM  ') === true, 'cho-a with spaces/PM should be true');
console.assert(checkAnswer('cho-a', '10:00') === false, 'cho-a wrong time should be false');
console.assert(checkAnswer('lisbon-a', '5') === true, 'lisbon-a 5 should be true');
console.assert(checkAnswer('lisbon-a', 'mine = 5') === true, 'lisbon-a mine=5 should be true');
console.assert(checkAccusation('sam') === true, 'Accusation sam should be true');
console.assert(checkAccusation('owen') === false, 'Accusation owen should be false');
console.assert(getHint('cho-a') !== null, 'Hint for cho-a should exist');
console.log('Answer checks passed.');

console.log('--- Testing JWT Auth Tokens ---');
const token = signToken({ register_number: 'Gowtham123', role: 'admin' });
const verified = verifyToken(token);
console.assert(verified !== null && verified.role === 'admin', 'Token verification should succeed with role admin');
console.assert(verifyToken(token + 'tampered') === null, 'Tampered token must fail');
console.log('Auth checks passed.');

console.log('--- Testing API Handlers ---');
const mockRes = () => {
  const r = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { r.headers[k] = v; },
    status(c) { r.statusCode = c; return r; },
    json(d) { r.data = d; return r; }
  };
  return r;
};

// Clock sync test
const syncRes = mockRes();
syncHandler({ method: 'GET', headers: {} }, syncRes);
console.assert(typeof syncRes.data.server_time === 'number', 'server_time should be a number');
console.log('Sync handler returned:', syncRes.data);

// Login test
const loginRes = mockRes();
await loginHandler({ method: 'POST', body: { register_number: 'Gowtham123' } }, loginRes);
console.assert(loginRes.data.role === 'admin', 'Gowtham123 must receive admin role');
console.assert(typeof loginRes.data.token === 'string', 'Login must issue token');
console.log('Login handler returned:', loginRes.data.role, loginRes.data.register_number);

// Submission rules (local store): event gate, Part A -> B order, dedup, one hint per puzzle
const call = async (h, body, tok) => { const r = mockRes(); await h({ method: 'POST', body, headers: { authorization: 'Bearer ' + tok } }, r); return r; };
const stu = signToken({ register_number: '21BCE1001', role: 'participant' });
console.assert((await call(submitHandler, { puzzle_id: 'cho-a', submitted_answer: '9:43' }, stu)).statusCode === 403, 'submit before start must 403');
localStore.event_state = { is_started: true, server_start_time: new Date(Date.now() - 6 * 60000).toISOString() }; // reading over, Cho open
console.assert((await call(submitHandler, { puzzle_id: 'cho-b', submitted_answer: 'x' }, stu)).statusCode === 403, 'Part B before Part A must 403');
console.assert((await call(submitHandler, { puzzle_id: 'rigsby-a', submitted_answer: 'x' }, stu)).statusCode === 403, 'later section must 403');
const first = await call(submitHandler, { puzzle_id: 'cho-a', submitted_answer: '9:43' }, stu);
const again = await call(submitHandler, { puzzle_id: 'cho-a', submitted_answer: '9:43' }, stu);
console.assert(first.statusCode === 200 && again.data.recorded_at === first.data.recorded_at, 'duplicate returns original receipt');
console.assert(localStore.participant_sessions.get('21BCE1001').score === 1, 'duplicate must not double-score');
await call(hintHandler, { puzzle_id: 'cho-b' }, stu); await call(hintHandler, { puzzle_id: 'cho-b' }, stu);
console.assert(localStore.participant_sessions.get('21BCE1001').penalty_seconds === 60, 'one hint per puzzle');
const adm = signToken({ register_number: 'Gowtham123', role: 'admin' });
console.assert((await call(removeHandler, { register_number: 'gowtham123' }, adm)).statusCode === 400, 'primary admin protected');
console.assert((await call(removeHandler, { register_number: '21bce1001' }, adm)).statusCode === 200 && !localStore.users.has('21bce1001'), 'remove is case-insensitive');
// Authorize a new participant, then they can log in (any letter case)
console.assert((await call(addUserHandler, { register_number: '22bce2002' }, stu)).statusCode === 403, 'participant cannot add users');
console.assert((await call(addUserHandler, { register_number: '22bce2002' }, adm)).data.user.register_number === '22BCE2002', 'participant stored upper-case');
const newLogin = await call(loginHandler, { register_number: '22bce2002' });
console.assert(newLogin.data.role === 'participant' && newLogin.data.register_number === '22BCE2002', 'added participant can log in');
console.log('Submission rule checks passed.');

console.log('ALL MILESTONE 1 BACKEND TESTS PASSED SUCCESSFULLY!');
