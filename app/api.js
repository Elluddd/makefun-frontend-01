// make.fun's public API: read-only GET requests, open to any origin (CORS).
// Docs: https://make.fun/api/openapi.json — every route below answers JSON.

const API = 'https://make.fun/api';

async function get(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json();
}

/** All competitions (open, judging, done): { items: [...] }. One call, grouped client-side. */
export const getAllBounties = () => get('/competitions?activity=times');

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: { columns, entries, phase, views, ... }. */
export const getLeaderboard = (slug, view) =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard${view ? `?view=${encodeURIComponent(view)}` : ''}`);

/** An account's public profile, by handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);

/** Latest entries across the site (live feed). */
export const getLatestEntries = (limit = 12) => get(`/activity/entries/latest?limit=${limit}`);

/** Payout totals: { paid_usd, window_days, series }. */
export const getPayouts = () => get('/activity/payouts');

/** Site totals: { entries: { total, series } }. */
export const getStats = () => get('/activity/stats');
