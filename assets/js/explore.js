// Explore: every tool card floating on an endless canvas, around a Klickode welcome card. Drag,
// scroll or swipe to move around; cards wrap at the edges so there's no end. Cards sit a little
// tilted and bob gently, never touching; faint category icons and the dot grid drift behind at a
// slower pace for depth. Pick a category and its tools line up in an orbit around the welcome card,
// zoomed to fit the screen. Without this script the page is a normal grid.
import { $, escapeHtml, recentTools } from './ui.js';

const box = $('#explore');
const grid = $('#world .tool-grid');
const heroCard = $('#ex-hero');
const input = $('#ex-q');
const hint = $('#ex-hint');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 640px)');

document.body.classList.add('ex-live');

// A fixed-seed random, so the layout is the same on every visit.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function float(el, cls, rot) {
  const wrapEl = document.createElement('div');
  wrapEl.className = cls;
  el.before(wrapEl);
  wrapEl.append(el);
  wrapEl.style.setProperty('--rot', `${rot.toFixed(2)}deg`);
  return wrapEl;
}

// The welcome card floats with the others, first in line, so the page opens on it.
const hero = { el: float(heroCard, 'ex-item ex-hero-item', -1.5), card: null, depth: 1, phase: 0 };
grid.prepend(hero.el);
const items = [
  hero,
  ...[...grid.querySelectorAll('.tool-card')].map((card) => {
    card.draggable = false;
    return { el: float(card, 'ex-item', (rand() - 0.5) * 5), card, cat: card.dataset.category, depth: 1, phase: rand() * Math.PI * 2 };
  }),
];
let shown = items; // the welcome card plus the chosen category's tools
let activeCat = '';

// The far layer: small, faint category icons, behind the cards. Small enough that passing behind a
// card never looks like two cards on top of each other.
const icons = [...document.querySelectorAll('#ex-cat-menu [data-cat] svg')].map((svg) => [svg.closest('[data-cat]').dataset.cat, svg]);
const motes = Array.from({ length: icons.length ? 18 : 0 }, (_, i) => {
  const [cat, svg] = icons[i % icons.length];
  const el = document.createElement('span');
  el.className = 'ex-mote';
  el.dataset.category = cat;
  el.setAttribute('aria-hidden', 'true');
  el.append(svg.cloneNode(true));
  grid.prepend(el);
  return { el, depth: 0.35 + rand() * 0.15, phase: rand() * Math.PI * 2, size: 0.8 + rand() * 0.7 };
});
// The dot grid moves too, slower still.
const dots = document.createElement('div');
dots.className = 'ex-dots';
dots.setAttribute('aria-hidden', 'true');
box.prepend(dots);

let mode = 'field'; // 'field': every tool scattered; 'orbit': one category around the welcome card
let scale = 1; // how big cards are drawn: smaller on phones, and zoomed out to fit an orbit
let tileW = 0;
let tileH = 0;
let margin = 0; // a card's width on screen: how far off screen a card goes before it wraps round
let ring = null; // { cx, cy, rx, ry, n } for the orbit, in screen pixels
let spin = 0;
let hovering = false;

const sizeOf = (list) => ({ w: Math.max(...list.map((i) => i.el.offsetWidth)), h: Math.max(...list.map((i) => i.el.offsetHeight)) });

// Scattered field: a loose grid with cells big enough for the largest card, so cards never touch
// however they're nudged, tilted or bobbing. The tile is at least a card bigger than the screen, so
// a card is always off screen when it wraps round to the other side.
function layoutField(base) {
  scale = base;
  const { w, h } = sizeOf(shown);
  const cardW = w * scale;
  const cardH = h * scale;
  const n = shown.length;
  const cols = Math.max(3, Math.ceil(Math.sqrt(n * 1.6)));
  const rows = Math.ceil(n / cols);
  const gapX = small.matches ? 44 : 120;
  const gapY = small.matches ? 40 : 100;
  const cellW = Math.max(cardW + gapX, Math.ceil((box.clientWidth + cardW * 2) / cols));
  const cellH = Math.max(cardH + gapY, Math.ceil((box.clientHeight + cardH * 2) / rows));
  tileW = cols * cellW;
  tileH = rows * cellH;
  margin = cardW;
  // Each card moves at most a third of the spare room either way, so neighbours keep a gap.
  shown.forEach((it, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    it.x = c * cellW + (cellW - cardW) / 2 + (rand() - 0.5) * (cellW - cardW) * 0.6;
    it.y = r * cellH + (cellH - cardH) / 2 + (c % 2 ? cellH * 0.38 : 0) + (rand() - 0.5) * (cellH - cardH) * 0.6;
  });
}

