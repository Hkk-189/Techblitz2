// api/clock/sync.js
// Authoritative Server Time Synchronization Endpoint

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Prevent any intermediate proxy caching so timestamps are accurate
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  return res.status(200).json({
    server_time: Date.now()
  });
}
