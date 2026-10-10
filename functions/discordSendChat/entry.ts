import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const webhookUrl = secrets.get('DISCORD_WEBHOOK_URL');
    if (!webhookUrl) return Response.json({ error: 'Webhook not configured' }, { status: 500 });

    const body = await req.json();
    const { username, content, avatarUrl, imageUrl } = body || {};

    if (!content?.trim() && !imageUrl) return Response.json({ ok: true, skipped: true });

    const payload = {
      content: (content || '').slice(0, 2000),
      username: username ? `${username} (ICECREAMET)` : 'ICECREAMET Player',
      avatar_url: avatarUrl || undefined
    };
    if (imageUrl) {
      payload.embeds = [{ image: { url: imageUrl } }];
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return Response.json({ error: `Discord API error: ${response.status}` }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}