// Orbit: the category's tools evenly round an ellipse with the welcome card in the middle. The
// ellipse grows until no two cards (or a card and the middle one) could touch at any point as it
// turns, then the whole thing is zoomed to fit between the corner controls and the dock.
function layoutOrbit(base) {
  const tools = shown.filter((i) => i.card);
  const n = tools.length;
  const { w, h } = sizeOf(tools);
  const hw = hero.el.offsetWidth;
  const hh = hero.el.offsetHeight;
  const gap = 34;
  const top = 76;
  const bottom = 104;
  const availW = box.clientWidth - 32;
  const availH = box.clientHeight - top - bottom;
  // Wide screens get a wide oval, phones held upright a tall one, so the orbit uses the space there is.
  const aspect = Math.min(1.9, Math.max(0.5, (availW - w) / Math.max(availH - h, 1)));
  const clear = (ax, ay, aw, ah, bx, by, bw, bh) => Math.abs(ax - bx) * 2 >= aw + bw + gap * 2 || Math.abs(ay - by) * 2 >= ah + bh + gap * 2;
  const fits = (rx, ry) => {
    for (let k = 0; k < 8; k++) {
      const turn = (k / 8) * ((2 * Math.PI) / n);
      const pts = tools.map((_, i) => {
        const a = -Math.PI / 2 + turn + (i * 2 * Math.PI) / n;
        return [rx * Math.cos(a), ry * Math.sin(a)];
      });
      for (let i = 0; i < n; i++) {
        if (!clear(pts[i][0], pts[i][1], w, h, 0, 0, hw, hh)) return false;
        for (let j = i + 1; j < n; j++) if (!clear(pts[i][0], pts[i][1], w, h, pts[j][0], pts[j][1], w, h)) return false;
      }
    }
    return true;
  };
  let ry = Math.max(hh, h) / 2;
  while (!fits(ry * aspect, ry) && ry < 4000) ry += 8;
  const rx = ry * aspect;
  scale = Math.min(base, availW / (rx * 2 + w), availH / (ry * 2 + h));
  // A big tile, so the next copy of the orbit is well off screen.
  tileW = (rx * 2 + w) * scale + box.clientWidth * 2;
  tileH = (ry * 2 + h) * scale + box.clientHeight * 2;
  margin = w * scale;
  ring = { cx: tileW / 2, cy: tileH / 2, rx: rx * scale, ry: ry * scale, n, w: w * scale, h: h * scale };
  hero.x = ring.cx - (hw * scale) / 2;
  hero.y = ring.cy - (hh * scale) / 2;
  tools.forEach((it, i) => (it.slot = i));
  orbit();
}

// Where each card sits on the orbit right now.
function orbit() {
  for (const it of shown) {
    if (!it.card) continue;
    const a = -Math.PI / 2 + spin + (it.slot * 2 * Math.PI) / ring.n;
    it.x = ring.cx + ring.rx * Math.cos(a) - ring.w / 2;
    it.y = ring.cy + ring.ry * Math.sin(a) - ring.h / 2;
  }
}

function layout() {
  seed = 11;
  const base = small.matches ? 0.55 : 1;
  const tools = shown.length - 1;
  mode = activeCat && tools >= 2 && tools <= 12 ? 'orbit' : 'field';
  box.classList.toggle('ex-orbit', mode === 'orbit');
  if (mode === 'orbit') layoutOrbit(base);
  else layoutField(base);
  for (const m of motes) {
    m.x = rand() * tileW;
    m.y = rand() * tileH;
  }
}

// --- movement -------------------------------------------------------------------------------------

let panX = 0;
let panY = 0;
let velX = 0;
let velY = 0;
const DRIFT_X = still ? 0 : -0.2;
const DRIFT_Y = still ? 0 : -0.1;
let mouseX = 0; // -1..1 across the canvas, for a little parallax
let mouseY = 0;
let parX = 0;
let parY = 0;
let dragging = false;
let idleSince = performance.now();
let target = null; // { x, y } pan to glide to (search, keyboard focus)
let clock = 0;
let last = 0;

const wrap = (v, size) => ((v % size) + size) % size;

