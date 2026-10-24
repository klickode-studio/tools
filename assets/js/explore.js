// Explore: every tool card floating on an endless canvas. Drag, scroll or swipe to move around;
// cards wrap at the edges so there's no end. A slower, blurred copy of the cards drifts behind for
// depth. Without this script the page is a normal grid.
import { $ } from './ui.js';

const box = $('#explore');
const grid = $('#world .tool-grid');
const input = $('#ex-q');
const hint = $('#ex-hint');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

document.body.classList.add('ex-live');

// A fixed-seed random, so the layout is the same on every visit.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const cards = [...grid.querySelectorAll('.tool-card')];
const items = cards.map((card) => {
  const el = document.createElement('div');
  el.className = 'ex-item';
  card.before(el);
  el.append(card);
  card.draggable = false;
  return { el, card, depth: 1, x: 0, y: 0 };
});
// The far layer: copies of the cards, hidden from assistive tech and the keyboard.
const ghosts = cards.map((card) => {
  const el = document.createElement('div');
  el.className = 'ex-ghost';
  el.setAttribute('aria-hidden', 'true');
  el.inert = true;
  const copy = card.cloneNode(true);
  copy.removeAttribute('href');
  el.append(copy);
  grid.prepend(el);
  return { el, depth: 0.45, scale: 0.42 + rand() * 0.12, x: 0, y: 0 };
});

let tileW = 0;
let tileH = 0;
let cellW = 0;
let cardW = 0;

// Cards sit on a loose grid inside a tile at least a card bigger than the screen, so a card is
// always off screen when it wraps round to the other side.
function layout() {
  seed = 7;
  cardW = items[0].el.offsetWidth;
  const cardH = Math.max(...items.map((i) => i.el.offsetHeight));
  const n = items.length;
  const cols = Math.max(3, Math.ceil(Math.sqrt(n * 1.6)));
  const rows = Math.ceil(n / cols);
  cellW = Math.max(cardW + 110, Math.ceil((box.clientWidth + cardW * 2) / cols));
  const cellH = Math.max(cardH + 90, Math.ceil((box.clientHeight + cardH * 2) / rows));
  tileW = cols * cellW;
  tileH = rows * cellH;
  items.forEach((it, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    it.x = c * cellW + (rand() - 0.5) * (cellW - cardW) * 0.7;
    it.y = r * cellH + (c % 2 ? cellH * 0.38 : 0) + (rand() - 0.5) * (cellH - cardH) * 0.6;
  });
  for (const g of ghosts) {
    g.x = rand() * tileW;
    g.y = rand() * tileH;
  }
}

// --- movement -------------------------------------------------------------------------------------

let panX = 0;
let panY = 0;
let velX = 0;
let velY = 0;
const DRIFT_X = still ? 0 : -0.22;
const DRIFT_Y = still ? 0 : -0.12;
let mouseX = 0; // -1..1 across the canvas, for a little parallax
let mouseY = 0;
let parX = 0;
let parY = 0;
let dragging = false;
let idleSince = performance.now();
let target = null; // { x, y } pan to glide to (search, keyboard focus)

const wrap = (v, size) => ((v % size) + size) % size;

