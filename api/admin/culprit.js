// api/admin/culprit.js
// Admin Endpoint: Reveal the culprit (the answer key never ships to participants)
import { requireAdmin } from '../_lib/auth.js';
import { getCulprit } from '../_lib/answers.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  return res.status(200).json({ culprit: getCulprit() });
}
