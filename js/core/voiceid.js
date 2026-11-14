// voiceId(speaker, mood, text) -> 'v' + 10 hex chars.
// FNV-1a 64-bit over the UTF-8 bytes of `${speaker}|${mood}|${text}`, where text has its whitespace
// collapsed to single spaces and trimmed. The id is the first 10 hex chars of the zero-padded 16-char hash.
// Works in the browser and in Node (tools/voice-build.mjs imports this file).
const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

export function normText(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

export function voiceId(speaker = 'gm', mood = 'warm', text = '') {
  const key = `${speaker || 'gm'}|${mood || 'warm'}|${normText(text)}`;
  const bytes = new TextEncoder().encode(key);
  let h = OFFSET;
  for (const b of bytes) { h ^= BigInt(b); h = (h * PRIME) & MASK; }
  return 'v' + h.toString(16).padStart(16, '0').slice(0, 10);
}

export default voiceId;
