// Heuristic checks that decide whether a submitted question reaches the teacher.
// Order matters: cheap structural checks run before the keyword relevance check.
function filterQuestion(rawText, config) {
  const text = (rawText || '').trim();

  if (!text) {
    return { ok: false, reason: 'Your question is empty.' };
  }

  if (text.length < config.minLength) {
    return {
      ok: false,
      reason: `Your question is too short (minimum ${config.minLength} characters). Please add more detail.`
    };
  }

  if (text.length > 1000) {
    return { ok: false, reason: 'Your question is too long (maximum 1000 characters).' };
  }

  if (!text.includes('?')) {
    return { ok: false, reason: 'Your message must be a question (it should include a "?").' };
  }

  // Catches "aaaaaaaa" / "asdasdasdasd" style spam that slips past a length check.
  if (/(.)\1{5,}/.test(text)) {
    return { ok: false, reason: 'Your question looks like spam or random characters. Please rephrase it.' };
  }

  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 0 && letters.length < text.length * 0.4) {
    return { ok: false, reason: 'Your question contains too many symbols or numbers. Please write it in plain text.' };
  }

  const lower = text.toLowerCase();

  for (const word of config.bannedWords) {
    const w = word.toLowerCase().trim();
    if (!w) continue;
    const pattern = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(lower)) {
      return { ok: false, reason: 'Your question contains language that is not appropriate for this board. Please rephrase it respectfully.' };
    }
  }

  // Relevance check only runs if the teacher configured topic keywords.
  const keywords = (config.keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
  if (keywords.length > 0) {
    const matches = keywords.some(k => lower.includes(k));
    if (!matches) {
      return {
        ok: false,
        reason: `Your question doesn't seem related to "${config.className}". Please make sure it relates to the topics covered in class (e.g. ${keywords.slice(0, 5).join(', ')}).`
      };
    }
  }

  return { ok: true };
}

module.exports = { filterQuestion };
