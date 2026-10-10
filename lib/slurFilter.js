// Slur detection hardened against bypasses. Input is lowercased, leet-speak is
// decoded, separators/punctuation are stripped, and repeated characters are
// collapsed to a canonical form before matching — so variants like "n1gger",
// "n.i.g.g.e.r", or "nnniggga" are all caught. Known safe words (Nigeria,
// snigger, niggardly…) are removed first to avoid false positives.

const LEET_MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '8': 'b' };

function normalizeForSlur(text) {
  if (!text) return '';
  let s = String(text).toLowerCase();
  for (const [k, v] of Object.entries(LEET_MAP)) s = s.split(k).join(v);
  s = s.replace(/[^a-z]/g, '');       // strip separators / punctuation
  s = s.replace(/(.)\1+/g, '$1');     // collapse repeated chars
  return s;
}

// Collapsed safe words to exclude before matching.
const SAFE_WORDS = ['nigeria', 'nigerian', 'sniger', 'nigard', 'nigardly', 'nigardlines'];
// Collapsed banned roots.
const BANNED_ROOTS = ['niger', 'niga'];

export function containsSlur(text) {
  if (!text) return false;
  let s = normalizeForSlur(text);
  for (const w of SAFE_WORDS) s = s.split(w).join('');
  return BANNED_ROOTS.some(r => s.includes(r));
}

// IP-address sharing attempts. Catches plain IPs, "dot"-spelled ones, and
// separator tricks ("192 168 1 1", "192-168-1-1", "192dot168dot1dot1"), while
// leaving ordinary numbers and times alone (each octet must be a valid 0-255).
export function containsIpAttempt(text) {
  if (!text) return false;
  let s = String(text).toLowerCase();
  // Words used to hide the dots.
  s = s.replace(/\bd[o0]t\b/g, '.').replace(/\[dot\]/g, '.').replace(/\(dot\)/g, '.');
  // Collapse separators that sit directly between digits into a dot.
  s = s.replace(/(\d)[\s.\-_,|:;'"·•]+(?=\d)/g, '$1.');
  // IPv4: four dotted octets, each 0-255.
  const v4 = s.match(/(?:^|[^\d.])((?:\d{1,3}\.){3}\d{1,3})(?![\d.])/);
  if (v4) {
    const octets = v4[1].split('.').map(Number);
    if (octets.length === 4 && octets.every(n => n >= 0 && n <= 255)) return true;
  }
  // IPv6-ish: 3+ colon-separated hex groups.
  if (/(?:^|[^0-9a-f])(?:[0-9a-f]{1,4}:){3,}[0-9a-f]{1,4}(?![0-9a-f])/i.test(String(text))) return true;
  return false;
}