function place(it, scale = 1) {
  const x = wrap(it.x + panX * it.depth + parX * it.depth * 26 + cellW, tileW) - cellW;
  const y = wrap(it.y + panY * it.depth + parY * it.depth * 18 + cellW, tileH) - cellW;
  it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)${scale !== 1 ? ` scale(${scale})` : ''}`;
  it.sx = x;
  it.sy = y;
}

function frame(now) {
  if (target) {
    velX = (target.x - panX) * 0.08;
    velY = (target.y - panY) * 0.08;
    if (Math.abs(target.x - panX) < 0.5 && Math.abs(target.y - panY) < 0.5) target = null;
  } else if (!dragging) {
    // Momentum fades out, then the canvas settles into a slow drift.
    const settled = now - idleSince > 1200;
    velX = still ? 0 : velX * 0.94 + (settled ? (DRIFT_X - velX) * 0.02 : 0);
    velY = still ? 0 : velY * 0.94 + (settled ? (DRIFT_Y - velY) * 0.02 : 0);
  }
  if (!dragging) {
    panX += velX;
    panY += velY;
  }
  if (!still) {
    parX += (mouseX - parX) * 0.05;
    parY += (mouseY - parY) * 0.05;
  }
  for (const g of ghosts) place(g, g.scale);
  for (const it of items) place(it);
  requestAnimationFrame(frame);
}

// Drag with mouse, finger or pen. A drag that moves more than a few pixels isn't a click.
let start = null;
let moved = 0;
box.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest('.ex-bar')) return;
  start = { x: e.clientX, y: e.clientY, panX, panY, t: e.timeStamp };
  moved = 0;
  target = null;
});
addEventListener('pointermove', (e) => {
  const r = box.getBoundingClientRect();
  mouseX = ((e.clientX - r.left) / r.width - 0.5) * 2;
  mouseY = ((e.clientY - r.top) / r.height - 0.5) * 2;
  if (!start) return;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  moved = Math.max(moved, Math.hypot(dx, dy));
  if (moved > 6 && !dragging) {
    dragging = true;
    box.classList.add('dragging');
    box.setPointerCapture?.(e.pointerId);
    hideHint();
  }
  if (!dragging) return;
  const nx = start.panX + dx;
  const ny = start.panY + dy;
  velX = nx - panX;
  velY = ny - panY;
  panX = nx;
  panY = ny;
});
const release = () => {
  start = null;
  if (!dragging) return;
  dragging = false;
  box.classList.remove('dragging');
  idleSince = performance.now();
};
addEventListener('pointerup', release);
addEventListener('pointercancel', release);
box.addEventListener('click', (e) => {
  if (moved > 6) {
    e.preventDefault();
    moved = 0;
  }
}, true);

// Trackpads and mouse wheels pan too.
box.addEventListener(
  'wheel',
  (e) => {
    if (e.ctrlKey) return; // pinch-zoom stays the browser's
    e.preventDefault();
    target = null;
    panX -= e.deltaX;
    panY -= e.deltaY;
    velX = -e.deltaX * 0.3;
    velY = -e.deltaY * 0.3;
    idleSince = performance.now();
    hideHint();
  },
  { passive: false },
);

// Arrow keys pan; Tab moves through the cards and the canvas glides to the one in focus.
box.addEventListener('keydown', (e) => {
  if (e.target === input) return;
  const step = { ArrowLeft: [160, 0], ArrowRight: [-160, 0], ArrowUp: [0, 160], ArrowDown: [0, -160] }[e.key];
  if (!step) return;
  e.preventDefault();
  target = { x: (target?.x ?? panX) + step[0], y: (target?.y ?? panY) + step[1] };
  idleSince = performance.now();
});
box.addEventListener('focusin', (e) => {
  // Only for keyboard focus: a mouse press also focuses the card, and that's the start of a drag.
  const it = items.find((i) => i.card === e.target);
  if (it && e.target.matches(':focus-visible')) centre(it);
});

// Glide so a card ends up in the middle of the screen, the short way round.
function centre(it) {
  const cx = box.clientWidth / 2 - it.el.offsetWidth / 2;
  const cy = box.clientHeight / 2 - it.el.offsetHeight / 2;
  const near = (d, size) => d - size * Math.round(d / size);
  target = { x: panX + near(cx - it.sx, tileW), y: panY + near(cy - it.sy, tileH) };
  idleSince = performance.now();
}

// --- search ---------------------------------------------------------------------------------------

input?.addEventListener('input', () => {
  const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
  let first = null;
  for (const it of items) {
    const hit = words.every((w) => it.card.dataset.search.includes(w));
    it.el.classList.toggle('ex-dim', words.length > 0 && !hit);
    it.el.classList.toggle('ex-match', words.length > 0 && hit);
    it.card.tabIndex = hit ? 0 : -1;
    if (hit && !first) first = it;
  }
  if (words.length && first) centre(first);
  $('#ex-none').hidden = !words.length || Boolean(first);
  hideHint();
});
input?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const first = items.find((i) => i.el.classList.contains('ex-match'));
  if (first) first.card.click();
});

// --- start ----------------------------------------------------------------------------------------

function hideHint() {
  hint?.classList.add('gone');
}
setTimeout(hideHint, 4000);

layout();
// Start with the first cards near the middle of the screen.
panX = box.clientWidth / 2 - items[0].x - cardW / 2 - cellW;
panY = box.clientHeight / 3 - items[0].y;
for (const it of items) place(it);
// Cards float in from nearest the middle outwards.
for (const it of items) {
  const d = Math.hypot(it.sx + cardW / 2 - box.clientWidth / 2, it.sy - box.clientHeight / 2);
  it.el.style.setProperty('--delay', `${Math.min(0.9, d / 1800).toFixed(2)}s`);
  it.el.classList.add('ex-in');
}
addEventListener('resize', layout);
requestAnimationFrame(frame);
