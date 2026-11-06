// Runs the user's regex off the main thread, so a catastrophic pattern can be killed, not freeze the tab.
const MAX_MATCHES = 2000;

self.onmessage = ({ data: { id, pattern, flags, text } }) => {
  let regex;
  try {
    regex = new RegExp(pattern, flags);
  } catch (error) {
    self.postMessage({ id, error: error.message });
    return;
  }
  const matches = [];
  const repeat = regex.global;
  let match;
  while (matches.length < MAX_MATCHES && (match = regex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      text: match[0],
      groups: match.slice(1),
      named: match.groups ? { ...match.groups } : null,
    });
    if (!repeat) break;
    if (match[0] === "") regex.lastIndex += 1; // Empty matches would otherwise loop forever.
    if (regex.lastIndex > text.length) break;
  }
  self.postMessage({ id, matches, capped: matches.length >= MAX_MATCHES });
};
