import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ANNOUNCEMENT = 'EVERYONE JOIN  https://blookverse.bolt.host/ AND  https://dexlet.base44.app/chat';
const BOT_AVATAR = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/5c6cf25a3_1786830938521-ezgif-89c69b824b200526.gif';
const ACTIVE_WINDOW_MS = 10 * 60 * 1000;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    const recent = await db.entities.ChatMessage.filter(
      { game: 'icecreamet', is_deleted: false },
      '-created_date',
      20
    );

    const now = Date.now();
    const hasActivity = recent.some(
      (m) => !m.is_system && m.created_date && new Date(m.created_date).getTime() > now - ACTIVE_WINDOW_MS
    );
    const lastIsAnnouncement =
      recent.length > 0 && recent[0].is_system && recent[0].content === ANNOUNCEMENT;

    // Don't stack copies when the chat is inactive, and don't double-post if
    // the latest message is already this announcement.
    if (!hasActivity || lastIsAnnouncement) {
      return Response.json({ posted: false, reason: !hasActivity ? 'inactive' : 'already_posted' });
    }

    await db.entities.ChatMessage.create({
      content: ANNOUNCEMENT,
      username: 'ICECREAMET Bot',
      avatar_url: BOT_AVATAR,
      is_system: true,
      user_role: 'admin',
      game: 'icecreamet',
      channel: 'global'
    });

    return Response.json({ posted: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}