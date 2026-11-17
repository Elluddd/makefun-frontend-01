// A make.fun frontend: board, bounty page, leaderboard and profile on hash routes.
//
//   #/                          the bounty board
//   #/bounty/<slug>             one bounty
//   #/bounty/<slug>/leaderboard that bounty's leaderboard
//   #/u/<handle>                an account's public profile
//   #/live                      live entries
//   #/how                       how it works
//
// window.__shotReady is false while a page loads and true once its data is on
// screen, so a screenshot script knows when to capture.

import { getAllBounties, getBounty, getLatestEntries, getLeaderboard, getPayouts, getProfile, getStats } from './api.js';
import { board, bounty, bountyCard, how, leaderboard, livePage, profile } from './views.js';
import { timeLeft } from './format.js';

const app = document.getElementById('app');
let boardCache = null; // { items } — fetched once, filtered client-side
let tickTimer = null;

function loading() {
  app.innerHTML = '<div class="wrap loading"><span class="spin"></span><p>Loading live data from make.fun…</p></div>';
}

function failed(err, what) {
  app.innerHTML = `<div class="wrap"><div class="error-box"><b>Couldn’t load ${what}.</b><br>${err.message}. Check your connection and try again — the data comes straight from make.fun’s public API.</div>
  <p><a href="#/">← Back to all bounties</a></p></div>`;
}

function ready() {
  window.__shotReady = true;
}

function startCountdowns() {
  stopCountdowns();
  const update = () => {
    document.querySelectorAll('[data-deadline]').forEach((el) => {
      el.textContent = timeLeft(el.getAttribute('data-deadline'));
    });
  };
  tickTimer = setInterval(update, 30000);
}

function stopCountdowns() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
}

function setNav(route) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === route);
  });
}

/* ---- board filtering (client-side over the cached list) ---- */
let boardState = { filter: 'all', sort: 'pot', q: '' };

function statusOf(b) {
  const s = (b.status || '').toLowerCase();
  if (s === 'open') return 'open';
  if (s === 'judging' || s === 'grading') return 'judging';
  return 'done';
}

function applyBoardFilter() {
  const cards = document.getElementById('cards');
  const empty = document.getElementById('board-empty');
  if (!cards || !boardCache) return;
  let list = boardCache.items.slice();
  if (boardState.filter !== 'all') list = list.filter((b) => statusOf(b) === boardState.filter);
  if (boardState.q) {
    const q = boardState.q.toLowerCase();
    list = list.filter((b) =>
      (b.title || '').toLowerCase().includes(q) ||
      (b.skills || []).some((s) => s.toLowerCase().includes(q)) ||
      (b.category || '').toLowerCase().includes(q));
  }
  if (boardState.sort === 'pot') list.sort((a, b) => Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0));
  else if (boardState.sort === 'deadline') list.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  else if (boardState.sort === 'entries') list.sort((a, b) => (b.submissionCount || 0) - (a.submissionCount || 0));
  else if (boardState.sort === 'az') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  cards.innerHTML = list.map((b) => bountyCard(b)).join('');
  if (empty) empty.hidden = list.length > 0;
}

async function renderBoard() {
  setNav('board');
  loading();
  try {
    const [data, live, payouts, stats] = await Promise.all([
      boardCache ? Promise.resolve(boardCache) : getAllBounties(),
      getLatestEntries(12).catch(() => ({ entries: [] })),
      getPayouts().catch(() => null),
      getStats().catch(() => null),
    ]);
    boardCache = data;
    app.innerHTML = board(data, live, payouts, stats);
    // Wire the filters.
    document.querySelectorAll('#filters .tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#filters .tabs button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        boardState.filter = btn.dataset.filter;
        applyBoardFilter();
      });
    });
    const sort = document.getElementById('sort');
    if (sort) sort.addEventListener('change', () => { boardState.sort = sort.value; applyBoardFilter(); });
    const q = document.getElementById('board-q');
    if (q) q.addEventListener('input', () => { boardState.q = q.value.trim(); applyBoardFilter(); });
    applyBoardFilter();
    startCountdowns();
    ready();
  } catch (err) {
    failed(err, 'the bounty board');
  }
}

async function renderBounty(slug) {
  setNav('board');
  loading();
  try {
    const b = await getBounty(slug);
    app.innerHTML = bounty(b);
    startCountdowns();
    ready();
  } catch (err) {
    failed(err, 'that bounty');
  }
}

async function renderLeaderboard(slug) {
  setNav('boards');
  loading();
  const view = new URLSearchParams((location.hash.split('?')[1] || '')).get('view');
  try {
    const lb = await getLeaderboard(slug, view);
    app.innerHTML = leaderboard(lb);
    document.querySelectorAll('.viewtabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        // Views are server-side variants; reload the leaderboard for the chosen view.
        location.hash = `#/bounty/${encodeURIComponent(slug)}/leaderboard?view=${encodeURIComponent(btn.dataset.view)}`;
      });
    });
    ready();
  } catch (err) {
    failed(err, 'that leaderboard');
  }
}

async function renderProfile(handle) {
  setNav('');
  loading();
  try {
    const p = await getProfile(handle);
    document.title = `@${p.handle} | make.fun`;
    app.innerHTML = profile(p);
    ready();
  } catch (err) {
    failed(err, 'that profile');
  }
}

async function renderLive() {
  setNav('live');
  loading();
  try {
    const [live, payouts] = await Promise.all([
      getLatestEntries(20).catch(() => ({ entries: [] })),
      getPayouts().catch(() => null),
    ]);
    app.innerHTML = livePage(live, payouts);
    ready();
  } catch (err) {
    failed(err, 'the live feed');
  }
}

function renderHow() {
  setNav('');
  app.innerHTML = how();
  ready();
}

async function render() {
  window.__shotReady = false;
  stopCountdowns();
  const hash = location.hash || '#/';
  const mBountyLb = hash.match(/^#\/bounty\/([^/?]+)\/leaderboard/);
  const mBounty = hash.match(/^#\/bounty\/([^/?]+)/);
  const mProfile = hash.match(/^#\/u\/([^/?]+)/);
  if (mBountyLb) { await renderLeaderboard(decodeURIComponent(mBountyLb[1])); return; }
  if (mBounty) { await renderBounty(decodeURIComponent(mBounty[1])); return; }
  if (mProfile) { await renderProfile(decodeURIComponent(mProfile[1])); return; }
  if (hash.startsWith('#/live')) { await renderLive(); return; }
  if (hash.startsWith('#/how')) { renderHow(); return; }
  await renderBoard();
}

// The top search jumps to the board filtered by the query, or to a profile
// when the query looks like a handle.
document.getElementById('topsearch').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = document.getElementById('topsearch-q').value.trim();
  if (!q) return;
  if (q.startsWith('@')) { location.hash = `#/u/${encodeURIComponent(q.slice(1))}`; return; }
  boardState.q = q;
  if ((location.hash || '#/') !== '#/') { location.hash = '#/'; setTimeout(applyBoardFilter, 0); }
  else { const input = document.getElementById('board-q'); if (input) { input.value = q; applyBoardFilter(); } }
});

window.addEventListener('hashchange', render);
render();
