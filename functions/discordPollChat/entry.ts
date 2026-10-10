import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const API = 'https://discord.com/api/v10';

// Module-level caches survive across warm invocations, so repeated polls skip
// the GameSettings reads that used to fire on every call (a major source of
// entity-read traffic when many chat clients poll concurrently).
let _cachedChannelId = null;
let _cachedLastSetting = null;

async function getSetting(base44, key) {
  const settings = await base44.asServiceRole.entities.GameSettings.filter({ key });
  return settings.length > 0 ? settings[0] : null;
}

async function getChannelId(base44) {
  if (_cachedChannelId) return _cachedChannelId;
  const existing = await getSetting(base44, 'discord_channel_id');
  if (existing && existing.value) { _cachedChannelId = existing.value; return _cachedChannelId; }
  throw new Error('Discord channel ID not set. Pass { "channelId": "<id>" } to seed it.');
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const token = secrets.get('DISCORD_BOT_TOKEN');
    if (!token) return Response.json({ error: 'DISCORD_BOT_TOKEN secret not set' }, { status: 500 });

    // Allow passing a channelId in the body to seed it (one-time setup)
    let body = {};
    try { body = await req.json(); } catch {}
    if (body.channelId) {
      const existing = await getSetting(base44, 'discord_channel_id');
      if (existing) {
        await base44.asServiceRole.entities.GameSettings.update(existing.id, { value: body.channelId });
      } else {
        await base44.asServiceRole.entities.GameSettings.create({
          key: 'discord_channel_id', value: body.channelId, category: 'general'
        });
      }
    }

    const channelId = await getChannelId(base44);
    let lastSetting = _cachedLastSetting;
    if (!lastSetting) {
      lastSetting = await getSetting(base44, 'discord_last_message_id');
      _cachedLastSetting = lastSetting;
    }
    const lastMsgId = lastSetting ? lastSetting.value : null;

    // NOTE: Requires the MESSAGE_CONTENT privileged intent enabled on the bot
    // (Discord Developer Portal → Bot → Privileged Gateway Intents → MESSAGE CONTENT INTENT).
    // Without it, content is returned as empty for messages that don't mention the bot.
    const authHeader = { Authorization: `Bot ${token}` };

    // Verify the channel is accessible
    const chanRes = await fetch(`${API}/channels/${channelId}`, { headers: authHeader });
    if (!chanRes.ok) {
      const errText = await chanRes.text();
      throw new Error(`Channel access failed (${chanRes.status}): ${errText}`);
    }
    const chanInfo = await chanRes.json();

    // Always fetch the newest 100 messages. Discord's `after` cursor returns the oldest
    // batch after the cursor, which gets stuck behind large runs of outbound webhook
    // messages and never reaches real user messages. Dedup via discord_msg_id keeps
    // this safe even though we re-fetch the tail every poll.
    const limit = 100;
    const url = `${API}/channels/${channelId}/messages?limit=${limit}`;
    const msgsRes = await fetch(url, { headers: authHeader });
    if (!msgsRes.ok) {
      const errText = await msgsRes.text();
      throw new Error(`Failed to read messages: ${msgsRes.status} ${errText} | channel: ${chanInfo.name} (${chanInfo.type})`);
    }
    let messages = await msgsRes.json();

    // Filter out webhook/bot messages (loop prevention — outbound uses a webhook)
    const userMessages = messages.filter(m => !m.webhook_id && !m.author?.bot);
    // Discord returns newest first; sort oldest first so we import in order
    userMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let newCount = 0;
    // Advance the cursor to the newest message in the channel (including webhooks)
    // so it never gets stuck behind outbound-only runs.
    let newestId = messages.length > 0 ? messages[0].id : lastMsgId;

    // Batch dedup: fetch recent chat messages once and build an in-memory set of
    // already-imported discord_msg_ids. Skipped entirely when there are no new
    // user messages to import (the common case), saving a read every idle poll.
    let existingIds = new Set();
    if (userMessages.length > 0) {
      const recent = await base44.asServiceRole.entities.ChatMessage.filter({ game: 'icecreamet' }, '-created_date', 200);
      existingIds = new Set(recent.map(m => m.discord_msg_id).filter(Boolean));
    }

    for (const msg of userMessages) {
      if (existingIds.has(msg.id)) {
        continue;
      }

      const avatarUrl = msg.author?.avatar
        ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
        : '';

      // Pull image attachments so image-only Discord messages still show up in-game
      const imageUrl = (msg.attachments || []).find(a => a.content_type?.startsWith('image/'))?.url || '';

      await base44.asServiceRole.entities.ChatMessage.create({
        user_id: `discord_${msg.author.id}`,
        username: `[DC] ${msg.author.global_name || msg.author.username}`,
        avatar_url: avatarUrl,
        content: (msg.content || '').slice(0, 1000),
        image_url: imageUrl,
        game: 'icecreamet',
        discord_msg_id: msg.id
      });
      newCount++;
    }

    // Persist the last seen message id
    if (newestId && newestId !== lastMsgId) {
      if (lastSetting) {
        await base44.asServiceRole.entities.GameSettings.update(lastSetting.id, { value: newestId });
      } else {
        const created = await base44.asServiceRole.entities.GameSettings.create({
          key: 'discord_last_message_id', value: newestId, category: 'general'
        });
        _cachedLastSetting = created;
      }
    }

    return Response.json({ ok: true, newCount, channelId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}