function place(it, s = 1) {
  const bob = still ? 0 : Math.sin(clock * 0.0011 + it.phase) * 5 * scale;
  const x = wrap(it.x + panX * it.depth + parX * it.depth * 26 + margin, tileW) - margin;
  const y = wrap(it.y + panY * it.depth + parY * it.depth * 18 + bob + margin, tileH) - margin;
  it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(s * scale).toFixed(3)})`;
  it.sx = x;
  it.sy = y;
}

function frame(now) {
  const dt = Math.min(64, now - (last || now));
  last = now;
  clock = now;
  if (target) {
    velX = (target.x - panX) * 0.08;
    velY = (target.y - panY) * 0.08;
    if (Math.abs(target.x - panX) < 0.5 && Math.abs(target.y - panY) < 0.5) target = null;
  } else if (!dragging) {
    // Momentum fades out, then the field settles into a slow drift (an orbit stays put and turns).
    const settled = now - idleSince > 1200;
    const dx = mode === 'field' ? DRIFT_X : 0;
    const dy = mode === 'field' ? DRIFT_Y : 0;
    velX = still ? 0 : velX * 0.94 + (settled ? (dx - velX) * 0.02 : 0);
    velY = still ? 0 : velY * 0.94 + (settled ? (dy - velY) * 0.02 : 0);
  }
  if (!dragging) {
    panX += velX;
    panY += velY;
  }
  if (!still) {
    parX += (mouseX - parX) * 0.05;
    parY += (mouseY - parY) * 0.05;
  }
  // The orbit turns once every two minutes, and holds still while a card is under the pointer.
  if (mode === 'orbit' && !still && !hovering && !dragging) {
    spin += (dt * 2 * Math.PI) / 120000;
    orbit();
  }
  for (const m of motes) {
    place(m, m.size);
  }
  dots.style.transform = `translate3d(${(wrap(panX * 0.3, 22) - 22).toFixed(1)}px, ${(wrap(panY * 0.3, 22) - 22).toFixed(1)}px, 0)`;
  for (const it of shown) place(it);
  requestAnimationFrame(frame);
}
grid.addEventListener('pointerover', (e) => (hovering = Boolean(e.target.closest('.ex-item .tool-card'))));
grid.addEventListener('pointerleave', () => (hovering = false));

// Drag with mouse, finger or pen. A drag that moves more than a few pixels isn't a click.
// The floating controls take their own clicks and scrolling; the canvas doesn't move under them.
const CONTROLS = '.ex-dock, .ex-corner, .ex-logo';
let start = null;
let moved = 0;
box.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest(CONTROLS)) return;
  start = { x: e.clientX, y: e.clientY, panX, panY };
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
box.addEventListener(
  'click',
  (e) => {
    if (moved > 6) {
      e.preventDefault();
      moved = 0;
    }
  },
  true,
);

// Trackpads and mouse wheels pan too.
box.addEventListener(
  'wheel',
  (e) => {
    if (e.ctrlKey || e.target.closest(CONTROLS)) return; // pinch-zoom stays the browser's; menus scroll themselves
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

// Where a card has to go for it to sit in the middle of the screen, the short way round.
function centred(it) {
  const cx = (box.clientWidth - it.el.offsetWidth * scale) / 2;
  const cy = (box.clientHeight - it.el.offsetHeight * scale) / 2;
  const near = (d, size) => d - size * Math.round(d / size);
  return { x: panX + near(cx - it.sx, tileW), y: panY + near(cy - it.sy, tileH) };
}
function centre(it) {
  target = centred(it);
  idleSince = performance.now();
}

// --- search: suggestions open above the dock and the canvas glides to the highlighted tool ----------

const suggest = $('#ex-suggest');
let options = []; // the items listed in the suggestions
let active = -1;

const matches = (it, words) => words.every((w) => it.card.dataset.search.includes(w));

function showSuggest(open) {
  suggest.hidden = !open;
  input.setAttribute('aria-expanded', String(open));
}

function setActive(i) {
  active = i;
  suggest.querySelectorAll('[role="option"]').forEach((o, j) => o.setAttribute('aria-selected', String(j === i)));
  input.setAttribute('aria-activedescendant', i >= 0 ? `ex-opt-${i}` : '');
  if (i >= 0) {
    suggest.querySelector(`#ex-opt-${i}`)?.scrollIntoView({ block: 'nearest' });
    centre(options[i]);
  }
}

