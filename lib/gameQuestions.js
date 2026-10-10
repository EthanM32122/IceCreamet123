let blooksCache = [];

export function initBlookQuestions(blooks) {
  blooksCache = (blooks || []).filter(b => b.image_url && b.name);
}

export function generateQuestion() {
  if (blooksCache.length >= 4) {
    const correct = blooksCache[Math.floor(Math.random() * blooksCache.length)];
    const wrongPool = blooksCache.filter(b => b.id !== correct.id);
    const wrong = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correct, ...wrong].sort(() => Math.random() - 0.5).map(b => b.name);
    return { image_url: correct.image_url, answer: correct.name, options };
  }
  // Fallback: math questions
  const types = ['add', 'sub', 'mul'];
  const type = types[Math.floor(Math.random() * types.length)];
  let a, b, answer, text;
  if (type === 'add') { a = Math.floor(Math.random() * 50) + 1; b = Math.floor(Math.random() * 50) + 1; answer = a + b; text = `${a} + ${b}`; }
  else if (type === 'sub') { a = Math.floor(Math.random() * 50) + 10; b = Math.floor(Math.random() * a) + 1; answer = a - b; text = `${a} − ${b}`; }
  else { a = Math.floor(Math.random() * 11) + 2; b = Math.floor(Math.random() * 11) + 2; answer = a * b; text = `${a} × ${b}`; }
  const opts = new Set([answer]);
  while (opts.size < 4) { const d = Math.floor(Math.random() * 9) - 4; if (d !== 0) opts.add(Math.max(1, answer + d)); }
  return { text, answer, options: [...opts].sort(() => Math.random() - 0.5) };
}