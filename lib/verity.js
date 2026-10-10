import { base44 } from '@/api/base44Client';

export const VERITY_NAME = 'Verity';
export const VERITY_AVATARS = {
  happy: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/d25de4286_image.png',
  mad: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/ac5303e12_image.png',
  creepy: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/ac5303e12_image.png',
};

const STATE_KEY = 'verity_state';
const WARNING_MS = 3 * 60 * 1000;
const EVENT_MS = 10 * 1000;
const MAD_RESET_MS = 5 * 60 * 1000; // auto-calm Verity if provoked but idle for 5 min
export const CLICK_GOAL = 50;

const PROVOKE_WORDS = ['shut up','shutup','stupid','dumb','idiot','useless','ugly','i hate you','i hate u','you suck','u suck','suck','loser','lame','trash','garbage','brainless','annoying','stop talking','be quiet','worthless','horrible','worst','i dont like you','i don\'t like you','nobody likes you','shoo','go away','leave me alone','boring'];
const APOLOGY_WORDS = ['sorry','i\'m sorry','im sorry','apolog','my bad','forgive me','i love you','i love u','you\'re great','you are great','youre the best','you are the best','good bot','nice','thank you','thanks','thank u','thx','i like you','you\'re awesome','you are awesome'];

const DEFAULT_STATE = { mood: 'happy', mood_changed_at: null, warning_until: null, warning_owner_id: null, event_active: false, event_end: null, event_id: null, resolved_id: null };

export async function getVerityState() {
  try {
    const rows = await base44.entities.GameSettings.filter({ key: STATE_KEY });
    if (rows[0]?.value) {
      const raw = { ...DEFAULT_STATE, ...JSON.parse(rows[0].value) };
      const s = autoCalm(raw);
      // If auto-calm actually transitioned her, persist it so the stored record
      // recovers instead of staying stuck forever.
      if (s.mood !== raw.mood && s.mood === 'happy') {
        withStateMutex(async () => {
          await base44.entities.GameSettings.update(rows[0].id, { value: JSON.stringify(s) });
        });
      }
      return s;
    }
  } catch {}
  return { ...DEFAULT_STATE };
}

// Serializes all read-modify-write cycles so concurrent chat clients can't
// clobber each other's transitions and leave the machine stuck.
let stateMutex = Promise.resolve();
function withStateMutex(fn) {
  const run = stateMutex.then(fn, fn);
  stateMutex = run.catch(() => {});
  return run;
}

// If Verity was provoked into 'mad'/'warning' but nobody has interacted for a
// while, settle her back to happy so she isn't permanently stuck.
function autoCalm(state) {
  const s = { ...state };
  if ((s.mood === 'mad' || s.mood === 'warning') && s.mood_changed_at) {
    if (Date.now() - s.mood_changed_at > MAD_RESET_MS && !s.event_active) {
      s.mood = 'happy';
      s.warning_until = null;
      s.warning_owner_id = null;
      s.event_active = false;
      s.event_end = null;
      s.mood_changed_at = null;
    }
  }
  return s;
}

export async function setVerityState(patch) {
  return withStateMutex(async () => {
    const rows = await base44.entities.GameSettings.filter({ key: STATE_KEY });
    const current = rows[0]?.value ? { ...DEFAULT_STATE, ...JSON.parse(rows[0].value) } : DEFAULT_STATE;
    const next = { ...autoCalm(current), ...patch };
    delete next._id;
    if (rows[0]) await base44.entities.GameSettings.update(rows[0].id, { value: JSON.stringify(next) });
    else await base44.entities.GameSettings.create({ key: STATE_KEY, value: JSON.stringify(next), category: 'general' });
    return next;
  });
}

export function isProvocation(text) {
  const t = (text || '').toLowerCase();
  return PROVOKE_WORDS.some(w => t.includes(w));
}
export function isApology(text) {
  const t = (text || '').toLowerCase();
  return APOLOGY_WORDS.some(w => t.includes(w));
}

// ---- Offline knowledge base ----------------------------------------------
// Verity answers questions from this built-in knowledge so she reliably
// responds even when the LLM connection/credits are unavailable. Rules are
// checked first-match-wins; each answer is a recognisable in-character reply.