// Typing filters; with the box empty it offers the tools used last, or the popular ones.
function refresh() {
  const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
  let label = '';
  if (words.length) options = shown.filter((it) => it.card && matches(it, words)).slice(0, 6);
  else {
    const bySlug = (slug) => shown.find((it) => it.card?.dataset.slug === slug);
    const recent = recentTools().map(bySlug).filter(Boolean);
    options = (recent.length ? recent : suggest.dataset.popular.split(',').map(bySlug).filter(Boolean)).slice(0, 5);
    label = recent.length ? suggest.dataset.recentLabel : suggest.dataset.popularLabel;
  }
  for (const it of shown) {
    const hit = !words.length || (it.card && matches(it, words));
    it.el.classList.toggle('ex-dim', !hit);
    it.el.classList.toggle('ex-match', words.length > 0 && hit);
    if (it.card) it.card.tabIndex = hit ? 0 : -1;
  }
  suggest.innerHTML =
    (label && options.length ? `<p class="ex-suggest-label">${escapeHtml(label)}</p>` : '') +
    (options.length
      ? options
          .map(
            (it, i) =>
              `<div role="option" id="ex-opt-${i}" class="ex-opt" data-i="${i}" aria-selected="false">${it.card.querySelector('.tool-icon')?.outerHTML ?? ''}<span><b>${escapeHtml(it.card.querySelector('strong').textContent)}</b><small>${escapeHtml(it.card.querySelector('.desc')?.textContent ?? '')}</small></span></div>`,
          )
          .join('')
      : `<p class="ex-suggest-empty">${escapeHtml(suggest.dataset.none)}</p>`);
  showSuggest(document.activeElement === input);
  setActive(words.length && options.length ? 0 : -1);
  if (words.length && !options.length) centre(hero);
  hideHint();
}

input.addEventListener('focus', refresh);
input.addEventListener('input', refresh);
input.addEventListener('blur', () => setTimeout(() => document.activeElement !== input && showSuggest(false), 120));
input.addEventListener('keydown', (e) => {
  const n = options.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (n) setActive(((active < 0 ? (e.key === 'ArrowDown' ? -1 : 0) : active) + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
  } else if (e.key === 'Enter') {
    const it = options[active >= 0 ? active : 0];
    if (it) {
      e.preventDefault();
      it.card.click();
    }
  } else if (e.key === 'Escape') {
    if (input.value) {
      input.value = '';
      refresh();
    } else input.blur();
  }
});
// Keep focus in the box while choosing with the mouse, then open the tool.
suggest.addEventListener('pointerdown', (e) => e.preventDefault());
suggest.addEventListener('click', (e) => {
  const o = e.target.closest('[data-i]');
  if (o) options[Number(o.dataset.i)]?.card.click();
});
suggest.addEventListener('pointermove', (e) => {
  const o = e.target.closest('[data-i]');
  if (o && Number(o.dataset.i) !== active) setActive(Number(o.dataset.i));
});

// "/" or Ctrl/⌘+K anywhere jumps to the search box.
addEventListener(
  'keydown',
  (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '');
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      input.focus();
    }
  },
  true,
);

// --- corner controls: logo, theme, more menu; and the dice ------------------------------------------

$('#ex-logo').addEventListener('click', (e) => {
  e.preventDefault();
  centre(hero);
});
$('#ex-theme').addEventListener('click', () => $('#theme-toggle')?.click());

const moreBtn = $('#ex-more-btn');
const moreMenu = $('#ex-more-menu');
const moreItems = [...moreMenu.querySelectorAll('[role="menuitem"]')];
function openMore(open) {
  moreMenu.hidden = !open;
  moreBtn.setAttribute('aria-expanded', String(open));
  if (open) moreItems[0].focus();
}
moreBtn.addEventListener('click', () => openMore(moreMenu.hidden));
moreMenu.addEventListener('keydown', (e) => {
  const i = moreItems.indexOf(document.activeElement);
  const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: moreItems.length - 1 }[e.key];
  if (to !== undefined) {
    e.preventDefault();
    moreItems[(to + moreItems.length) % moreItems.length].focus();
  } else if (e.key === 'Escape') {
    openMore(false);
    moreBtn.focus();
  }
});
addEventListener('pointerdown', (e) => {
  if (!moreMenu.hidden && !e.target.closest('.ex-more')) openMore(false);
});

