// Small helpers for showing API values, plus a tiny safe markdown renderer
// (the API returns descriptions and rules as markdown).

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('772.00', 500 or 0.5) as '$772' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** A big count as '13,286'. */
export function count(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
}

/** A deadline as a date in UTC. */
export function date(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** The time until a deadline: '2d 4h left', '5h 12m left', '42m left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/** Countdown urgency: 'hot' under 6h, 'warm' under 24h, '' otherwise (or 'ended'). */
export function urgency(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  if (ms < 6 * 3600000) return 'hot';
  if (ms < 24 * 3600000) return 'warm';
  return '';
}

/** '3m ago', '2h ago', 'Nov 16'. */
export function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Inline markdown: **bold**, `code`, [text](url) — applied after escaping. */
function inlineMd(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

/** A small, safe subset of markdown to HTML: ## / ### headings, - lists, paragraphs. */
export function markdown(src) {
  const lines = String(src ?? '').split('\n');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    if (h2) { closeList(); html += `<h2>${inlineMd(esc(h2[1]))}</h2>`; }
    else if (h3) { closeList(); html += `<h3>${inlineMd(esc(h3[1]))}</h3>`; }
    else if (li) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inlineMd(esc(li[1]))}</li>`;
    } else {
      closeList();
      html += `<p>${inlineMd(esc(line))}</p>`;
    }
  }
  closeList();
  return html;
}

/** First paragraph of a markdown text, plain, for card summaries. */
export function firstParagraph(src, maxLen = 160) {
  const text = String(src ?? '')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen - 1).trimEnd() + '…' : text;
}