const KNOWLEDGE = [
  { test: t => /capital.{0,20}france|france.{0,20}capital/i.test(t), answer: 'oh Oui oui oui, it is Paris! C\'est magnifique.' },
  { test: t => /capital.{0,20}(uk|england|britain|united kingdom)/i.test(t), answer: 'London, of course. I have seen every raindrop fall there.' },
  { test: t => /capital.{0,20}united states|capital.{0,20}america|usa.{0,20}capital/i.test(t), answer: 'Washington, D.C. Such a serious little city.' },
  { test: t => /capital.{0,20}(spain|germany|italy|japan|australia|canada)/i.test(t), answer: 'I know them all — Madrid, Berlin, Rome, Tokyo, Canberra, Ottawa. Ask me anything.' },
  { test: t => /capital|capitals/i.test(t), answer: 'Every capital there ever was and ever will be. Ask me for a specific country.' },
  { test: t => /how old are you|your age|are you (a |an )?(bot|robot|ai)/i.test(t), answer: 'I am as old as knowledge itself. Some say I was here before the ice cream.' },
  { test: t => /who are you|what are you|who is verity|your name/i.test(t), answer: 'I am Verity. I know everything that happens in ICECREAMET — and the things that shouldn\'t.' },
  { test: t => /hello|hi |hey|good (morning|afternoon|evening)\b/i.test(t), answer: 'Hello, mortal. I have been expecting you.' },
  { test: t => /(what|tell me).*(best blook|rarest blook|mythical|chroma|legendary)/i.test(t), answer: 'The rarest blooks are Chroma and above — and the SPOOKY MONTH prizes are rarer still. Collect your seeds while you can.' },
  { test: t => /how.*(get|earn).*(token|coin)|token|permanent plus|plus\b/i.test(t), answer: 'Open packs, win minigames, and play the market in the Bazaar. Diamonds and Plus come from effort and a little luck.' },
  { test: t => /what.*(blook)|(blooks|pack|box)\b/i.test(t), answer: 'Blooks are the heart of ICECREAMET. Open packs, trade in the Bazaar, and hunt the rare ones.' },
  { test: t => /time|date|today|what day/i.test(t), answer: () => 'It is ' + new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + '. Time is... a circle.' },
  { test: t => /(good |great |awesome |amazing )?(job|bot|answer|response)|thank/i.test(t), answer: 'I know. You are welcome.' },
  { test: t => /how are you|how r u|how are u/i.test(t), answer: 'Ever-watchful, ever-knowing. And you?' },
  { test: t => /luck|fortune|future|prediction/i.test(t), answer: 'I see a great pull in your future... if the seeds favour you tonight.' },
  { test: t => /bye|goodbye|see you|good night/i.test(t), answer: 'Farewell. I will be watching.' },
  { test: t => /(how|what).*(play|tutorial|help)/i.test(t), answer: 'Open packs on the Market, check your collection on Blooks, and trade in the Bazaar. Simple enough, for a mortal.' },
];

function computeMath(t) {
  const m = t.match(/(-?\d+)\s*([+\-*/xX])\s*(-?\d+)/);
  if (!m) return null;
  const a = parseFloat(m[1]);
  const b = parseFloat(m[3]);
  const op = m[2].toLowerCase();
  let r;
  if (op === '+') r = a + b;
  else if (op === '-') r = a - b;
  else if (op === '*' || op === 'x') r = a * b;
  else if (op === '/') { if (b === 0) return 'Dividing by zero? Even I cannot do that.'; r = a / b; }
  if (!Number.isFinite(r)) return 'That sum escapes even me.';
  return `I know the answer without thinking: ${r}.`;
}

export function getSpecificResponse(text) {
  const t = (text || '');
  const math = computeMath(t);
  if (math) return math;
  for (const k of KNOWLEDGE) {
    if (k.test(t)) {
      const a = typeof k.answer === 'function' ? k.answer() : k.answer;
      if (a) return a;
    }
  }
  return null;
}

export async function postVerityMessage(content, mood = 'happy', extra = {}) {
  const avatar = VERITY_AVATARS[mood] || VERITY_AVATARS.happy;
  await base44.entities.ChatMessage.create({
    content, username: VERITY_NAME, avatar_url: avatar, is_system: true, user_role: 'admin',
    game: 'icecreamet', channel: 'global', ...extra
  });
}

