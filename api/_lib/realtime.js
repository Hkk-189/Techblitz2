// api/_lib/realtime.js
// Supabase Realtime Broadcast Event Dispatcher
import { supabase } from './db.js';

export async function broadcastEvent(channelName, eventName, payload) {
  if (!supabase) {
    console.warn(`[REALTIME MOCK] (${channelName}) -> ${eventName}:`, payload);
    return;
  }

  try {
    const channel = supabase.channel(channelName);
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: eventName,
      payload
    });
    // Remove channel subscription to prevent leaking WebSocket handles in serverless
    await supabase.removeChannel(channel);
  } catch (err) {
    console.error(`[REALTIME ERROR] Failed to broadcast ${eventName} on ${channelName}:`, err);
  }
}