// Surprise me: glide to a random tool and give it a little bounce.
let lastPick = null;
const dice = $('#ex-dice');
dice.addEventListener('click', () => {
  const pool = shown.filter((it) => it.card && it !== lastPick && !it.el.classList.contains('ex-dim'));
  const it = pool[Math.floor(Math.random() * pool.length)];
  if (!it) return;
  lastPick = it;
  centre(it);
  for (const el of [it.el, dice]) {
    el.classList.remove('ex-pick');
    void el.offsetWidth;
    el.classList.add('ex-pick');
  }
  hideHint();
});

// --- start ----------------------------------------------------------------------------------------

function hideHint() {
  hint?.classList.add('gone');
}
setTimeout(hideHint, 4000);

function begin() {
  layout();
  for (const it of shown) place(it);
  ({ x: panX, y: panY } = centred(hero)); // open on the welcome card
  for (const it of shown) place(it);
}
// Cards float in from nearest the middle outwards.
function floatIn() {
  for (const it of shown) {
    const d = Math.hypot(it.sx - box.clientWidth / 2, it.sy - box.clientHeight / 2);
    it.el.style.setProperty('--delay', `${Math.min(0.9, d / 1800).toFixed(2)}s`);
    it.el.classList.remove('ex-in');
    void it.el.offsetWidth; // restart the animation
    it.el.classList.add('ex-in');
  }
}

// --- categories: a menu that opens upwards from the search bar --------------------------------------

const catBtn = $('#ex-cat-btn');
const catMenu = $('#ex-cat-menu');
const catOptions = [...catMenu.querySelectorAll('[data-cat]')];
const params = new URLSearchParams(location.search);
const eyebrow = heroCard.querySelector('.eyebrow');
const allTools = eyebrow.textContent;

function openMenu(open) {
  catMenu.hidden = !open;
  catBtn.setAttribute('aria-expanded', String(open));
  if (open) (catOptions.find((o) => o.getAttribute('aria-checked') === 'true') ?? catOptions[0]).focus();
}

// Swap the cards on the canvas: the old ones float away, the chosen ones float back in.
let switching = false;
async function showCategory(id, animate = true) {
  if (switching) return;
  switching = true;
  for (const o of catOptions) o.setAttribute('aria-checked', String(o.dataset.cat === id));
  const label = catOptions.find((o) => o.dataset.cat === id).querySelector('span').textContent;
  $('#ex-cat-label').textContent = label;
  if (animate && !still) {
    box.classList.add('ex-out');
    await new Promise((r) => setTimeout(r, 260));
  }
  activeCat = id;
  spin = 0;
  shown = items.filter((it) => !it.card || !id || it.cat === id);
  for (const it of items) it.el.hidden = !shown.includes(it);
  // The welcome card names the category and how many tools are in it.
  eyebrow.textContent = id ? `${label} · ${shown.length - 1}` : allTools;
  if (input.value) {
    input.value = '';
    input.dispatchEvent(new Event('input'));
  }
  begin();
  box.classList.remove('ex-out');
  floatIn();
  const url = new URL(location.href);
  if (id) url.searchParams.set('cat', id);
  else url.searchParams.delete('cat');
  history.replaceState(null, '', url);
  switching = false;
}

catBtn.addEventListener('click', () => openMenu(catMenu.hidden));
catMenu.addEventListener('click', (e) => {
  const o = e.target.closest('[data-cat]');
  if (!o) return;
  openMenu(false);
  catBtn.focus();
  if (o.getAttribute('aria-checked') !== 'true') showCategory(o.dataset.cat);
});
catMenu.addEventListener('keydown', (e) => {
  const i = catOptions.indexOf(document.activeElement);
  const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: catOptions.length - 1 }[e.key];
  if (to !== undefined) {
    e.preventDefault();
    catOptions[(to + catOptions.length) % catOptions.length].focus();
  } else if (e.key === 'Escape' || e.key === 'Tab') {
    openMenu(false);
    if (e.key === 'Escape') catBtn.focus();
  }
});
addEventListener('pointerdown', (e) => {
  if (!catMenu.hidden && !e.target.closest('.ex-cats')) openMenu(false);
});

// --- start ----------------------------------------------------------------------------------------

const startCat = params.get('cat');
if (startCat && catOptions.some((o) => o.dataset.cat === startCat)) showCategory(startCat, false);
else {
  begin();
  floatIn();
}
addEventListener('resize', layout);
small.addEventListener('change', begin);
requestAnimationFrame(frame);
