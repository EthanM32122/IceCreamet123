import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const webhookUrl = secrets.get('DISCORD_WEBHOOK_URL');
    if (!webhookUrl) {
      return Response.json({ error: 'Discord webhook URL not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { username, pulls } = body || {};

    if (!pulls || !pulls.length) {
      return Response.json({ ok: true, skipped: true });
    }

    let content;
    if (pulls.length === 1) {
      const p = pulls[0];
      content = `🎉 **${username}** just pulled a **${p.rarity.toUpperCase()}** **${p.blookName}** from the ${p.packName} pack!`;
    } else {
      const lines = pulls.map(p => `• **${p.rarity.toUpperCase()}** **${p.blookName}** (${p.packName})`).join('\n');
      content = `🎉 **${username}** just pulled ${pulls.length} rare blooks!\n${lines}`;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, username: 'ICECREAMET Bot' })
    });

    if (!response.ok) {
      const text = await response.text();
      return Response.json({ error: `Discord API error: ${text}` }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}