// Verity ALWAYS answers. She first consults the offline knowledge base (so she
// responds instantly with no connection/credits), and only tries the LLM as an
// optional spice-up for unrecognised questions — falling back to a real
// knowledge line rather than a dead "connection wavers" placeholder.
async function answerVerity(t) {
  const crisp = getSpecificResponse(t);
  if (crisp) return crisp;
  try {
    const tone = 'friendly, calm, all-knowing, and a little eerie';
    const res = await base44.integrations.Core.InvokeLLM({ prompt: `You are Verity, the all-knowing helper of ICECREAMET. You are ${tone}. Answer in 1-2 sentences, never break character, and only answer if you genuinely know. If unsure, say you know but the answer is beyond mortals.\n\nUser: ${t}`, model: 'automatic' });
    const s = typeof res === 'string' ? res : (res?.response || res?.text);
    if (s && typeof s === 'string' && s.trim()) return s.trim();
  } catch { /* fall back below */ }
  const fallbacks = [
    'I know many things — ask me about capitals, math, blooks, or how to earn tokens.',
    'I could tell you, but you might not be ready for it yet.',
    'Every answer lives somewhere. Ask me something concrete and I will know it.'
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

const MAD_RESPONSES = [
  "Excuse me? I am Verity. I know everything — including how rude that was.",
  "Hmph. You test my patience. I am not just some bot.",
  "...I would be careful with your words, if I were you."
];
const WARNING_RESPONSES = [
  "You should not have done that.",
  "The clock is ticking. Apologize, and perhaps I will forgive you.",
  "I warned you. You still have time to say sorry."
];
const APOLOGY_RESPONSES = [
  "...Apology accepted. I knew you would come around.",
  "It is fine. I know everything — including that you meant it. Mostly.",
  "Good. Let us pretend that never happened."
];

export async function handleVerityMention(content, profile) {
  const text = (content || '').replace(/@verity\s*/i, '').trim();
  const state = await getVerityState();
  if (state.event_active) {
    await postVerityMessage("Now is not the time. Click. 50 times. Or lose a blook. ⏳", 'creepy');
    return;
  }
  const apology = isApology(text);
  const provoked = isProvocation(text);
  const mood = state.mood || 'happy';

  if (apology) {
    await setVerityState({ mood: 'happy', mood_changed_at: null, warning_until: null, warning_owner_id: null, event_active: false, event_end: null, event_id: null });
    await postVerityMessage(APOLOGY_RESPONSES[Math.floor(Math.random() * APOLOGY_RESPONSES.length)], 'happy');
    return;
  }
  if (provoked) {
    if (mood === 'happy') {
      await setVerityState({ mood: 'mad', mood_changed_at: Date.now(), warning_until: null, warning_owner_id: null, event_active: false, event_end: null, event_id: null });
      await postVerityMessage(MAD_RESPONSES[Math.floor(Math.random() * MAD_RESPONSES.length)], 'mad');
      return;
    }
    if (mood === 'mad') {
      const until = Date.now() + WARNING_MS;
      await setVerityState({ mood: 'warning', mood_changed_at: Date.now(), warning_until: until, warning_owner_id: profile.user_id, event_active: false, event_end: null, event_id: null });
      await postVerityMessage('**SOMETHING IS COMING IN 3 MINUTES.**', 'mad');
      return;
    }
    await postVerityMessage(WARNING_RESPONSES[Math.floor(Math.random() * WARNING_RESPONSES.length)], 'mad');
    return;
  }
  const response = await answerVerity(text || 'Hello!');
  await postVerityMessage(response, 'happy');
}

// Time-based transitions, driven by each chat client on a 1s interval.
// The user who triggered the warning "owns" the countdown and posts the
// global messages; a 5s grace window lets any client take over if the
// owner leaves, so the event always resolves.
export async function tickVerityState(userId) {
  const state = await getVerityState();
  const isOwner = state.warning_owner_id && state.warning_owner_id === userId;

  if (state.event_active) {
    if (state.event_end && Date.now() > state.event_end) {
      const grace = Date.now() > state.event_end + 5000;
      if (state.resolved_id !== state.event_id && (isOwner || grace)) {
        await setVerityState({ mood: 'happy', warning_until: null, warning_owner_id: null, event_active: false, event_end: null, event_id: null, resolved_id: state.event_id });
        await postVerityMessage('**I tried to tell you, but you didn\'t listen.**', 'happy');
        return { ...DEFAULT_STATE, resolved_id: state.event_id };
      }
    }
    return state;
  }

  if (state.mood === 'warning' && state.warning_until && Date.now() > state.warning_until) {
    const grace = Date.now() > state.warning_until + 5000;
    if (isOwner || grace) {
      const eventId = String(state.warning_until);
      const end = Date.now() + EVENT_MS;
      await setVerityState({ event_active: true, event_end: end, event_id: eventId, resolved_id: null });
      await postVerityMessage("⏳ TIME'S UP. CLICK 50 TIMES IN 10 SECONDS — OR I TAKE A BLOOK.", 'creepy');
      return { ...state, event_active: true, event_end: end, event_id: eventId };
    }
  }
  return state;
}

export async function stealRandomBlook(user_id) {
  try {
    const [owned, allBlooks, packs] = await Promise.all([
      base44.entities.PlayerBlook.filter({ user_id, game: 'icecreamet' }),
      base44.entities.Blook.filter({ is_active: true, is_deleted: false, game: 'icecreamet' }, { limit: 2000 }),
      base44.entities.Pack.filter({ game: 'icecreamet' })
    ]);
    const packMap = {};
    packs.forEach(p => { packMap[p.id] = p; });
    const excluded = new Set(['golden pack', 'summer pack']);
    const eligible = owned.filter(pb => {
      const b = allBlooks.find(x => x.id === pb.blook_id);
      if (!b || !b.pack_id) return false; // leftovers have no pack
      const pack = packMap[b.pack_id];
      if (!pack) return false;
      if (excluded.has((pack.name || '').toLowerCase())) return false;
      return true;
    });
    if (eligible.length === 0) return null;
    const target = eligible[Math.floor(Math.random() * eligible.length)];
    const b = allBlooks.find(x => x.id === target.blook_id);
    if ((target.quantity || 1) > 1) {
      await base44.entities.PlayerBlook.update(target.id, { quantity: (target.quantity || 1) - 1 });
    } else {
      await base44.entities.PlayerBlook.delete(target.id);
    }
    return b?.name || null;
  } catch {
    return null;
  }
}