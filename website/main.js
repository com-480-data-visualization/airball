// =============================================================================
// AIRBALL — NBA Data Story
// Acts 1–5: D3 v7
// =============================================================================

const DATA = { act1: null, act1Shots: null, act1Real: null, act2: null, act3: null, act4: null, act5: null };
const LOADED = new Set();

const DATA_PATHS = {
  act1: '../js/act1_revolution.json',
  act1Shots: '../js/act1_shot_zones.json',
  act1Real: '../js/act1_real_heatmap.json',
  act2: '../js/act2_bubbles.json',
  act3: '../js/act3_players.json',
  act4: '../js/act4_dynasties.json',
  act5: '../js/act5_draft.json',
};

async function ensureLoaded(act) {
  if (LOADED.has(act)) return DATA[act];
  try {
    const r = await fetch(DATA_PATHS[act]);
    DATA[act] = await r.json();
    LOADED.add(act);
    return DATA[act];
  } catch (e) {
    console.warn(`Failed to load ${act}. Run scripts/extract_data.py.`, e);
    return null;
  }
}

// =============================================================================
// CONFETTI (lightweight, one canvas, basketball-orange palette)
// =============================================================================
const confettiCanvas = document.getElementById('confetti');
const confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
let confettiParticles = [];
let confettiAnimating = false;
function sizeConfetti() {
  if (!confettiCanvas) return;
  confettiCanvas.width = window.innerWidth * devicePixelRatio;
  confettiCanvas.height = window.innerHeight * devicePixelRatio;
  confettiCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', sizeConfetti);
sizeConfetti();

function fireConfetti(clientX, clientY, opts = {}) {
  if (!confettiCtx) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const count = opts.count || 50;
  const palette = opts.colors || ['#ff6b1a', '#f5c518', '#4d8dff', '#4ade80', '#ffffff'];
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 6;
    confettiParticles.push({
      x: clientX, y: clientY,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - 2,
      g: 0.18 + Math.random() * 0.08,
      r: 2 + Math.random() * 3,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.3,
      life: 60 + Math.random() * 40,
      color: palette[(Math.random() * palette.length) | 0],
    });
  }
  if (!confettiAnimating) {
    confettiAnimating = true;
    requestAnimationFrame(tickConfetti);
  }
}
function tickConfetti() {
  confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  confettiParticles = confettiParticles.filter(p => {
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.rv;
    p.life -= 1;
    if (p.life <= 0 || p.y > window.innerHeight + 40) return false;
    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rot);
    confettiCtx.fillStyle = p.color;
    confettiCtx.globalAlpha = Math.min(1, p.life / 30);
    confettiCtx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
    confettiCtx.restore();
    return true;
  });
  if (confettiParticles.length) requestAnimationFrame(tickConfetti);
  else confettiAnimating = false;
}

// =============================================================================
// HYBRID SCROLL NARRATIVE
// =============================================================================
const sections = ['hero', 'act1', 'act2', 'act3', 'act4', 'act5', 'takeaway'];
const sectionRenderPromises = new Map();

function setActiveSection(id) {
  document.querySelectorAll('.nav-act').forEach(el => {
    el.classList.toggle('active', el.dataset.section === id);
  });
  sections.forEach(s => document.getElementById(s)?.classList.toggle('visible', s === id));
}

async function renderSection(id) {
  if (sectionRenderPromises.has(id)) return sectionRenderPromises.get(id);
  const promise = (async () => {
    if (id === 'hero') {
      await ensureLoaded('act1');
      drawHeroChart();
    }
    if (id === 'act1') {
      await Promise.all([ensureLoaded('act1'), ensureLoaded('act1Shots'), ensureLoaded('act1Real')]);
      drawAct1(act1Step);
      drawSmallMults();
      initShotZoneHeatmap();
    }
    if (id === 'act2') {
      await ensureLoaded('act2');
      drawAct2();
    }
    if (id === 'act3') {
      await ensureLoaded('act3');
      initAct3Defaults();
    }
    if (id === 'act4') {
      await ensureLoaded('act4');
      buildDynastyLegend();
      drawAct4();
    }
    if (id === 'act5') {
      await ensureLoaded('act5');
      drawDraftHeatmap();
    }
  })();
  sectionRenderPromises.set(id, promise);
  return promise;
}

async function showSection(id, opts = {}) {
  const target = document.getElementById(id);
  if (!target) return;
  setActiveSection(id);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = opts.instant || reduce ? 'auto' : 'smooth';
  target.scrollIntoView({ block: 'start', behavior });
  await renderSection(id);
}

function setupScrollNarrative() {
  setActiveSection('hero');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const id = visible.target.id;
      setActiveSection(id);
      renderSection(id);
    }, { rootMargin: '-35% 0px -45% 0px', threshold: [0.12, 0.32, 0.55] });
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  } else {
    sections.forEach(id => renderSection(id));
  }
  syncActiveSectionFromScroll();
}

let sectionSyncFrame = null;
function syncActiveSectionFromScroll() {
  const marker = window.innerHeight * 0.42;
  let current = sections[0];
  let bestDistance = Infinity;
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const containsMarker = rect.top <= marker && rect.bottom >= marker;
    const distance = containsMarker ? 0 : Math.min(Math.abs(rect.top - marker), Math.abs(rect.bottom - marker));
    if (containsMarker || distance < bestDistance) {
      current = id;
      bestDistance = distance;
    }
  });
  setActiveSection(current);
  renderSection(current);
}

window.addEventListener('scroll', () => {
  if (sectionSyncFrame) return;
  sectionSyncFrame = requestAnimationFrame(() => {
    sectionSyncFrame = null;
    syncActiveSectionFromScroll();
  });
}, { passive: true });

// =============================================================================
// STORY MODE — curated walkthrough that drives the existing charts
// =============================================================================
const STORY_STOPS = [
  {
    section: 'act1',
    spotlight: '.chart-area',
    step: 0,
    metric: 'x3pa',
    callout: { season: 1980, label: '2.8 3PA', detail: 'new line, tiny usage', dx: 72, dy: -62 },
    kicker: 'Act I · 1980',
    title: 'The line appears',
    copy: 'The NBA adds a shot that coaches barely trust. Teams take fewer than three threes a game, so the orange line almost hugs the floor.',
    context: '1980 adoption · 2.8 threes per team game',
  },
  {
    section: 'act1',
    spotlight: '.chart-area',
    step: 3,
    metric: 'x3pa',
    callout: { season: 2016, label: 'Warriors gravity', detail: 'the curve bends upward', dx: -205, dy: -72 },
    kicker: 'Act I · 2016',
    title: 'The experiment becomes a system',
    copy: 'By the Warriors peak, the three is no longer a trick shot. Spacing has become the offense, and the curve starts climbing like it found another gear.',
    context: 'Curry era · line acceleration',
  },
  {
    section: 'act1',
    spotlight: '#shot-geography',
    step: 4,
    metric: 'x3pa',
    shotYear: 2026,
    shotMode: 'real',
    callout: { zone: 'long_mid', label: 'Mid-range share falls here', detail: 'long twos lose their territory', dx: -230, dy: -72, width: 220 },
    kicker: 'Act I · Shot geography',
    title: 'The mid-range disappears',
    copy: 'The line chart shows threes rising; the court view shows where those attempts came from. Long twos shrink as spacing pulls shots either to the rim or beyond the arc.',
    context: 'Player Shooting data · 1997-2026',
  },
  {
    section: 'act2',
    spotlight: '.bubble-chart-wrap',
    year: 1996,
    highlight: 'Michael Jordan',
    trail: false,
    callout: { label: 'Jordan 1996', detail: 'high usage, compact era', dx: -200, dy: -84 },
    kicker: 'Act II · 1996',
    title: 'The old map still had one sun',
    copy: 'Jordan sits in a compact, physical league: less three-point gravity, more mid-range control, and one scorer pulling the whole defense toward him.',
    context: 'Jordan decade · highlighted player-season',
  },
  {
    section: 'act2',
    spotlight: '.bubble-chart-wrap',
    year: 2016,
    highlight: 'Stephen Curry',
    trail: true,
    callout: { label: 'Curry 2016', detail: 'usage and efficiency together', dx: -205, dy: -92 },
    kicker: 'Act II · 2016',
    title: 'Spacing bends the player cloud',
    copy: 'With trails on, Curry shows the sport moving up and right: higher efficiency without giving up star-level usage. The modern map starts to look different.',
    context: 'Warriors dynasty · three-year trails',
  },
  {
    section: 'act3',
    spotlight: '.radar-center',
    matchup: ['Stephen Curry', 'Kobe Bryant'],
    mode: 'normalized',
    callout: { label: 'Normalized lens', detail: 'percentiles make the eras comparable' },
    kicker: 'Act III · Curry vs Kobe',
    title: 'Era debate without time travel',
    copy: 'Normalized mode turns the question from raw totals into era-relative dominance. Two different offensive ecosystems can meet on one scale.',
    context: 'Percentile ranks across all NBA seasons since 1974',
  },
  {
    section: 'act4',
    spotlight: '.chart-wrap-4',
    teams: ['Bulls', 'Warriors', 'Celtics'],
    callout: { team: 'Warriors', season: 2016, label: 'Three dynasty shapes', detail: 'spike, arc, bookend', dx: -215, dy: -92 },
    kicker: 'Act IV · 1990-2026',
    title: 'Dynasties leave different footprints',
    copy: 'The Bulls spike like a comet, the Warriors stretch into a modern arc, and Boston bookends the period. Rings are outcomes; the lines show how long the machine stayed sharp.',
    context: 'Focused dynasty arcs · 12 combined titles',
  },
  {
    section: 'act5',
    spotlight: '.draft-panel',
    draftCell: { bucket: '1', tier: '50_plus' },
    callout: { label: 'Pick 1 dominates this tier', detail: 'superstar odds peak at the top', dx: 62, dy: 56, width: 224 },
    kicker: 'Act V · Draft predictor',
    title: 'The top pick is still the strongest bet',
    copy: 'The draft never becomes deterministic, but career VORP makes the slope visible: the highest picks create stars far more often than the field.',
    context: 'Draft classes through 2019 · 2020-2025 held out',
  },
  {
    section: 'takeaway',
    spotlight: '.takeaway-panel',
    callout: { label: 'One story, three lenses', detail: 'space, value, greatness' },
    kicker: 'Final takeaway',
    title: 'The sport changed what greatness looks like',
    copy: 'Basketball did not just get better at shooting threes; it changed how value, space, and greatness are measured.',
    context: 'Use Explore to keep reading, or Restart the tour.',
  },
];

let storyActive = false;
let storyIndex = 0;
let storyChartContexts = {
  hero: null,
  act1: null,
  act1Shots: null,
  act2: null,
  act4: null,
  act5: null,
};

const STORY_GUIDE_SELECTORS = [
  '.hero-card',
  '.hero-acts',
  '.chart-area',
  '#shot-geography',
  '.story-blocks',
  '.bubble-chart-wrap',
  '.season-dna',
  '.radar-center',
  '.player-card',
  '.head-to-head',
  '.similarity-panel',
  '.dynasty-legend',
  '.chart-wrap-4',
  '.draft-panel',
  '.draft-detail',
  '.takeaway-panel',
];

async function startStoryMode(index = 0) {
  storyActive = true;
  await goToStoryStop(index);
}

function closeStoryMode() {
  storyActive = false;
  clearStoryAnnotations();
  clearStoryGuidance();
  renderStoryPanel();
}

function exploreCurrentStoryView() {
  closeStoryMode();
}

async function storyNext() {
  const next = storyIndex >= STORY_STOPS.length - 1 ? 0 : storyIndex + 1;
  await goToStoryStop(next);
}

async function storyPrev() {
  if (storyIndex <= 0) return;
  await goToStoryStop(storyIndex - 1);
}

async function goToStoryStop(index) {
  storyIndex = Math.max(0, Math.min(STORY_STOPS.length - 1, index));
  storyActive = true;
  renderStoryPanel();
  const stop = STORY_STOPS[storyIndex];
  await showSection(stop.section);
  applyStoryState(stop);
  applyStoryGuidance(stop);
  renderStoryPanel();
  renderStoryAnnotations(stop);
  focusStoryViewport(stop);
}

function renderStoryPanel() {
  const panel = document.getElementById('story-panel');
  const launch = document.getElementById('story-launch');
  const nav = document.getElementById('nav-story');
  if (!panel) return;

  document.body.classList.toggle('story-on', storyActive);
  panel.setAttribute('aria-hidden', storyActive ? 'false' : 'true');
  launch?.classList.toggle('active', storyActive);
  nav?.classList.toggle('active', storyActive);
  if (!storyActive) {
    document.body.removeAttribute('data-story-section');
    return;
  }

  const stop = STORY_STOPS[storyIndex];
  const total = STORY_STOPS.length;
  document.body.dataset.storySection = stop.section;
  document.getElementById('story-count').textContent = `${String(storyIndex + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  document.getElementById('story-kicker').textContent = stop.kicker;
  document.getElementById('story-title').textContent = stop.title;
  document.getElementById('story-copy').textContent = stop.copy;
  document.getElementById('story-context').textContent = stop.context;
  document.getElementById('story-progress-fill').style.width = `${((storyIndex + 1) / total) * 100}%`;

  const dots = document.getElementById('story-dots');
  dots.innerHTML = STORY_STOPS.map((s, i) => `
    <button class="${i === storyIndex ? 'active' : ''}" onclick="goToStoryStop(${i})" aria-label="Story stop ${i + 1}: ${s.title}"></button>
  `).join('');

  const prev = document.getElementById('story-prev');
  const next = document.getElementById('story-next');
  prev.disabled = storyIndex === 0;
  next.textContent = storyIndex === total - 1 ? 'Restart' : 'Next';
  panel.classList.remove('pulse');
  void panel.offsetWidth;
  panel.classList.add('pulse');
}

function applyStoryState(stop) {
  if (stop.section === 'act1') {
    if (stop.metric) {
      const btn = document.querySelector(`.chart-tab[data-metric="${stop.metric}"]`);
      if (btn) act1SetMetric(stop.metric, btn);
    }
    if (Number.isInteger(stop.step)) {
      const block = document.querySelectorAll('.story-block')[stop.step];
      if (block) act1Go(stop.step, block);
    }
    if (stop.shotMode) setShotMapMode(stop.shotMode);
    if (stop.shotYear) setShotZoneYear(stop.shotYear);
  }

  if (stop.section === 'act2') {
    resetPositionFilters();
    if (stop.year) setAct2Year(stop.year, false);
    setAct2Highlight(stop.highlight || '', false);
    if (typeof stop.trail === 'boolean') setTrailMode(stop.trail, false);
    drawAct2();
  }

  if (stop.section === 'act3') {
    if (stop.matchup) {
      const [a, b] = stop.matchup;
      const quickpick = Array.from(document.querySelectorAll('.qp')).find(q => q.dataset.a === a && q.dataset.b === b);
      pickMatchup(a, b, quickpick || null);
    }
    if (stop.mode) {
      const btn = document.querySelector(`.toggle-btn[onclick="setMode('${stop.mode}',this)"]`);
      setMode(stop.mode, btn);
    }
  }

  if (stop.section === 'act4' && stop.teams) {
    setDynastyFocus(stop.teams);
  }

  if (stop.section === 'act5' && stop.draftCell) {
    drawDraftHeatmap();
    selectDraftCell(stop.draftCell.bucket, stop.draftCell.tier);
  }
}

function focusStoryViewport(stop) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = reduce ? 'auto' : 'smooth';
  const target = stop.spotlight ? document.querySelector(stop.spotlight)
              : stop.section === 'act2' ? document.querySelector('.bubble-chart-wrap')
              : stop.section === 'act3' ? document.querySelector('.radar-center')
              : stop.section === 'act4' ? document.querySelector('.chart-wrap-4')
              : stop.section === 'act5' ? document.querySelector('.draft-panel')
              : null;
  if (!target) return;
  setTimeout(() => target.scrollIntoView({ block: 'center', behavior }), 80);
}

function clearStoryAnnotations() {
  d3.selectAll('.story-chart-callout').remove();
  document.querySelectorAll('.story-result-callout').forEach(el => el.remove());
}

function clearStoryGuidance() {
  document.querySelectorAll('.story-spotlight, .story-muted, .story-section-active').forEach(el => {
    el.classList.remove('story-spotlight', 'story-muted', 'story-section-active');
  });
}

function applyStoryGuidance(stop) {
  clearStoryGuidance();
  if (!storyActive || !stop?.section) return;
  const section = document.getElementById(stop.section);
  if (!section) return;
  section.classList.add('story-section-active');
  const target = stop.spotlight ? document.querySelector(stop.spotlight) : null;
  const candidates = section.querySelectorAll(STORY_GUIDE_SELECTORS.join(','));
  candidates.forEach(el => {
    if (target && (el === target || el.contains(target) || target.contains(el))) return;
    el.classList.add('story-muted');
  });
  if (target) target.classList.add('story-spotlight');
}

function renderStoryAnnotations(stop = STORY_STOPS[storyIndex]) {
  clearStoryAnnotations();
  if (!storyActive || !stop?.callout) return;
  if (stop.section === 'hero') renderHeroStoryCallout(stop);
  if (stop.section === 'act1') renderAct1StoryCallout(stop);
  if (stop.section === 'act2') renderAct2StoryCallout(stop);
  if (stop.section === 'act3') renderAct3StoryCallout(stop);
  if (stop.section === 'act4') renderAct4StoryCallout(stop);
  if (stop.section === 'act5') renderAct5StoryCallout(stop);
  if (stop.section === 'takeaway') renderTakeawayStoryCallout(stop);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function drawSvgStoryCallout(ctx, x, y, opts) {
  if (!ctx?.root) return;
  const width = opts.width || 178;
  const height = opts.detail ? 58 : 40;
  const boxX = clamp(x + (opts.dx ?? 72), 8, Math.max(8, ctx.iw - width - 8));
  const boxY = clamp(y + (opts.dy ?? -72), 8, Math.max(8, ctx.ih - height - 8));
  const lineX = x < boxX ? boxX : boxX + width;
  const lineY = boxY + height / 2;
  const g = ctx.root.append('g')
    .attr('class', 'story-chart-callout')
    .style('opacity', 0)
    .style('pointer-events', 'none');

  g.append('line')
    .attr('class', 'story-callout-line')
    .attr('x1', x).attr('y1', y)
    .attr('x2', lineX).attr('y2', lineY);
  g.append('circle')
    .attr('class', 'story-callout-halo')
    .attr('cx', x).attr('cy', y).attr('r', 10);
  g.append('circle')
    .attr('class', 'story-callout-dot')
    .attr('cx', x).attr('cy', y).attr('r', 4);

  const box = g.append('g').attr('transform', `translate(${boxX},${boxY})`);
  box.append('rect')
    .attr('class', 'story-callout-bg')
    .attr('width', width).attr('height', height)
    .attr('rx', 7);
  box.append('text')
    .attr('class', 'story-callout-title')
    .attr('x', 12).attr('y', opts.detail ? 22 : 25)
    .text(opts.label);
  if (opts.detail) {
    box.append('text')
      .attr('class', 'story-callout-detail')
      .attr('x', 12).attr('y', 42)
      .text(opts.detail);
  }

  g.transition().delay(220).duration(420).ease(d3.easeCubicOut).style('opacity', 1);
}

function drawChartAnnotation(root, x, y, opts = {}) {
  if (!root) return;
  const width = opts.width || 184;
  const height = opts.detail ? 54 : 36;
  const bounds = opts.bounds || { iw: 720, ih: 360 };
  const boxX = clamp(x + (opts.dx ?? 58), 8, Math.max(8, bounds.iw - width - 8));
  const boxY = clamp(y + (opts.dy ?? -56), 8, Math.max(8, bounds.ih - height - 8));
  const lineX = x < boxX ? boxX : boxX + width;
  const lineY = boxY + height / 2;
  const g = root.append('g')
    .attr('class', 'chart-annotation')
    .style('opacity', 0)
    .style('pointer-events', 'none');

  g.append('path')
    .attr('class', 'chart-annotation-line')
    .attr('d', `M${x},${y} L${lineX},${lineY}`);
  g.append('circle')
    .attr('class', 'chart-annotation-dot')
    .attr('cx', x)
    .attr('cy', y)
    .attr('r', 4);

  const box = g.append('g').attr('transform', `translate(${boxX},${boxY})`);
  box.append('rect')
    .attr('class', 'chart-annotation-bg')
    .attr('width', width)
    .attr('height', height)
    .attr('rx', 6);
  box.append('text')
    .attr('class', 'chart-annotation-title')
    .attr('x', 10)
    .attr('y', opts.detail ? 20 : 23)
    .text(opts.label);
  if (opts.detail) {
    box.append('text')
      .attr('class', 'chart-annotation-detail')
      .attr('x', 10)
      .attr('y', 39)
      .text(opts.detail);
  }

  g.transition().delay(opts.delay || 240).duration(380).ease(d3.easeCubicOut).style('opacity', 1);
}

function renderHeroStoryCallout(stop) {
  const ctx = storyChartContexts.hero;
  const d = DATA.act1;
  if (!ctx || !d) return;
  const season = stop.callout.season;
  const idx = d.seasons.indexOf(season);
  if (idx < 0) return;
  drawSvgStoryCallout(ctx, ctx.x(season), ctx.y(d.x3pa[idx]), stop.callout);
}

function renderAct1StoryCallout(stop) {
  if (stop.callout.zone) {
    const ctx = storyChartContexts.act1Shots;
    const target = ctx?.centers?.[stop.callout.zone];
    if (!ctx || !target) return;
    drawSvgStoryCallout(ctx, target.x, target.y, stop.callout);
    return;
  }
  const ctx = storyChartContexts.act1;
  const d = DATA.act1;
  if (!ctx || !d || act1Metric !== 'x3pa') return;
  const season = stop.callout.season;
  const idx = d.seasons.indexOf(season);
  if (idx < 0) return;
  drawSvgStoryCallout(ctx, ctx.x(season), ctx.y(d.x3pa[idx]), stop.callout);
}

function renderAct2StoryCallout(stop) {
  const ctx = storyChartContexts.act2;
  if (!ctx) return;
  const player = ctx.players.find(p => p.player.toLowerCase().includes((stop.highlight || '').toLowerCase()));
  if (!player) return;
  drawSvgStoryCallout(ctx, ctx.x(player.usg_percent), ctx.y(player.ts_percent), stop.callout);
}

function renderAct3StoryCallout(stop) {
  const host = document.querySelector('.radar-center');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'story-result-callout';
  const verdict = document.getElementById('verdict')?.textContent || '';
  el.innerHTML = `
    <div class="story-result-label">${stop.callout.label}</div>
    <div class="story-result-detail">${stop.callout.detail}</div>
    <div class="story-result-verdict">${verdict}</div>
  `;
  host.appendChild(el);
}

function renderAct4StoryCallout(stop) {
  const ctx = storyChartContexts.act4;
  if (!ctx) return;
  const [teamName, teamData] = ctx.teams.find(([name]) => name === stop.callout.team) || [];
  if (!teamName || !teamData) return;
  const idx = teamData.seasons.indexOf(stop.callout.season);
  if (idx < 0) return;
  drawSvgStoryCallout(ctx, ctx.x(stop.callout.season), ctx.y(teamData.wins[idx]), stop.callout);
}

function renderAct5StoryCallout(stop) {
  const ctx = storyChartContexts.act5;
  const cell = stop.draftCell || selectedDraftCell;
  if (ctx?.root && cell && ctx.x(cell.bucket) !== undefined && ctx.y(cell.tier) !== undefined) {
    drawSvgStoryCallout(
      ctx,
      ctx.x(cell.bucket) + ctx.x.bandwidth() / 2,
      ctx.y(cell.tier) + ctx.y.bandwidth() / 2,
      stop.callout
    );
  }

  const host = document.querySelector('.draft-detail');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'story-result-callout';
  const selected = document.getElementById('draft-detail-title')?.textContent || '';
  el.innerHTML = `
    <div class="story-result-label">${stop.callout.label}</div>
    <div class="story-result-detail">${stop.callout.detail}</div>
    <div class="story-result-verdict">${selected}</div>
  `;
  host.appendChild(el);
}

function renderTakeawayStoryCallout(stop) {
  const host = document.querySelector('.takeaway-panel');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'story-result-callout takeaway-story-callout';
  el.innerHTML = `
    <div class="story-result-label">${stop.callout.label}</div>
    <div class="story-result-detail">${stop.callout.detail}</div>
    <div class="story-result-verdict">The ending is now part of the walkthrough, not just the footer.</div>
  `;
  host.appendChild(el);
}

document.addEventListener('keydown', e => {
  if (!storyActive) return;
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    storyNext();
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    storyPrev();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    exploreCurrentStoryView();
  }
});

// =============================================================================
// SCROLL PROGRESS
// =============================================================================
function updateProgress() {
  const sc = document.documentElement.scrollTop || document.body.scrollTop;
  const h = (document.documentElement.scrollHeight || document.body.scrollHeight) - document.documentElement.clientHeight;
  const p = h > 0 ? (sc / h) * 100 : 0;
  document.getElementById('progress-bar').style.width = p + '%';
}
window.addEventListener('scroll', updateProgress, { passive: true });

// =============================================================================
// TOOLTIP HELPERS
// =============================================================================
const tipEl = () => document.getElementById('tooltip');
function showTip(name, stat, accent = 'orange') {
  const el = tipEl();
  el.style.borderLeftColor = accent === 'blue' ? 'var(--accent2)'
                          : accent === 'green' ? 'var(--green)'
                          : accent === 'gold' ? 'var(--gold)'
                          : 'var(--accent)';
  document.getElementById('tt-name').textContent = name;
  document.getElementById('tt-stat').innerHTML = stat;
  el.classList.add('show');
}
function hideTip() { tipEl().classList.remove('show'); }
document.addEventListener('mousemove', e => {
  const el = tipEl();
  if (el.classList.contains('show')) {
    const tw = el.offsetWidth, th = el.offsetHeight;
    const x = Math.min(e.clientX + 14, window.innerWidth - tw - 8);
    const y = Math.min(e.clientY + 14, window.innerHeight - th - 8);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }
});

// =============================================================================
// HERO — animated mini 3PA chart + bouncing basketball + click-to-scrub
// =============================================================================
let heroDrawn = false;
let heroScrubDataCache = null;
let heroAnimFrame = null;
let heroAnimToken = 0;
function drawHeroChart() {
  const d = DATA.act1;
  if (!d) return;
  if (heroAnimFrame) cancelAnimationFrame(heroAnimFrame);
  const animToken = ++heroAnimToken;

  const svg = d3.select('#hero-chart');
  svg.selectAll('*').remove();
  const W = 380, H = 220;
  const m = { top: 14, right: 16, bottom: 18, left: 6 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const root = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const x = d3.scaleLinear().domain(d3.extent(d.seasons)).range([0, iw]);
  const y = d3.scaleLinear().domain([0, d3.max(d.x3pa) * 1.08]).range([ih, 0]);
  const data = d.seasons.map((s, i) => ({ s, v: d.x3pa[i] }));
  storyChartContexts.hero = { root, x, y, iw, ih, data };
  heroScrubDataCache = { data, x, y, iw, ih, m, W, H };

  const line = d3.line().x(p => x(p.s)).y(p => y(p.v)).curve(d3.curveMonotoneX);
  const area = d3.area().x(p => x(p.s)).y0(ih).y1(p => y(p.v)).curve(d3.curveMonotoneX);

  // Subtle baseline grid
  root.selectAll('.h-grid').data(y.ticks(4)).join('line')
    .attr('class', 'grid-line')
    .attr('x1', 0).attr('x2', iw)
    .attr('y1', v => y(v)).attr('y2', v => y(v));

  // Year ticks on baseline
  const yearTicks = [1980, 1990, 2000, 2010, 2020];
  root.selectAll('.h-year').data(yearTicks).join('text')
    .attr('x', d => x(d))
    .attr('y', ih + 14)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'var(--font-mono)')
    .attr('font-size', 9)
    .attr('fill', 'var(--muted-2)')
    .text(d => "'" + String(d).slice(2));

  // Gradient
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', 'hero-grad').attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
  grad.append('stop').attr('offset', '0').attr('stop-color', '#ff6b1a').attr('stop-opacity', 0.6);
  grad.append('stop').attr('offset', '1').attr('stop-color', '#ff6b1a').attr('stop-opacity', 0);

  // Basketball gradient (radial)
  const ballGrad = defs.append('radialGradient').attr('id', 'ball-grad').attr('cx', '0.35').attr('cy', '0.35').attr('r', '0.7');
  ballGrad.append('stop').attr('offset', '0').attr('stop-color', '#ffb27a');
  ballGrad.append('stop').attr('offset', '0.5').attr('stop-color', '#ff6b1a');
  ballGrad.append('stop').attr('offset', '1').attr('stop-color', '#9c3a0a');

  // Area + line
  const areaP = root.append('path').attr('d', area(data)).attr('fill', 'url(#hero-grad)').style('opacity', 0);
  const lineP = root.append('path').attr('class', 'hero-line').attr('d', line(data)).attr('fill', 'none').attr('stroke', '#ff6b1a').attr('stroke-width', 2.4).attr('stroke-linecap', 'round');

  // Stroke-draw the line
  const total = lineP.node().getTotalLength();
  lineP.attr('stroke-dasharray', `${total} ${total}`).attr('stroke-dashoffset', total);
  lineP.transition().duration(2400).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);
  areaP.transition().delay(400).duration(2000).style('opacity', 1);

  // Basketball that travels along the line
  const ballG = root.append('g').attr('class', 'hoop').style('opacity', 0);
  ballG.append('circle').attr('r', 7).attr('fill', 'url(#ball-grad)').attr('stroke', '#3a1a08').attr('stroke-width', 0.8);
  ballG.append('path').attr('d', 'M-7 0 L7 0').attr('stroke', '#3a1a08').attr('stroke-width', 0.7).attr('fill', 'none');
  ballG.append('path').attr('d', 'M0 -7 L0 7').attr('stroke', '#3a1a08').attr('stroke-width', 0.7).attr('fill', 'none');
  ballG.append('path').attr('d', 'M-5 -5 Q0 0 -5 5').attr('stroke', '#3a1a08').attr('stroke-width', 0.6).attr('fill', 'none');
  ballG.append('path').attr('d', 'M5 -5 Q0 0 5 5').attr('stroke', '#3a1a08').attr('stroke-width', 0.6).attr('fill', 'none');
  ballG.style('opacity', 1);

  // Animate ball along the path
  const pathNode = lineP.node();
  const startT = performance.now();
  const duration = 2400;
  function animateBall(now) {
    if (animToken !== heroAnimToken) return;
    const k = Math.min(1, (now - startT) / duration);
    const e = 1 - Math.pow(1 - k, 3);
    const p = pathNode.getPointAtLength(e * total);
    const bob = Math.sin(now * 0.012) * 1.2;
    ballG.attr('transform', `translate(${p.x},${p.y + bob}) rotate(${(now * 0.5) % 360})`);
    if (k < 1) heroAnimFrame = requestAnimationFrame(animateBall);
    else {
      // Idle bob at endpoint
      function idle(t) {
        if (animToken !== heroAnimToken || document.getElementById('hero')?.style.display === 'none') return;
        const last = pathNode.getPointAtLength(total);
        const bobY = Math.sin(t * 0.004) * 2;
        ballG.attr('transform', `translate(${last.x},${last.y + bobY}) rotate(${(t * 0.2) % 360})`);
        heroAnimFrame = requestAnimationFrame(idle);
      }
      heroAnimFrame = requestAnimationFrame(idle);
    }
  }
  heroAnimFrame = requestAnimationFrame(animateBall);

  // Endpoint marker (subtle ring behind ball)
  const last = data[data.length - 1];
  root.append('circle')
    .attr('cx', x(last.s)).attr('cy', y(last.v))
    .attr('r', 0).attr('fill', 'none').attr('stroke', 'rgba(255,107,26,0.4)').attr('stroke-width', 1)
    .transition().delay(2200).duration(400).attr('r', 12);

  // Click-to-scrub overlay → highlights chosen year on small-multiples
  const tipEl2 = ensureHeroScrubTip();
  const overlay = root.append('rect').attr('width', iw).attr('height', ih).attr('fill', 'transparent').style('cursor', 'crosshair');
  overlay.on('mousemove', function (e) {
    const [mx, my] = d3.pointer(e, this);
    const s = Math.round(x.invert(mx));
    const idx = d.seasons.indexOf(s);
    if (idx < 0) { tipEl2.classList.remove('show'); return; }
    const v = d.x3pa[idx];
    const cardRect = document.querySelector('.hero-card').getBoundingClientRect();
    const svgRect = svg.node().getBoundingClientRect();
    const px = svgRect.left - cardRect.left + (m.left + x(s)) * (svgRect.width / W);
    const py = svgRect.top - cardRect.top + (m.top + y(v)) * (svgRect.height / H);
    tipEl2.style.left = px + 'px';
    tipEl2.style.top = (py - 6) + 'px';
    tipEl2.innerHTML = `<span class="yr">${s}</span> · ${v.toFixed(1)} 3PA`;
    tipEl2.classList.add('show');
  });
  overlay.on('mouseleave', () => tipEl2.classList.remove('show'));
  overlay.on('click', function (e) {
    const [mx] = d3.pointer(e, this);
    const s = Math.round(x.invert(mx));
    const idx = d.seasons.indexOf(s);
    if (idx < 0) return;
    fireConfetti(e.clientX, e.clientY, { count: 30 });
    // Spark a pop on the endpoint values
    const endEl = document.getElementById('hero-stat-end');
    if (endEl) { endEl.style.animation = 'none'; void endEl.offsetWidth; endEl.style.animation = 'pop 380ms var(--ease)'; }
  });

  // Animate the big counters (rolling number)
  if (!heroDrawn) {
    animateNumber(document.getElementById('hero-stat-start'), 0, 2.8, 1400, v => v.toFixed(1));
    animateNumber(document.getElementById('hero-stat-end'),   0, 37.0, 2200, v => v.toFixed(1));
    animateNumber(document.getElementById('hero-stat-mult'),  1, 13, 2200, v => Math.round(v) + '×');
  }
  heroDrawn = true;
}

function ensureHeroScrubTip() {
  let tip = document.querySelector('.hero-scrub-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'hero-scrub-tip';
    document.querySelector('.hero-card').appendChild(tip);
  }
  return tip;
}

function animateNumber(el, from, to, dur, fmt) {
  const t0 = performance.now();
  function step(now) {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// =============================================================================
// ACT 1 — The Revolution
// =============================================================================
let act1Step = 0;
let act1Metric = 'x3pa';
const act1StepSeasons = [1983, 1997, 2013, 2017, 2026];
const ACT1_METRIC_LABEL = {
  x3pa: 'League-average 3-point attempts per game · 1980–2026',
  pace: 'League-average pace (possessions / 48 min) · 1980–2026',
  ts:   'League-average True Shooting % · 1980–2026',
};
const ACT1_METRIC_FMT = {
  x3pa: v => v.toFixed(1),
  pace: v => v.toFixed(1),
  ts:   v => v.toFixed(0) + '%',
};

function act1Go(step, el) {
  act1Step = step;
  document.querySelectorAll('.story-block').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  if (DATA.act1) drawAct1(step);
  if (DATA.act1) drawSmallMults();
}

function act1SetMetric(m, btn) {
  act1Metric = m;
  document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('act1-chart-title').textContent = ACT1_METRIC_LABEL[m];
  document.querySelectorAll('.sm-card').forEach(c => c.classList.toggle('active', c.dataset.metric === m));
  drawAct1(act1Step);
}

function drawAct1(step) {
  const d = DATA.act1;
  if (!d) return;

  const svg = d3.select('#act1-chart');
  svg.selectAll('*').remove();

  const W = 720, H = 360;
  const m = { top: 30, right: 32, bottom: 40, left: 50 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const root = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const series = d[act1Metric];
  const data = d.seasons.map((s, i) => ({ s, v: series[i] }));
  const x = d3.scaleLinear().domain(d3.extent(d.seasons)).range([0, iw]);
  const yMax = d3.max(series) * 1.08;
  const yMin = act1Metric === 'ts' ? Math.min(50, d3.min(series) - 1)
            : act1Metric === 'pace' ? Math.min(86, d3.min(series) - 1)
            : 0;
  const y = d3.scaleLinear().domain([yMin, yMax]).range([ih, 0]).nice();
  storyChartContexts.act1 = { root, x, y, iw, ih, data, series };

  const line = d3.line().x(p => x(p.s)).y(p => y(p.v)).curve(d3.curveMonotoneX);
  const area = d3.area().x(p => x(p.s)).y0(ih).y1(p => y(p.v)).curve(d3.curveMonotoneX);

  // Gradient
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', 'a1-grad-' + act1Metric).attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
  grad.append('stop').attr('offset', '0').attr('stop-color', '#ff6b1a').attr('stop-opacity', 0.22);
  grad.append('stop').attr('offset', '1').attr('stop-color', '#ff6b1a').attr('stop-opacity', 0);

  // Gridlines
  root.selectAll('.grid-y').data(y.ticks(6)).join('line').attr('class', 'grid-line')
    .attr('x1', 0).attr('x2', iw).attr('y1', v => y(v)).attr('y2', v => y(v));

  // Axes
  const xAxis = d3.axisBottom(x).tickValues([1980, 1990, 2000, 2010, 2020, 2026]).tickFormat(d3.format('d'));
  const yAxis = d3.axisLeft(y).ticks(6).tickFormat(ACT1_METRIC_FMT[act1Metric]);

  root.append('g').attr('transform', `translate(0,${ih})`).call(xAxis)
    .call(g => { g.selectAll('text').attr('fill', 'var(--muted)').attr('font-size', 10); g.selectAll('path,line').attr('stroke', 'var(--border)'); });
  root.append('g').call(yAxis)
    .call(g => { g.selectAll('text').attr('fill', 'var(--muted)').attr('font-size', 10); g.selectAll('path,line').attr('stroke', 'var(--border)'); });

  // Cutoff highlight
  const cutoff = act1StepSeasons[step];
  const visible = data.filter(p => p.s <= cutoff);

  // Faint full line for reference
  root.append('path').datum(data).attr('d', line)
    .attr('fill', 'none').attr('stroke', 'rgba(255,107,26,0.22)').attr('stroke-width', 1.4)
    .attr('stroke-dasharray', '2 4');

  // Highlighted area + line
  root.append('path').datum(visible).attr('d', area).attr('fill', `url(#a1-grad-${act1Metric})`).style('opacity', 0)
    .transition().duration(700).ease(d3.easeCubicOut).style('opacity', 1);

  const hl = root.append('path').datum(visible).attr('d', line)
    .attr('fill', 'none').attr('stroke', '#ff6b1a').attr('stroke-width', 2.6).attr('stroke-linecap', 'round');
  const total = hl.node().getTotalLength();
  hl.attr('stroke-dasharray', `${total} ${total}`).attr('stroke-dashoffset', total)
    .transition().duration(900).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);

  // Endpoint dot
  if (visible.length) {
    const tip = visible[visible.length - 1];
    root.append('circle').attr('cx', x(tip.s)).attr('cy', y(tip.v))
      .attr('r', 0).attr('fill', '#ff6b1a').attr('stroke', 'var(--bg-card)').attr('stroke-width', 2)
      .transition().delay(700).duration(300).attr('r', 5);

    // Big value callout
    root.append('text')
      .attr('x', x(tip.s)).attr('y', y(tip.v) - 14)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-display)')
      .attr('font-size', 22)
      .attr('letter-spacing', 1.2)
      .attr('fill', '#ff6b1a')
      .style('opacity', 0)
      .text(ACT1_METRIC_FMT[act1Metric](tip.v))
      .transition().delay(800).duration(400).style('opacity', 1);
  }

  // Annotations only for x3pa metric
  if (act1Metric === 'x3pa') {
    const annoForStep = d.annotations.filter((_, i) => i <= step);
    annoForStep.forEach(a => {
      const idx = d.seasons.indexOf(a.season);
      if (idx < 0) return;
      const cx = x(a.season), cy = y(d.x3pa[idx]);
      const g = root.append('g').style('opacity', 0);
      g.attr('transform', `translate(${cx},${cy})`);
      g.append('circle').attr('r', 4).attr('fill', 'none').attr('stroke', '#ff6b1a').attr('stroke-width', 1.5);
      const offset = cy < 100 ? 16 : -16;
      g.append('line').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', offset > 0 ? offset - 4 : offset + 4)
        .attr('stroke', 'var(--muted)').attr('stroke-dasharray', '2 2');
      const words = a.label.split(' ');
      const mid = Math.ceil(words.length / 2);
      [words.slice(0, mid).join(' '), words.slice(mid).join(' ')].filter(Boolean).forEach((ln, i) => {
        g.append('text').attr('x', 0).attr('y', offset + (offset > 0 ? 8 + i * 12 : -8 - i * 12))
          .attr('fill', 'var(--text)').attr('font-size', 10).attr('font-weight', 600)
          .attr('text-anchor', 'middle')
          .text(ln);
      });
      g.transition().delay(600).duration(500).style('opacity', 1);
    });
  }

  // Interactive crosshair
  const crosshair = root.append('g').style('opacity', 0);
  crosshair.append('line').attr('class', 'cx-line')
    .attr('y1', 0).attr('y2', ih)
    .attr('stroke', 'rgba(255,255,255,0.25)').attr('stroke-dasharray', '3 3');
  const cxDot = crosshair.append('circle').attr('r', 4).attr('fill', '#fff').attr('stroke', '#ff6b1a').attr('stroke-width', 2);
  const cxLbl = crosshair.append('text').attr('y', -10).attr('text-anchor', 'middle')
    .attr('fill', 'var(--text)').attr('font-size', 11).attr('font-weight', 700)
    .attr('font-family', 'var(--font-mono)');

  root.append('rect').attr('width', iw).attr('height', ih).attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('mousemove', function (e) {
      const [mx] = d3.pointer(e, this);
      const s = Math.round(x.invert(mx));
      const idx = d.seasons.indexOf(s);
      if (idx < 0) return;
      const v = series[idx];
      crosshair.style('opacity', 1);
      crosshair.select('.cx-line').attr('x1', x(s)).attr('x2', x(s));
      cxDot.attr('cx', x(s)).attr('cy', y(v));
      cxLbl.attr('x', x(s)).attr('y', y(v) - 12).text(s + ' · ' + ACT1_METRIC_FMT[act1Metric](v));
    })
    .on('mouseleave', () => crosshair.style('opacity', 0));
}

function drawSmallMults() {
  const d = DATA.act1;
  if (!d) return;
  const metrics = [
    { k: 'x3pa', fmt: v => v.toFixed(1), color: '#ff6b1a' },
    { k: 'pace', fmt: v => v.toFixed(1), color: '#4d8dff' },
    { k: 'ts',   fmt: v => v.toFixed(0) + '%', color: '#4ade80' },
  ];
  metrics.forEach(({ k, fmt, color }) => {
    const series = d[k];
    const W = 140, H = 50, pad = 4;
    const x = d3.scaleLinear().domain(d3.extent(d.seasons)).range([pad, W - pad]);
    const minV = k === 'ts' ? Math.min(...series) - 0.5 : 0;
    const y = d3.scaleLinear().domain([minV, Math.max(...series) * 1.05]).range([H - pad, pad]);
    const line = d3.line().x((_, i) => x(d.seasons[i])).y(v => y(v)).curve(d3.curveMonotoneX);
    const area = d3.area().x((_, i) => x(d.seasons[i])).y0(H - pad).y1(v => y(v)).curve(d3.curveMonotoneX);

    const svg = d3.select('.sm-chart[data-metric="' + k + '"]');
    svg.selectAll('*').remove();
    svg.append('path').attr('d', area(series)).attr('fill', color).style('opacity', 0.15);
    svg.append('path').attr('d', line(series)).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5);

    document.querySelector(`[data-metric="${k}-from"]`).textContent = fmt(series[0]);
    document.querySelector(`[data-metric="${k}-to"]`).textContent   = fmt(series[series.length - 1]);
  });
  // Sync active card with current main metric
  document.querySelectorAll('.sm-card').forEach(c => c.classList.toggle('active', c.dataset.metric === act1Metric));
  // Click on card to switch
  document.querySelectorAll('.sm-card').forEach(c => {
    c.onclick = () => {
      const btn = document.querySelector(`.chart-tab[data-metric="${c.dataset.metric}"]`);
      if (btn) act1SetMetric(c.dataset.metric, btn);
    };
    c.style.cursor = 'pointer';
  });
}

// =============================================================================
// ACT 1 EXTENSION — Shot-zone court heatmap
// =============================================================================
let shotZoneYear = 2026;
let shotMapMode = 'real';

function initShotZoneHeatmap() {
  const d = DATA.act1Shots;
  if (!d) return;
  const seasons = d.seasons || [];
  if (!seasons.includes(shotZoneYear)) shotZoneYear = seasons[seasons.length - 1] || 2026;
  const slider = document.getElementById('shot-year-slider');
  if (slider && seasons.length) {
    slider.min = seasons[0];
    slider.max = seasons[seasons.length - 1];
    slider.value = shotZoneYear;
  }
  setShotZoneYear(shotZoneYear);
}

function setShotMapMode(mode, btn = null) {
  shotMapMode = mode === 'zones' ? 'zones' : 'real';
  document.querySelectorAll('.shot-map-toggle button').forEach(b => {
    b.classList.toggle('active', b.dataset.shotMode === shotMapMode);
  });
  if (btn) btn.classList.add('active');
  drawShotZoneHeatmap();
}

function setShotZoneYear(year) {
  const d = DATA.act1Shots;
  if (!d) return;
  const seasons = d.seasons || [];
  const requested = parseInt(year, 10);
  shotZoneYear = seasons.includes(requested)
    ? requested
    : seasons.reduce((best, s) => Math.abs(s - requested) < Math.abs(best - requested) ? s : best, seasons[0]);

  const slider = document.getElementById('shot-year-slider');
  const label = document.getElementById('shot-year-label');
  if (slider) slider.value = shotZoneYear;
  if (label) label.textContent = shotZoneYear;
  document.querySelectorAll('.shot-milestones button').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === String(shotZoneYear));
  });
  drawShotZoneHeatmap();
}

function drawShotZoneHeatmap() {
  if (shotMapMode === 'real' && DATA.act1Real) {
    drawRealShotHeatmap();
    return;
  }
  const d = DATA.act1Shots;
  if (!d) return;
  const rows = d.bySeason?.[String(shotZoneYear)] || d.bySeason?.[shotZoneYear] || [];
  if (!rows.length) return;
  const zoneMeta = new Map((d.zones || []).map(z => [z.id, z]));
  const rowById = new Map(rows.map(r => [r.id, r]));
  const maxShare = Math.max(38, d3.max(rows, r => r.share) || 38);

  const svg = d3.select('#shot-zone-chart');
  svg.selectAll('*').remove();
  const W = 640, H = 430;
  const hoop = { x: 320, y: 360 };

  const zoneShapes = [
    {
      id: 'three',
      path: `M70,398 L70,190 A250,250 0 0 1 570,190 L570,398 Z`,
      label: { x: 320, y: 106 },
    },
    {
      id: 'long_mid',
      path: `M150,398 L150,228 A170,170 0 0 1 490,228 L490,398 Z`,
      label: { x: 320, y: 208 },
    },
    {
      id: 'mid',
      path: `M205,398 L205,280 A115,115 0 0 1 435,280 L435,398 Z`,
      label: { x: 320, y: 276 },
    },
    {
      id: 'short',
      path: 'M252,265 H388 V398 H252 Z',
      label: { x: 320, y: 320 },
    },
    {
      id: 'rim',
      circle: { cx: hoop.x, cy: hoop.y, r: 48 },
      label: { x: 320, y: 368 },
    },
  ];
  const centers = Object.fromEntries(zoneShapes.map(z => [z.id, z.label]));
  const root = svg.append('g').attr('class', 'shot-root');

  const zones = root.append('g').attr('class', 'shot-zones');
  zoneShapes.forEach(shape => {
    const row = rowById.get(shape.id) || { share: 0, fg: null, delta_from_start: 0 };
    const meta = zoneMeta.get(shape.id) || {};
    const opacity = 0.16 + (row.share / maxShare) * 0.72;
    const sel = shape.circle
      ? zones.append('circle')
          .attr('cx', shape.circle.cx).attr('cy', shape.circle.cy).attr('r', shape.circle.r)
      : zones.append('path').attr('d', shape.path);
    sel.attr('class', 'shot-zone')
      .attr('data-zone', shape.id)
      .attr('fill', meta.color || '#ff6b1a')
      .attr('fill-opacity', opacity)
      .on('mouseenter', () => {
        const delta = row.delta_from_start >= 0 ? `+${row.delta_from_start}` : `${row.delta_from_start}`;
        const fg = row.fg === null ? 'FG n/a' : `${row.fg}% FG`;
        showTip(meta.label || shape.id, `${shotZoneYear}: ${row.share}% of attempts<br>${fg} · ${delta} pts since ${d.summary.startSeason}`, 'gold');
      })
      .on('mouseleave', hideTip);
  });

  const court = root.append('g').attr('class', 'court-lines');
  court.append('rect').attr('class', 'court-line').attr('x', 70).attr('y', 28).attr('width', 500).attr('height', 370);
  court.append('line').attr('class', 'court-line').attr('x1', 70).attr('x2', 570).attr('y1', 398).attr('y2', 398);
  court.append('rect').attr('class', 'court-line').attr('x', 245).attr('y', 208).attr('width', 150).attr('height', 190);
  court.append('rect').attr('class', 'court-line').attr('x', 278).attr('y', 318).attr('width', 84).attr('height', 80);
  court.append('circle').attr('class', 'court-line').attr('cx', hoop.x).attr('cy', hoop.y).attr('r', 16);
  court.append('line').attr('class', 'court-line').attr('x1', 286).attr('x2', 354).attr('y1', 352).attr('y2', 352);
  court.append('path').attr('class', 'court-line').attr('d', `M70,190 A250,250 0 0 1 570,190`);
  court.append('path').attr('class', 'court-line').attr('d', `M205,280 A115,115 0 0 1 435,280`);

  root.append('g').selectAll('text')
    .data(zoneShapes)
    .join('text')
    .attr('class', 'shot-zone-label')
    .attr('x', z => z.label.x)
    .attr('y', z => z.label.y)
    .text(z => {
      const meta = zoneMeta.get(z.id) || {};
      const row = rowById.get(z.id) || {};
      return `${meta.short || z.id} · ${row.share || 0}%`;
    });

  const mid = rowById.get('mid')?.share || 0;
  const longMid = rowById.get('long_mid')?.share || 0;
  const currentMid = +(mid + longMid).toFixed(1);
  const startMid = d.summary?.midrangeStart ?? currentMid;
  const midDelta = +(currentMid - startMid).toFixed(1);
  const three = rowById.get('three') || {};
  const rim = rowById.get('rim') || {};
  const midDetail = midDelta < 0
    ? `${Math.abs(midDelta).toFixed(1)} pts lower than ${d.summary.startSeason}`
    : `baseline: ${currentMid}% of attempts`;
  drawChartAnnotation(root, centers.long_mid.x, centers.long_mid.y, {
    label: 'Mid-range share falls here',
    detail: midDetail,
    dx: -232,
    dy: -74,
    width: 210,
    bounds: { iw: W, ih: H },
  });
  drawChartAnnotation(root, centers.three.x, centers.three.y, {
    label: 'Arc absorbs attempts',
    detail: `${three.share || 0}% of shots in ${shotZoneYear}`,
    dx: 82,
    dy: 40,
    width: 180,
    bounds: { iw: W, ih: H },
    delay: 360,
  });
  drawChartAnnotation(root, centers.rim.x, centers.rim.y, {
    label: 'Rim still anchors value',
    detail: rim.fg ? `${rim.fg}% FG near basket` : 'highest-value interior zone',
    dx: 74,
    dy: -62,
    width: 178,
    bounds: { iw: W, ih: H },
    delay: 480,
  });

  storyChartContexts.act1Shots = { root, centers, iw: W, ih: H };

  const now = document.getElementById('shot-midrange-now');
  const copy = document.getElementById('shot-midrange-copy');
  if (now) now.textContent = `${currentMid}%`;
  if (copy) {
    const down = midDelta < 0 ? `${Math.abs(midDelta)} points lower` : `${midDelta} points higher`;
    copy.textContent = `${shotZoneYear} mid-range share is ${down} than ${d.summary.startSeason}; the arc absorbs much of that old long-two territory.`;
  }
  const list = document.getElementById('shot-zone-list');
  if (list) {
    list.innerHTML = rows.map(row => {
      const meta = zoneMeta.get(row.id) || {};
      const delta = row.delta_from_start >= 0 ? `+${row.delta_from_start}` : `${row.delta_from_start}`;
      return `<div class="shot-zone-row">
        <i style="background:${meta.color || 'var(--accent)'}"></i>
        <span>${meta.label || row.id}</span>
        <strong>${row.share}% · ${delta}</strong>
      </div>`;
    }).join('');
  }
}

function drawShotCourt(root, hoop) {
  const court = root.append('g').attr('class', 'court-lines');
  court.append('rect').attr('class', 'court-line').attr('x', 70).attr('y', 28).attr('width', 500).attr('height', 370);
  court.append('line').attr('class', 'court-line').attr('x1', 70).attr('x2', 570).attr('y1', 398).attr('y2', 398);
  court.append('rect').attr('class', 'court-line').attr('x', 245).attr('y', 208).attr('width', 150).attr('height', 190);
  court.append('rect').attr('class', 'court-line').attr('x', 278).attr('y', 318).attr('width', 84).attr('height', 80);
  court.append('circle').attr('class', 'court-line').attr('cx', hoop.x).attr('cy', hoop.y).attr('r', 16);
  court.append('line').attr('class', 'court-line').attr('x1', 286).attr('x2', 354).attr('y1', 352).attr('y2', 352);
  court.append('path').attr('class', 'court-line').attr('d', `M70,190 A250,250 0 0 1 570,190`);
  court.append('path').attr('class', 'court-line').attr('d', `M205,280 A115,115 0 0 1 435,280`);
}

function drawRealShotHeatmap() {
  const d = DATA.act1Real;
  if (!d) return;
  const seasons = d.seasons || [];
  if (!seasons.length) return;
  const realSeason = seasons.includes(shotZoneYear)
    ? shotZoneYear
    : seasons.reduce((best, s) => Math.abs(s - shotZoneYear) < Math.abs(best - shotZoneYear) ? s : best, seasons[0]);
  const season = d.bySeason?.[String(realSeason)];
  if (!season) return;

  const svg = d3.select('#shot-zone-chart');
  svg.selectAll('*').remove();
  const W = 640, H = 430;
  const hoop = { x: 320, y: 360 };
  const root = svg.append('g').attr('class', 'shot-root real-shot-root');
  const grid = d.grid || { xDomain: [-250, 250], yDomain: [-52, 423], xBins: 30, yBins: 28 };
  const xScale = d3.scaleLinear().domain(grid.xDomain).range([70, 570]);
  const yScale = d3.scaleLinear().domain(grid.yDomain).range([398, 28]);
  const xStep = (grid.xDomain[1] - grid.xDomain[0]) / grid.xBins;
  const yStep = (grid.yDomain[1] - grid.yDomain[0]) / grid.yBins;
  const densities = (season.cells || []).map(c => c.d).sort(d3.ascending);
  const maxDensity = Math.max(1, d3.quantile(densities, 0.985) || d3.max(densities) || 1);
  const color = d3.scaleSequential(t => d3.interpolateRgbBasis(['#121a2b', '#1d6fe8', '#4ade80', '#f5c518', '#ff6b1a'])(t))
    .domain([0, maxDensity * 0.82]);

  const heat = root.append('g').attr('class', 'real-heat-layer');
  heat.selectAll('rect')
    .data(season.cells || [])
    .join('rect')
    .attr('class', 'real-heat-cell')
    .attr('x', c => xScale(grid.xDomain[0] + c.x * xStep))
    .attr('y', c => yScale(grid.yDomain[0] + (c.y + 1) * yStep))
    .attr('width', Math.ceil((500 / grid.xBins) + 1))
    .attr('height', Math.ceil((370 / grid.yBins) + 1))
    .attr('rx', 3)
    .attr('fill', c => color(c.d))
    .attr('fill-opacity', c => Math.max(0.16, Math.min(0.96, Math.sqrt(c.d / maxDensity) * 0.98)))
    .on('mouseenter', (e, c) => {
      showTip('Real shot-density bin', `${realSeason}: ${c.a.toLocaleString()} attempts<br>${c.fg}% FG · ${c.d} per 10k shots`, 'gold');
    })
    .on('mouseleave', hideTip);

  drawShotCourt(root, hoop);

  const project = (locX, locY) => ({ x: xScale(locX), y: yScale(locY) });
  const centers = {
    long_mid: project(-125, 92),
    three: project(0, 258),
    rim: project(0, 4),
  };

  drawChartAnnotation(root, centers.long_mid.x, centers.long_mid.y, {
    label: 'Mid-range share falls here',
    detail: `${season.midrangeShare}% of real attempts`,
    dx: -232,
    dy: -72,
    width: 210,
    bounds: { iw: W, ih: H },
  });
  drawChartAnnotation(root, centers.three.x, centers.three.y, {
    label: 'Arc density grows',
    detail: `${season.threeShare}% of attempts from three`,
    dx: 82,
    dy: 32,
    width: 180,
    bounds: { iw: W, ih: H },
    delay: 360,
  });
  drawChartAnnotation(root, centers.rim.x, centers.rim.y, {
    label: 'Rim pressure remains',
    detail: `${season.rimShare}% in restricted area`,
    dx: 78,
    dy: -62,
    width: 180,
    bounds: { iw: W, ih: H },
    delay: 480,
  });

  root.append('text')
    .attr('class', 'real-heat-source')
    .attr('x', 84)
    .attr('y', 46)
    .text(`real shot locations · ${season.shots.toLocaleString()} attempts`);

  storyChartContexts.act1Shots = { root, centers, iw: W, ih: H };

  const label = document.getElementById('shot-year-label');
  if (label) label.textContent = realSeason;
  const now = document.getElementById('shot-midrange-now');
  const copy = document.getElementById('shot-midrange-copy');
  if (now) now.textContent = `${season.midrangeShare}%`;
  if (copy) {
    copy.textContent = `${realSeason} uses real NBA Stats LOC_X/LOC_Y shot attempts binned into a half-court density map; the old mid-range pocket is now much lighter than the arc.`;
  }
  const list = document.getElementById('shot-zone-list');
  if (list) {
    list.innerHTML = `
      <div class="shot-zone-row"><i style="background:var(--accent2)"></i><span>Real attempts</span><strong>${season.shots.toLocaleString()}</strong></div>
      <div class="shot-zone-row"><i style="background:var(--accent)"></i><span>3-point share</span><strong>${season.threeShare}%</strong></div>
      <div class="shot-zone-row"><i style="background:var(--gold)"></i><span>Mid-range share</span><strong>${season.midrangeShare}%</strong></div>
      <div class="shot-zone-row"><i style="background:var(--green)"></i><span>Restricted-area share</span><strong>${season.rimShare}%</strong></div>
    `;
  }
}

// =============================================================================
// ACT 2 — Era Explorer
// =============================================================================
const posColors = { PG: '#4fc3f7', SG: '#ff6b1a', SF: '#66bb6a', PF: '#ab47bc', C: '#ef5350' };
let currentYear = 2015, highlightName = '', playing = false, playInterval = null;
let mutedPos = new Set();
let trailMode = false;

function toggleTrail() {
  setTrailMode(!trailMode);
}

function setTrailMode(enabled, redraw = true) {
  trailMode = enabled;
  const btn = document.getElementById('trail-toggle');
  if (btn) {
    btn.classList.toggle('active', trailMode);
    btn.setAttribute('aria-pressed', String(trailMode));
  }
  if (redraw) drawAct2();
}

function eraNameForYear(y) {
  if (y < 1985) return 'The Magic & Bird Era';
  if (y < 1991) return 'The Showtime Years';
  if (y < 1999) return 'The Jordan Decade';
  if (y < 2004) return 'Kobe, Shaq & the Three-Peat';
  if (y < 2011) return 'The Iso Era';
  if (y < 2015) return 'LeBron Goes South';
  if (y < 2020) return 'The Warriors Dynasty';
  return 'The Three-Point Maximum';
}

function highlightPlayer(val) {
  setAct2Highlight(val);
}

function togglePos(pos, el) {
  if (mutedPos.has(pos)) { mutedPos.delete(pos); el.classList.remove('muted'); }
  else { mutedPos.add(pos); el.classList.add('muted'); }
  drawAct2();
}

function updateYear(val) {
  setAct2Year(val);
}

function setAct2Year(val, redraw = true) {
  currentYear = parseInt(val, 10);
  const slider = document.getElementById('year-slider');
  const display = document.getElementById('year-display');
  const watermark = document.getElementById('era-watermark');
  if (slider) slider.value = currentYear;
  if (display) display.textContent = currentYear;
  if (watermark) watermark.textContent = eraNameForYear(currentYear);
  if (redraw) drawAct2();
}

function setAct2Highlight(val, redraw = true) {
  const clean = val || '';
  highlightName = clean.toLowerCase().trim();
  const search = document.getElementById('search2');
  if (search) search.value = clean;
  if (redraw) drawAct2();
}

function resetPositionFilters() {
  mutedPos.clear();
  document.querySelectorAll('.pos-dot').forEach(el => el.classList.remove('muted'));
}

function togglePlay() {
  playing = !playing;
  const icon = document.getElementById('play-icon');
  const btn = document.getElementById('play-btn');
  if (playing) {
    btn.setAttribute('aria-label', 'Pause');
    icon.innerHTML = '<rect x="3" y="2" width="3" height="10" fill="currentColor"/><rect x="8" y="2" width="3" height="10" fill="currentColor"/>';
    playInterval = setInterval(() => {
      currentYear = currentYear >= 2026 ? 1982 : currentYear + 1;
      setAct2Year(currentYear);
    }, 480);
  } else {
    btn.setAttribute('aria-label', 'Play');
    icon.innerHTML = '<polygon points="3,1 13,7 3,13"/>';
    clearInterval(playInterval);
  }
}

function drawAct2() {
  if (!DATA.act2) return;
  const allPlayers = DATA.act2[String(currentYear)] || [];
  const players = allPlayers.filter(p => !mutedPos.has(p.pos));
  updateSeasonDNA(players);

  // Era watermark
  document.getElementById('era-watermark').textContent = eraNameForYear(currentYear);

  const svg = d3.select('#act2-chart');
  const W = 800, H = 440;
  const m = { top: 24, right: 40, bottom: 50, left: 60 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const x = d3.scaleLinear().domain([10, 40]).range([0, iw]);
  const y = d3.scaleLinear().domain([44, 72]).range([ih, 0]);

  let root = svg.select('g.root');
  if (root.empty()) {
    root = svg.append('g').attr('class', 'root').attr('transform', `translate(${m.left},${m.top})`);
    root.append('g').attr('class', 'grid-y');
    root.append('g').attr('class', 'grid-x');
    root.append('g').attr('class', 'avg-cross');
    root.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${ih})`);
    root.append('g').attr('class', 'y-axis');
    root.append('text').attr('class', 'y-label')
      .attr('transform', 'rotate(-90)').attr('x', -ih / 2).attr('y', -40)
      .attr('text-anchor', 'middle').attr('fill', 'var(--muted)').attr('font-size', 10)
      .text('True Shooting % →');
    root.append('text').attr('class', 'x-label')
      .attr('x', iw / 2).attr('y', ih + 36)
      .attr('text-anchor', 'middle').attr('fill', 'var(--muted)').attr('font-size', 10)
      .text('Usage Rate % →');
    root.append('text').attr('class', 'year-watermark')
      .attr('x', iw - 16).attr('y', ih - 14)
      .attr('text-anchor', 'end')
      .attr('fill', 'rgba(255,255,255,0.05)')
      .attr('font-family', 'Bebas Neue, sans-serif')
      .attr('font-size', 140).attr('letter-spacing', 4);
    root.append('g').attr('class', 'bubbles');
    root.append('g').attr('class', 'labels');

    // Static gridlines + axes
    root.select('g.grid-y').selectAll('line').data(y.ticks(6)).join('line').attr('class', 'grid-line')
      .attr('x1', 0).attr('x2', iw).attr('y1', v => y(v)).attr('y2', v => y(v));
    root.select('g.grid-x').selectAll('line').data(x.ticks(7)).join('line').attr('class', 'grid-line')
      .attr('x1', v => x(v)).attr('x2', v => x(v)).attr('y1', 0).attr('y2', ih);

    root.select('g.x-axis').call(d3.axisBottom(x).ticks(7).tickFormat(d => d + '%'))
      .call(g => { g.selectAll('text').attr('fill', 'var(--muted)').attr('font-size', 10); g.selectAll('path,line').attr('stroke', 'var(--border)'); });
    root.select('g.y-axis').call(d3.axisLeft(y).ticks(7).tickFormat(d => d + '%'))
      .call(g => { g.selectAll('text').attr('fill', 'var(--muted)').attr('font-size', 10); g.selectAll('path,line').attr('stroke', 'var(--border)'); });
  }

  // Year watermark
  root.select('text.year-watermark').text(currentYear);

  // League average crosshair
  if (players.length) {
    const avgX = d3.mean(players, p => p.usg_percent);
    const avgY = d3.mean(players, p => p.ts_percent);
    const cross = root.select('g.avg-cross');
    cross.selectAll('*').remove();
    cross.append('line')
      .attr('x1', x(avgX)).attr('x2', x(avgX)).attr('y1', 0).attr('y2', ih)
      .attr('stroke', 'rgba(255,255,255,0.08)').attr('stroke-dasharray', '4 5');
    cross.append('line')
      .attr('x1', 0).attr('x2', iw).attr('y1', y(avgY)).attr('y2', y(avgY))
      .attr('stroke', 'rgba(255,255,255,0.08)').attr('stroke-dasharray', '4 5');
    cross.append('text')
      .attr('x', x(avgX) + 5).attr('y', 10)
      .attr('fill', 'var(--muted-2)').attr('font-size', 9)
      .attr('font-family', 'var(--font-mono)')
      .text('avg ' + avgX.toFixed(1) + '%');
    cross.append('text')
      .attr('x', 5).attr('y', y(avgY) - 4)
      .attr('fill', 'var(--muted-2)').attr('font-size', 9)
      .attr('font-family', 'var(--font-mono)')
      .text('avg ' + avgY.toFixed(1) + '%');
  }

  // Bubbles
  const keyed = players.map(p => ({ ...p, _key: p.player + ':' + p.pos }));
  storyChartContexts.act2 = { root, x, y, iw, ih, players: keyed };

  // ✨ TRAIL MODE — ghost bubbles at where each player was 3 years ago
  const trailGroup = root.select('g.trails');
  if (!trailGroup.node()) root.insert('g', 'g.bubbles').attr('class', 'trails');
  const trailsSel = root.select('g.trails');
  trailsSel.selectAll('*').remove();
  if (trailMode) {
    const past = DATA.act2[String(currentYear - 3)] || [];
    const pastByPlayer = new Map(past.map(p => [p.player, p]));
    keyed.forEach(p => {
      const prev = pastByPlayer.get(p.player);
      if (!prev || mutedPos.has(p.pos)) return;
      trailsSel.append('line').attr('class', 'trail-line')
        .attr('x1', x(prev.usg_percent)).attr('y1', y(prev.ts_percent))
        .attr('x2', x(p.usg_percent)).attr('y2', y(p.ts_percent));
      trailsSel.append('circle').attr('class', 'ghost-bubble')
        .attr('cx', x(prev.usg_percent)).attr('cy', y(prev.ts_percent))
        .attr('r', 4 + prev.mp_per_game * 0.17)
        .attr('stroke', posColors[prev.pos] || 'var(--muted)');
    });
  }

  const bubbles = root.select('g.bubbles').selectAll('circle.player').data(keyed, d => d._key);

  bubbles.exit().transition().duration(380).attr('r', 0).style('opacity', 0).remove();

  const bEnter = bubbles.enter().append('circle').attr('class', 'player player-bubble')
    .attr('cx', d => x(d.usg_percent))
    .attr('cy', d => y(d.ts_percent))
    .attr('r', 0)
    .attr('fill', d => posColors[d.pos] || 'var(--muted)')
    .style('cursor', 'pointer')
    .on('mouseenter', (e, d) => showTip(d.player, `${d.pos} · USG ${d.usg_percent}%<br>TS ${d.ts_percent}% · ${d.pts_per_game} PPG · ${d.g} GP`, 'blue'))
    .on('mouseleave', hideTip);

  bEnter.merge(bubbles)
    .transition().duration(520).ease(d3.easeCubicInOut)
    .attr('cx', d => x(d.usg_percent))
    .attr('cy', d => y(d.ts_percent))
    .attr('r', d => 4 + d.mp_per_game * 0.17)
    .attr('fill', d => posColors[d.pos] || 'var(--muted)')
    .style('opacity', d => {
      if (!highlightName) return 0.7;
      return d.player.toLowerCase().includes(highlightName) ? 1 : 0.15;
    })
    .attr('stroke', d => (highlightName && d.player.toLowerCase().includes(highlightName)) ? '#fff' : 'none')
    .attr('stroke-width', d => (highlightName && d.player.toLowerCase().includes(highlightName)) ? 2.5 : 0);

  // Toggle pulse class for highlighted bubbles
  root.select('g.bubbles').selectAll('circle.player')
    .classed('highlighted', d => highlightName && d.player.toLowerCase().includes(highlightName));

  // Labels for top minute players or highlight matches
  const labelled = keyed.filter(p =>
    p.mp_per_game > 36 || (highlightName && p.player.toLowerCase().includes(highlightName))
  );
  const labels = root.select('g.labels').selectAll('text.lbl').data(labelled, d => d._key);
  labels.exit().remove();
  const lEnter = labels.enter().append('text').attr('class', 'lbl')
    .attr('fill', 'var(--text)').attr('font-size', 10).attr('font-weight', 600)
    .attr('text-anchor', 'middle')
    .attr('paint-order', 'stroke').attr('stroke', 'var(--bg-card)').attr('stroke-width', 3);
  lEnter.merge(labels)
    .transition().duration(520).ease(d3.easeCubicInOut)
    .attr('x', d => x(d.usg_percent))
    .attr('y', d => y(d.ts_percent) - (4 + d.mp_per_game * 0.17) - 4)
    .text(d => d.player.split(' ').slice(-1)[0]);
}

function updateSeasonDNA(players) {
  const empty = !players.length;
  const byMax = (key) => empty ? null : [...players].sort((a, b) => b[key] - a[key])[0];
  const usage = byMax('usg_percent');
  const scoring = byMax('pts_per_game');
  const efficiency = byMax('ts_percent');

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText('dna-usage-name', usage ? usage.player : '—');
  setText('dna-usage-stat', usage ? `${usage.usg_percent}% usage · ${usage.pos}` : '—');
  setText('dna-scoring-name', scoring ? scoring.player : '—');
  setText('dna-scoring-stat', scoring ? `${scoring.pts_per_game} PPG · ${scoring.pos}` : '—');
  setText('dna-eff-name', efficiency ? efficiency.player : '—');
  setText('dna-eff-stat', efficiency ? `${efficiency.ts_percent}% TS · ${efficiency.pos}` : '—');

  const stack = document.getElementById('dna-pos-stack');
  const posStat = document.getElementById('dna-pos-stat');
  if (!stack || !posStat) return;
  const total = players.length || 1;
  const counts = ['PG', 'SG', 'SF', 'PF', 'C'].map(pos => ({
    pos,
    count: players.filter(p => p.pos === pos).length,
  })).filter(d => d.count > 0);
  stack.innerHTML = counts.map(d => `
    <span class="pos-seg" style="--w:${(d.count / total * 100).toFixed(2)}%;--c:${posColors[d.pos]};" title="${d.pos}: ${d.count}"></span>
  `).join('');
  posStat.textContent = counts.map(d => `${d.pos} ${d.count}`).join(' · ') || '—';
}

// =============================================================================
// ACT 3 — Player vs Player
// =============================================================================
let playerA = null, playerB = null, radarMode = 'normalized';
let similarityAnchorSlot = 'A';
let similaritySimulation = null;
const METRICS = ['pts_per_game', 'trb_per_game', 'ast_per_game', 'ts_percent', 'ws_48', 'bpm', 'vorp', 'per'];
const STAT_LABELS = ['Points / game', 'Rebounds / game', 'Assists / game', 'True Shooting %', 'Win Shares / 48', 'Box +/-', 'VORP', 'PER'];
const LABELS = ['PTS', 'REB', 'AST', 'TS%', 'WS/48', 'BPM', 'VORP', 'PER'];
const RAW_SCALES = { pts_per_game: 40, trb_per_game: 15, ast_per_game: 12, ts_percent: 70, ws_48: 0.3, bpm: 15, vorp: 15, per: 35 };
const RAW_FMT = {
  pts_per_game: v => v.toFixed(1),
  trb_per_game: v => v.toFixed(1),
  ast_per_game: v => v.toFixed(1),
  ts_percent: v => v.toFixed(1) + '%',
  ws_48: v => v.toFixed(3),
  bpm: v => (v >= 0 ? '+' : '') + v.toFixed(1),
  vorp: v => v.toFixed(1),
  per: v => v.toFixed(1),
};

// Hand-curated championship counts (career rings) for the most-searched players.
// Missing players get 0 rings displayed as "— no rings—" tag.
const PLAYER_RINGS = {
  'Michael Jordan': 6, 'LeBron James': 4, 'Kobe Bryant': 5, 'Shaquille O\'Neal': 4,
  'Tim Duncan': 5, 'Magic Johnson': 5, 'Larry Bird': 3, 'Kareem Abdul-Jabbar': 6,
  'Hakeem Olajuwon': 2, 'Stephen Curry': 4, 'Kevin Durant': 2, 'Kawhi Leonard': 2,
  'Dwyane Wade': 3, 'Manu Ginobili': 4, 'Tony Parker': 4, 'Scottie Pippen': 6,
  'Dennis Rodman': 5, 'Robert Horry': 7, 'Derek Fisher': 5, 'Pau Gasol': 2,
  'Klay Thompson': 4, 'Draymond Green': 4, 'Andre Iguodala': 4, 'Kevin Garnett': 1,
  'Paul Pierce': 1, 'Ray Allen': 2, 'Chris Bosh': 2, 'Jason Kidd': 1,
  'Dirk Nowitzki': 1, 'Giannis Antetokounmpo': 1, 'Kyrie Irving': 1, 'Nikola Joki\u0107': 1,
  'Nikola Jokic': 1, 'Jamal Murray': 1, 'Jayson Tatum': 1, 'Jaylen Brown': 1,
  'Allen Iverson': 0, 'Charles Barkley': 0, 'Karl Malone': 0, 'John Stockton': 0,
  'Patrick Ewing': 0, 'Reggie Miller': 0, 'James Harden': 0, 'Chris Paul': 0,
  'Russell Westbrook': 0, 'Damian Lillard': 0, 'Carmelo Anthony': 0, 'Vince Carter': 0,
  'Tracy McGrady': 0, 'Steve Nash': 0, 'Dominique Wilkins': 0,
};

let act3Initialized = false;
function initAct3Defaults() {
  if (!DATA.act3) return;
  if (act3Initialized) { drawRadar(); drawHeadToHead(); drawSimilarityGraph(); return; }
  const s = DATA.act3.search;
  const lb = s.find(p => p.name === 'LeBron James');
  const mj = s.find(p => p.name === 'Michael Jordan');
  if (lb) selectAct3Player('A', lb.id);
  if (mj) selectAct3Player('B', mj.id);
  // Highlight default quickpick
  const def = document.querySelector('.qp[data-a="LeBron James"]');
  if (def) def.classList.add('active');
  act3Initialized = true;
  drawSimilarityGraph();
}

function searchPlayer(slot, query) {
  if (!DATA.act3) return;
  const list = document.getElementById('list' + slot);
  if (!query.trim()) { list.classList.remove('open'); return; }
  const q = query.toLowerCase();
  const results = DATA.act3.search.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
  list.innerHTML = results.map(p => {
    const seasonsArr = Array.isArray(p.seasons) ? p.seasons : [p.seasons];
    const range = seasonsArr.length > 1 ? `${seasonsArr[0]}–${seasonsArr[seasonsArr.length - 1]}` : seasonsArr[0];
    return `<div class="autocomplete-item" onclick="selectAct3Player('${slot}','${p.id}')"><span>${p.name}</span><span class="seasons">${range}</span></div>`;
  }).join('');
  list.classList.toggle('open', results.length > 0);
}

function pickMatchup(a, b, btn) {
  if (!DATA.act3) return;
  const ap = DATA.act3.search.find(p => p.name === a);
  const bp = DATA.act3.search.find(p => p.name === b);
  if (ap) selectAct3Player('A', ap.id);
  if (bp) selectAct3Player('B', bp.id);
  document.querySelectorAll('.qp').forEach(q => q.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function selectAct3Player(slot, pid) {
  if (!DATA.act3) return;
  const p = DATA.act3.players[pid];
  if (!p) return;
  const seasonsArr = (p.seasons || []).filter((v, i, a) => a.indexOf(v) === i);
  const seasonsLine = seasonsArr.length ? `${seasonsArr[0]}–${seasonsArr[seasonsArr.length - 1]} · ${seasonsArr.length} seasons` : '';

  if (slot === 'A') {
    playerA = { id: pid, ...p, seasonsLine };
    document.getElementById('nameA').textContent = p.name;
    document.getElementById('seasonsA').textContent = seasonsLine;
    document.getElementById('legend-a').innerHTML = '<i></i>' + p.name.split(' ').slice(-1)[0];
    document.getElementById('searchA').value = '';
  } else {
    playerB = { id: pid, ...p, seasonsLine };
    document.getElementById('nameB').textContent = p.name;
    document.getElementById('seasonsB').textContent = seasonsLine;
    document.getElementById('legend-b').innerHTML = '<i></i>' + p.name.split(' ').slice(-1)[0];
    document.getElementById('searchB').value = '';
  }
  document.getElementById('list' + slot).classList.remove('open');
  // Clear quickpick highlight if user picks manually
  document.querySelectorAll('.qp').forEach(q => q.classList.remove('active'));
  renderRings(slot);
  renderStatTables();
  drawRadar();
  updateVerdict();
  drawHeadToHead();
  drawSimilarityGraph();
}

function renderRings(slot) {
  const player = slot === 'A' ? playerA : playerB;
  const el = document.getElementById('rings' + slot);
  if (!el || !player) return;
  const count = PLAYER_RINGS[player.name] ?? null;
  if (count === null) {
    el.innerHTML = '<span class="no-ring">— rings data n/a</span>';
    return;
  }
  if (count === 0) {
    el.innerHTML = '<span class="no-ring">no rings</span>';
    return;
  }
  const ringSVG = `<svg viewBox="0 0 20 20"><circle cx="10" cy="12" r="4.5" fill="none" stroke="#f5c518" stroke-width="1.5"/><path d="M7 6 L10 2 L13 6 Z" fill="#f5c518"/><circle cx="10" cy="4" r="1.2" fill="#fff8dc"/></svg>`;
  const rings = Array.from({ length: count }).map(() => `<span class="ring">${ringSVG}</span>`).join('');
  el.innerHTML = rings + `<span class="ring-count">×${count}</span>`;
}

function renderStatTables() {
  ['A', 'B'].forEach(slot => {
    const player = slot === 'A' ? playerA : playerB;
    const other = slot === 'A' ? playerB : playerA;
    const container = document.getElementById('stats' + slot);
    const cls = slot === 'A' ? 'win-a' : 'win-b';
    if (!player || !container) return;
    container.innerHTML = METRICS.map((m, i) => {
      const val = player.stats[m];
      const display = val !== undefined ? (m === 'ws_48' ? val.toFixed(3) : val.toFixed(1)) : '—';
      const better = other && val > other.stats[m];
      return `<div class="stat-row"><span class="lbl">${STAT_LABELS[i]}</span><span class="stat-val ${better ? cls : ''}">${display}</span></div>`;
    }).join('');
  });
}

function setMode(mode, btn) {
  radarMode = mode;
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('radar-mode-label').innerHTML =
    mode === 'normalized' ? 'Normalized<br>career stats' : 'Raw career<br>stats';
  document.getElementById('mode-explain').textContent =
    mode === 'normalized'
      ? 'Percentile rank across all NBA history (1974 →). Bigger is better.'
      : 'Raw career averages — context-free. Eras vary wildly in pace.';
  drawRadar();
  updateVerdict();
  drawHeadToHead();
  drawSimilarityGraph();
}

function updateVerdict() {
  const el = document.getElementById('verdict');
  const scA = document.getElementById('sc-a-num');
  const scB = document.getElementById('sc-b-num');
  const labA = document.getElementById('sc-a-lbl');
  const labB = document.getElementById('sc-b-lbl');
  if (!playerA || !playerB) { el.innerHTML = ''; return; }
  const src = (p) => radarMode === 'normalized' ? p.normalized : p.stats;
  let winA = 0, winB = 0;
  METRICS.forEach(m => {
    const a = src(playerA)[m] || 0, b = src(playerB)[m] || 0;
    if (a > b) winA++; else if (b > a) winB++;
  });
  const ties = METRICS.length - winA - winB;
  const lastA = playerA.name.split(' ').slice(-1)[0];
  const lastB = playerB.name.split(' ').slice(-1)[0];
  const tieClause = ties ? `, with ${ties} ${ties === 1 ? 'tie' : 'ties'}` : '';

  // Animate score counter
  const oldA = parseInt(scA.textContent || '0', 10);
  const oldB = parseInt(scB.textContent || '0', 10);
  animateNumber(scA, oldA, winA, 600, v => Math.round(v));
  animateNumber(scB, oldB, winB, 600, v => Math.round(v));
  labA.textContent = lastA.slice(0, 8);
  labB.textContent = lastB.slice(0, 8);
  scA.classList.toggle('winning', winA > winB);
  scB.classList.toggle('winning', winB > winA);

  if (winA === winB) {
    el.innerHTML = `Split decision — <strong>${lastA}</strong> and <strong>${lastB}</strong> tie ${winA}–${winB}${tieClause}.`;
  } else if (winA > winB) {
    el.innerHTML = `<strong>${lastA}</strong> wins <strong>${winA}–${winB}</strong>${tieClause} across ${METRICS.length} ${radarMode} metrics.`;
  } else {
    el.innerHTML = `<strong>${lastB}</strong> wins <strong>${winB}–${winA}</strong>${tieClause} across ${METRICS.length} ${radarMode} metrics.`;
  }

  // Confetti on blowout (≥6 wins)
  if (Math.abs(winA - winB) >= 6) {
    const r = document.querySelector('.score-counter')?.getBoundingClientRect();
    if (r) setTimeout(() => fireConfetti(r.left + r.width / 2, r.top + r.height / 2, { count: 40 }), 400);
  }
}

function drawHeadToHead() {
  const wrap = document.getElementById('h2h-bars');
  if (!wrap || !playerA || !playerB) { if (wrap) wrap.innerHTML = ''; return; }
  const srcA = radarMode === 'normalized' ? playerA.normalized : playerA.stats;
  const srcB = radarMode === 'normalized' ? playerB.normalized : playerB.stats;
  const rows = METRICS.map((m, i) => {
    const a = srcA[m] || 0, b = srcB[m] || 0;
    let aPct, bPct;
    if (radarMode === 'normalized') {
      aPct = Math.min(100, Math.max(0, a));
      bPct = Math.min(100, Math.max(0, b));
    } else {
      const max = Math.max(a, b) || 1;
      aPct = (a / max) * 100;
      bPct = (b / max) * 100;
    }
    const aWin = a > b, bWin = b > a;
    const aDisp = radarMode === 'normalized' ? `${Math.round(a)} pct` : (RAW_FMT[m] ? RAW_FMT[m](playerA.stats[m] || 0) : a.toFixed(1));
    const bDisp = radarMode === 'normalized' ? `${Math.round(b)} pct` : (RAW_FMT[m] ? RAW_FMT[m](playerB.stats[m] || 0) : b.toFixed(1));
    return `
      <div class="h2h-row">
        <div class="h2h-bar-wrap left">
          <span class="h2h-bar-val ${aWin ? 'winner-a' : ''}">${aDisp}</span>
          <div class="h2h-bar bar-a ${aWin ? 'winner' : ''}" style="width: ${aPct * 0.7}%"></div>
        </div>
        <div class="h2h-metric">${LABELS[i]}</div>
        <div class="h2h-bar-wrap">
          <div class="h2h-bar bar-b ${bWin ? 'winner' : ''}" style="width: ${bPct * 0.7}%"></div>
          <span class="h2h-bar-val ${bWin ? 'winner-b' : ''}">${bDisp}</span>
        </div>
      </div>`;
  }).join('');
  // Animate from 0 width
  wrap.innerHTML = rows;
  wrap.querySelectorAll('.h2h-bar').forEach(bar => {
    const targetW = bar.style.width;
    bar.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { bar.style.width = targetW; });
    });
  });
}

function drawRadar() {
  const svg = d3.select('#radar-chart');
  if (!playerA && !playerB) return;

  const cx = 140, cy = 140, R = 96, n = LABELS.length;
  const angle = i => (i / n) * Math.PI * 2 - Math.PI / 2;

  let root = svg.select('g.root');
  if (root.empty()) {
    root = svg.append('g').attr('class', 'root');
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const pts = LABELS.map((_, i) => [cx + Math.cos(angle(i)) * R * f, cy + Math.sin(angle(i)) * R * f].join(',')).join(' ');
      root.append('polygon').attr('points', pts).attr('fill', 'none').attr('stroke', 'rgba(255,255,255,0.06)');
    });
    LABELS.forEach((label, i) => {
      const [tx, ty] = [cx + Math.cos(angle(i)) * R, cy + Math.sin(angle(i)) * R];
      root.append('line').attr('x1', cx).attr('y1', cy).attr('x2', tx).attr('y2', ty)
        .attr('stroke', 'rgba(255,255,255,0.05)');
      const [lx, ly] = [cx + Math.cos(angle(i)) * (R + 18), cy + Math.sin(angle(i)) * (R + 18)];
      root.append('text').attr('x', lx).attr('y', ly + 4)
        .attr('fill', 'var(--muted)').attr('font-size', 10).attr('text-anchor', 'middle')
        .attr('font-family', 'var(--font-mono)').attr('letter-spacing', 0.5)
        .text(label);
    });
    root.append('polygon').attr('class', 'shape-a')
      .attr('fill', 'rgba(77,141,255,0.18)').attr('stroke', 'var(--accent2)').attr('stroke-width', 2);
    root.append('polygon').attr('class', 'shape-b')
      .attr('fill', 'rgba(255,107,26,0.16)').attr('stroke', 'var(--accent)').attr('stroke-width', 2);
    root.append('g').attr('class', 'dots-a');
    root.append('g').attr('class', 'dots-b');
  }

  function computePoints(player) {
    if (!player) return null;
    const src = radarMode === 'normalized' ? player.normalized : player.stats;
    return METRICS.map(m => {
      let v = src[m] || 0;
      if (radarMode === 'raw') v = Math.min(100, Math.max(0, (v / RAW_SCALES[m]) * 100));
      return Math.min(100, Math.max(0, v));
    });
  }
  function pointsString(vals) {
    if (!vals) return '';
    return vals.map((v, i) => [cx + Math.cos(angle(i)) * R * v / 100, cy + Math.sin(angle(i)) * R * v / 100].join(',')).join(' ');
  }

  const valsA = computePoints(playerA);
  const valsB = computePoints(playerB);

  root.select('polygon.shape-a').transition().duration(550).ease(d3.easeCubicInOut)
    .attr('points', pointsString(valsA))
    .style('opacity', valsA ? 1 : 0);
  root.select('polygon.shape-b').transition().duration(550).ease(d3.easeCubicInOut)
    .attr('points', pointsString(valsB))
    .style('opacity', valsB ? 1 : 0);

  function drawDots(group, vals, color, slot) {
    const player = slot === 'A' ? playerA : playerB;
    const sel = root.select(group).selectAll('circle').data(vals || []);
    sel.exit().remove();
    sel.enter().append('circle').attr('r', 4).attr('fill', color).style('cursor', 'pointer')
      .merge(sel)
      .on('mouseenter', function (e, v) {
        const i = +this.getAttribute('data-i');
        const src = radarMode === 'normalized' ? player.normalized : player.stats;
        const m = METRICS[i];
        const raw = player.stats[m];
        const norm = player.normalized[m];
        showTip(player.name, `${STAT_LABELS[i]}<br>Raw ${m === 'ws_48' ? raw.toFixed(3) : raw.toFixed(1)} · ${Math.round(norm)}th pct`, slot === 'A' ? 'blue' : 'orange');
      })
      .on('mouseleave', hideTip)
      .attr('data-i', (v, i) => i)
      .transition().duration(550).ease(d3.easeCubicInOut)
      .attr('cx', (v, i) => cx + Math.cos(angle(i)) * R * v / 100)
      .attr('cy', (v, i) => cy + Math.sin(angle(i)) * R * v / 100);
  }
  drawDots('g.dots-a', valsA, 'var(--accent2)', 'A');
  drawDots('g.dots-b', valsB, 'var(--accent)', 'B');
}

function setSimilarityAnchor(slot, btn) {
  similarityAnchorSlot = slot === 'B' ? 'B' : 'A';
  document.querySelectorAll('.sim-anchor').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else document.getElementById('sim-anchor-' + similarityAnchorSlot.toLowerCase())?.classList.add('active');
  drawSimilarityGraph();
}

function playerVector(player) {
  return METRICS.map(m => player?.normalized?.[m] || 0);
}

function vectorDistance(a, b) {
  return Math.sqrt(a.reduce((sum, v, i) => sum + Math.pow(v - b[i], 2), 0));
}

function playerImpactScore(player) {
  const vals = playerVector(player);
  return d3.mean(vals) || 0;
}

function playerEra(player) {
  const seasons = player.seasons || [];
  const mid = d3.mean(seasons) || 2000;
  if (mid < 1988) return 'classic';
  if (mid < 2003) return 'iso';
  if (mid < 2015) return 'bridge';
  return 'spacing';
}

function buildSimilarityGraphData() {
  if (!DATA.act3 || !playerA || !playerB) return { nodes: [], links: [], nearest: null };
  const players = Object.entries(DATA.act3.players)
    .map(([id, p]) => ({
      id,
      ...p,
      vec: playerVector(p),
      score: playerImpactScore(p),
      era: playerEra(p),
      seasonsLine: (p.seasons || []).length ? `${p.seasons[0]}-${p.seasons[p.seasons.length - 1]}` : '',
    }))
    .filter(p => (p.seasons || []).length >= 5);

  const anchor = similarityAnchorSlot === 'B' ? playerB : playerA;
  const anchorId = anchor?.id;
  const oppositeId = similarityAnchorSlot === 'B' ? playerA?.id : playerB?.id;
  const anchorVec = playerVector(anchor);

  const topPlayers = [...players]
    .sort((a, b) => b.score - a.score)
    .slice(0, 58);
  const nearestPlayers = [...players]
    .filter(p => p.id !== anchorId)
    .map(p => ({ ...p, anchorDist: vectorDistance(anchorVec, p.vec) }))
    .sort((a, b) => a.anchorDist - b.anchorDist)
    .slice(0, 30);

  const byId = new Map();
  [...topPlayers, ...nearestPlayers].forEach(p => byId.set(p.id, p));
  [playerA, playerB].forEach(p => {
    if (!p) return;
    byId.set(p.id, {
      ...p,
      vec: playerVector(p),
      score: playerImpactScore(p),
      era: playerEra(p),
      seasonsLine: p.seasonsLine || ((p.seasons || []).length ? `${p.seasons[0]}-${p.seasons[p.seasons.length - 1]}` : ''),
    });
  });

  const nodes = Array.from(byId.values()).map(p => {
    const score = p.score || playerImpactScore(p);
    const ast = p.normalized?.ast_per_game || 0;
    const reb = p.normalized?.trb_per_game || 0;
    const skillX = clamp((ast - reb + 100) / 200, 0, 1);
    return {
      ...p,
      score,
      isA: p.id === playerA?.id,
      isB: p.id === playerB?.id,
      isAnchor: p.id === anchorId,
      isOpposite: p.id === oppositeId,
      r: p.id === anchorId ? 15 : p.id === oppositeId ? 13 : 5 + score / 13,
      seedX: 140 + skillX * 720,
      seedY: 72 + (1 - clamp(score / 100, 0, 1)) * 390,
    };
  });

  const linkMap = new Map();
  nodes.forEach(a => {
    [...nodes]
      .filter(b => b.id !== a.id)
      .map(b => ({ target: b, dist: vectorDistance(a.vec, b.vec) }))
      .sort((x, y) => x.dist - y.dist)
      .slice(0, a.isAnchor ? 8 : 3)
      .forEach(({ target, dist }) => {
        if (dist > 96 && !a.isAnchor) return;
        const key = [a.id, target.id].sort().join('|');
        if (!linkMap.has(key)) {
          linkMap.set(key, {
            source: a.id,
            target: target.id,
            dist,
            anchor: a.isAnchor || target.isAnchor,
            similarity: Math.max(0, 1 - dist / Math.sqrt(METRICS.length * 10000)),
          });
        }
      });
  });

  const nearest = nodes
    .filter(n => n.id !== anchorId)
    .map(n => ({ ...n, anchorDist: vectorDistance(anchorVec, n.vec) }))
    .sort((a, b) => a.anchorDist - b.anchorDist)[0] || null;

  return { nodes, links: Array.from(linkMap.values()), nearest };
}

function drawSimilarityGraph() {
  const svg = d3.select('#similarity-graph');
  if (!svg.node() || !DATA.act3 || !playerA || !playerB) return;
  if (similaritySimulation) similaritySimulation.stop();
  svg.selectAll('*').remove();

  const { nodes, links, nearest } = buildSimilarityGraphData();
  if (!nodes.length) return;

  const W = 1000, H = 560;
  const posColor = p => posColors[p] || 'var(--muted)';
  const anchor = similarityAnchorSlot === 'B' ? playerB : playerA;
  const compareSlot = similarityAnchorSlot === 'B' ? 'A' : 'B';
  const cardName = document.getElementById('sim-card-name');
  const cardMeta = document.getElementById('sim-card-meta');
  if (cardName && cardMeta) {
    cardName.textContent = nearest ? nearest.name : '—';
    cardMeta.textContent = nearest ? `${nearest.pos} · ${Math.round((1 - nearest.anchorDist / Math.sqrt(METRICS.length * 10000)) * 100)}% similar to ${anchor.name.split(' ').slice(-1)[0]}` : '—';
  }

  const root = svg.append('g').attr('class', 'sim-root');
  const defs = svg.append('defs');
  const glow = defs.append('filter').attr('id', 'sim-glow').attr('x', '-60%').attr('y', '-60%').attr('width', '220%').attr('height', '220%');
  glow.append('feGaussianBlur').attr('stdDeviation', '3.2').attr('result', 'blur');
  const merge = glow.append('feMerge');
  merge.append('feMergeNode').attr('in', 'blur');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  root.append('text')
    .attr('class', 'sim-axis-label sim-axis-left')
    .attr('x', 44).attr('y', H - 28)
    .text('Interior profile');
  root.append('text')
    .attr('class', 'sim-axis-label sim-axis-right')
    .attr('x', W - 44).attr('y', H - 28)
    .attr('text-anchor', 'end')
    .text('Creator profile');
  root.append('text')
    .attr('class', 'sim-axis-label')
    .attr('x', W / 2).attr('y', 34)
    .attr('text-anchor', 'middle')
    .text('Higher career impact');

  const link = root.append('g')
    .attr('class', 'sim-links')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', d => d.anchor ? 'sim-link anchor' : 'sim-link')
    .attr('stroke-width', d => d.anchor ? 1.7 : 0.8)
    .style('opacity', d => d.anchor ? 0.5 : 0.12);

  const node = root.append('g')
    .attr('class', 'sim-nodes')
    .selectAll('circle')
    .data(nodes, d => d.id)
    .join('circle')
    .attr('class', d => [
      'sim-node',
      d.isAnchor ? 'anchor' : '',
      d.isOpposite ? 'opposite' : '',
      d.isA ? 'player-a-node' : '',
      d.isB ? 'player-b-node' : '',
    ].filter(Boolean).join(' '))
    .attr('r', d => d.r)
    .attr('fill', d => posColor(d.pos))
    .attr('stroke', d => d.isAnchor ? '#f5c518' : d.isA ? '#4d8dff' : d.isB ? '#ff6b1a' : 'rgba(255,255,255,0.18)')
    .attr('stroke-width', d => d.isAnchor ? 3 : (d.isA || d.isB) ? 2.4 : 1)
    .style('filter', d => d.isAnchor ? 'url(#sim-glow)' : null)
    .style('cursor', 'pointer')
    .on('mouseenter', function (e, d) {
      const simToAnchor = Math.max(0, 1 - vectorDistance(playerVector(anchor), d.vec) / Math.sqrt(METRICS.length * 10000));
      d3.select(this).raise().transition().duration(120).attr('r', d.r + 4);
      showTip(d.name, `${d.pos} · ${d.seasonsLine}<br>${Math.round(d.score)} impact · ${Math.round(simToAnchor * 100)}% similar to ${anchor.name.split(' ').slice(-1)[0]}`, 'green');
      link.style('opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 0.62 : (l.anchor ? 0.28 : 0.06));
    })
    .on('mouseleave', function (e, d) {
      d3.select(this).transition().duration(120).attr('r', d.r);
      hideTip();
      link.style('opacity', l => l.anchor ? 0.5 : 0.12);
    })
    .on('click', (e, d) => {
      if (d.id === anchor.id) return;
      selectAct3Player(compareSlot, d.id);
      fireConfetti(e.clientX, e.clientY, { count: 18, colors: [posColor(d.pos), '#f5c518', '#ffffff'] });
    });

  const labelNodes = nodes.filter(d => d.isA || d.isB || d.isAnchor || d.score > 91).slice(0, 18);
  const label = root.append('g')
    .attr('class', 'sim-labels')
    .selectAll('text')
    .data(labelNodes, d => d.id)
    .join('text')
    .attr('class', d => d.isAnchor ? 'sim-label anchor' : 'sim-label')
    .attr('text-anchor', 'middle')
    .text(d => d.name.split(' ').slice(-1)[0]);

  similaritySimulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(d => d.anchor ? 72 + d.dist * 0.36 : 42 + d.dist * 0.42).strength(d => d.anchor ? 0.42 : 0.16))
    .force('charge', d3.forceManyBody().strength(d => d.isAnchor ? -250 : -90))
    .force('x', d3.forceX(d => d.seedX).strength(0.055))
    .force('y', d3.forceY(d => d.seedY).strength(0.06))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collide', d3.forceCollide(d => d.r + 5).iterations(2))
    .alpha(0.95)
    .alphaDecay(0.045)
    .on('tick', () => {
      nodes.forEach(d => {
        d.x = clamp(d.x, d.r + 18, W - d.r - 18);
        d.y = clamp(d.y, d.r + 18, H - d.r - 18);
      });
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
      label
        .attr('x', d => d.x)
        .attr('y', d => d.y - d.r - 8);
    });
}

// Bind quickpicks
function bindQuickpicks() {
  document.querySelectorAll('.qp').forEach(b => {
    b.onclick = () => pickMatchup(b.dataset.a, b.dataset.b, b);
  });
}

// Click outside closes autocomplete
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) {
    document.querySelectorAll('.autocomplete-list').forEach(l => l.classList.remove('open'));
  }
});

// =============================================================================
// ACT 4 — Dynasties (D3 rebuild)
// =============================================================================
let activeTeams = new Set(['Bulls', 'Lakers', 'Spurs', 'Heat', 'Warriors', 'Celtics']);
let dynastyLegendBuilt = false;

const CHAMPIONSHIPS = {
  Bulls:    [1991, 1992, 1993, 1996, 1997, 1998],
  Lakers:   [2000, 2001, 2002, 2009, 2010, 2020],
  Spurs:    [1999, 2003, 2005, 2007, 2014],
  Heat:     [2006, 2012, 2013],
  Warriors: [2015, 2017, 2018, 2022],
  Celtics:  [2008, 2024],
};

function buildDynastyLegend() {
  if (!DATA.act4 || dynastyLegendBuilt) return;
  const legend = document.getElementById('dynasty-legend');
  legend.innerHTML = '';
  Object.entries(DATA.act4).forEach(([name, d]) => {
    const item = document.createElement('button');
    item.className = 'dynasty-dot';
    item.id = 'leg-' + name;
    const rings = (CHAMPIONSHIPS[name] || []).length;
    item.innerHTML = `<span class="swatch" style="background:${d.color}"></span>${name}<span class="rings">◆ ${rings}</span>`;
    item.onclick = () => toggleDynasty(name);
    legend.appendChild(item);
  });
  dynastyLegendBuilt = true;
  updateDynastyLegendState();
}

function toggleDynasty(name) {
  if (activeTeams.has(name)) {
    if (activeTeams.size === 1) return;
    activeTeams.delete(name);
  } else {
    activeTeams.add(name);
  }
  updateDynastyLegendState();
  drawAct4();
}

function setDynastyFocus(names) {
  if (!DATA.act4) return;
  const validTeams = Object.keys(DATA.act4);
  const requested = (names || []).filter(name => validTeams.includes(name));
  activeTeams = new Set(requested.length ? requested : validTeams);
  updateDynastyLegendState();
  drawAct4();
}

function updateDynastyLegendState() {
  if (!DATA.act4) return;
  Object.keys(DATA.act4).forEach(name => {
    const item = document.getElementById('leg-' + name);
    if (item) item.classList.toggle('muted', !activeTeams.has(name));
  });
}

function drawAct4() {
  if (!DATA.act4) return;
  const svg = d3.select('#act4-chart');
  svg.selectAll('*').remove();

  const W = 1000, H = 420;
  const m = { top: 24, right: 80, bottom: 40, left: 50 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const root = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const x = d3.scaleLinear().domain([1990, 2026]).range([0, iw]);
  const y = d3.scaleLinear().domain([0.2, 1.0]).range([ih, 0]);
  const teams = Object.entries(DATA.act4);
  storyChartContexts.act4 = { root, x, y, iw, ih, teams };

  // Gridlines + axes
  root.selectAll('.grid-y').data(y.ticks(5)).join('line').attr('class', 'grid-line')
    .attr('x1', 0).attr('x2', iw).attr('y1', v => y(v)).attr('y2', v => y(v));

  root.append('g').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('d')))
    .call(g => { g.selectAll('text').attr('fill', 'var(--muted)').attr('font-size', 10); g.selectAll('path,line').attr('stroke', 'var(--border)'); });
  root.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(v => Math.round(v * 100) + '%'))
    .call(g => { g.selectAll('text').attr('fill', 'var(--muted)').attr('font-size', 10); g.selectAll('path,line').attr('stroke', 'var(--border)'); });

  // 50% reference line
  root.append('line')
    .attr('x1', 0).attr('x2', iw).attr('y1', y(0.5)).attr('y2', y(0.5))
    .attr('stroke', 'rgba(255,255,255,0.12)').attr('stroke-dasharray', '4 4');
  root.append('text').attr('x', iw + 6).attr('y', y(0.5) + 3)
    .attr('fill', 'var(--muted-2)').attr('font-size', 9).attr('font-family', 'var(--font-mono)')
    .text('.500');

  const line = d3.line().x(d => x(d.s)).y(d => y(d.w)).curve(d3.curveMonotoneX);

  // Lines (draw faded first, then animate)
  const lineGroup = root.append('g').attr('class', 'lines');
  teams.forEach(([name, d]) => {
    const data = d.seasons.map((s, i) => ({ s, w: d.wins[i] }));
    const visible = activeTeams.has(name);
    const path = lineGroup.append('path')
      .attr('class', 'team-line')
      .attr('data-team', name)
      .datum(data)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', d.color)
      .attr('stroke-width', visible ? 2.4 : 1.2)
      .attr('stroke-linecap', 'round')
      .style('opacity', visible ? 0.95 : 0.1);

    if (visible) {
      const total = path.node().getTotalLength();
      path.attr('stroke-dasharray', `${total} ${total}`).attr('stroke-dashoffset', total)
        .transition().duration(1100).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0)
        .on('end', function () { d3.select(this).attr('stroke-dasharray', null); });
    }
  });

  // Championship markers (rings instead of diamonds)
  const champGroup = root.append('g').attr('class', 'champs');
  teams.forEach(([name, d]) => {
    if (!activeTeams.has(name)) return;
    (CHAMPIONSHIPS[name] || []).forEach(season => {
      const idx = d.seasons.indexOf(season);
      if (idx < 0) return;
      const px = x(season), py = y(d.wins[idx]);
      const g = champGroup.append('g').attr('transform', `translate(${px},${py})`).style('opacity', 0)
        .style('cursor', 'pointer')
        .on('mouseenter', function (e) {
          showTip(name + ' · ' + season, `Championship season<br>${Math.round(d.wins[idx] * 100)}% win rate`, 'gold');
          // Confetti burst
          fireConfetti(e.clientX, e.clientY, { count: 25, colors: ['#f5c518', '#ffd44a', '#ff6b1a', d.color] });
        })
        .on('mouseleave', hideTip);
      // Ring icon: gold trophy/ring
      g.append('circle').attr('r', 7).attr('fill', d.color).attr('opacity', 0.18);
      g.append('circle').attr('r', 5).attr('fill', 'none').attr('stroke', '#f5c518').attr('stroke-width', 1.6);
      g.append('path').attr('d', 'M-3 -4 L0 -8 L3 -4 Z').attr('fill', '#f5c518');
      g.append('circle').attr('cx', 0).attr('cy', -6).attr('r', 1.2).attr('fill', '#fff8dc');
      g.transition().delay(1100).duration(300).style('opacity', 1);
    });
  });

  // Crosshair + tooltip on hover
  const focus = root.append('g').style('opacity', 0);
  const vline = focus.append('line').attr('y1', 0).attr('y2', ih)
    .attr('stroke', 'rgba(255,255,255,0.2)').attr('stroke-dasharray', '3 3');
  const yearLbl = focus.append('text').attr('y', -8).attr('text-anchor', 'middle')
    .attr('fill', 'var(--text)').attr('font-size', 11).attr('font-weight', 700)
    .attr('font-family', 'var(--font-mono)');
  const dotG = focus.append('g').attr('class', 'focus-dots');
  const lblG = focus.append('g').attr('class', 'focus-lbls');

  root.append('rect').attr('width', iw).attr('height', ih).attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('mousemove', function (e) {
      const [mx] = d3.pointer(e, this);
      const season = Math.round(x.invert(mx));
      if (season < 1990 || season > 2026) return;
      focus.style('opacity', 1);
      vline.attr('x1', x(season)).attr('x2', x(season));
      yearLbl.attr('x', x(season)).text(season);

      // Per-team dot+label
      const items = [];
      teams.forEach(([name, d]) => {
        if (!activeTeams.has(name)) return;
        const idx = d.seasons.indexOf(season);
        if (idx < 0) return;
        items.push({ name, color: d.color, win: d.wins[idx] });
      });
      items.sort((a, b) => b.win - a.win);

      const dotSel = dotG.selectAll('circle').data(items, d => d.name);
      dotSel.exit().remove();
      dotSel.enter().append('circle').attr('r', 4).attr('stroke', 'var(--bg)').attr('stroke-width', 1.5)
        .merge(dotSel)
        .attr('cx', x(season)).attr('cy', d => y(d.win)).attr('fill', d => d.color);

      const lblSel = lblG.selectAll('text').data(items, d => d.name);
      lblSel.exit().remove();
      lblSel.enter().append('text').attr('font-size', 10).attr('font-weight', 600)
        .attr('text-anchor', 'start').attr('paint-order', 'stroke')
        .attr('stroke', 'var(--bg-card)').attr('stroke-width', 3)
        .merge(lblSel)
        .attr('x', x(season) + 8).attr('y', d => y(d.win) + 3)
        .attr('fill', d => d.color)
        .text(d => `${d.name} ${Math.round(d.win * 100)}%`);
    })
    .on('mouseleave', () => focus.style('opacity', 0));
}

// =============================================================================
// ACT 5 — Draft Predictor
// =============================================================================
let selectedDraftCell = { bucket: '1', tier: '50_plus' };

function drawDraftHeatmap() {
  const d = DATA.act5;
  const svg = d3.select('#draft-heatmap');
  if (!svg.node() || !d) return;
  svg.selectAll('*').remove();

  const W = 1040, H = 560;
  const m = { top: 38, right: 28, bottom: 72, left: 92 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const root = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
  const buckets = d.pickBuckets || [];
  const tiers = [...(d.vorpTiers || [])].reverse();
  const x = d3.scaleBand().domain(buckets.map(b => b.id)).range([0, iw]).padding(0.06);
  const y = d3.scaleBand().domain(tiers.map(t => t.id)).range([0, ih]).padding(0.08);
  const maxRate = Math.max(18, d3.max(d.cells || [], c => c.rate) || 18);
  const color = d3.scaleSequential(t => d3.interpolateRgbBasis(['#121a2b', '#1d6fe8', '#4ade80', '#f5c518', '#ff6b1a'])(t))
    .domain([0, maxRate]);
  const bucketLabel = new Map(buckets.map(b => [b.id, b.label]));
  const tierLabel = new Map((d.vorpTiers || []).map(t => [t.id, t.label]));

  root.append('g').selectAll('rect')
    .data(d.cells || [], c => `${c.bucket}:${c.tier}`)
    .join('rect')
    .attr('class', c => `draft-cell ${selectedDraftCell.bucket === c.bucket && selectedDraftCell.tier === c.tier ? 'selected' : ''}`)
    .attr('x', c => x(c.bucket))
    .attr('y', c => y(c.tier))
    .attr('width', x.bandwidth())
    .attr('height', y.bandwidth())
    .attr('rx', 5)
    .attr('fill', c => color(c.rate))
    .attr('fill-opacity', c => c.total ? 0.92 : 0.18)
    .on('mouseenter', (e, c) => {
      const med = c.medianVorp === null ? 'median n/a' : `median ${c.medianVorp} VORP`;
      showTip(`Pick ${bucketLabel.get(c.bucket)} · ${tierLabel.get(c.tier)} VORP`, `${c.count}/${c.total} players · ${c.rate}%<br>${med}`, 'blue');
    })
    .on('mouseleave', hideTip)
    .on('click', (e, c) => {
      selectDraftCell(c.bucket, c.tier);
      fireConfetti(e.clientX, e.clientY, { count: 16, colors: ['#4d8dff', '#4ade80', '#f5c518', '#ffffff'] });
    });

  root.append('g').selectAll('text')
    .data(d.cells || [], c => `${c.bucket}:${c.tier}`)
    .join('text')
    .attr('class', 'draft-cell-label')
    .attr('x', c => x(c.bucket) + x.bandwidth() / 2)
    .attr('y', c => y(c.tier) + y.bandwidth() / 2 + 4)
    .text(c => c.rate >= 4 ? `${c.rate}%` : '');

  root.append('g').selectAll('text')
    .data(buckets)
    .join('text')
    .attr('class', 'draft-axis-label')
    .attr('x', b => x(b.id) + x.bandwidth() / 2)
    .attr('y', ih + 25)
    .attr('text-anchor', 'middle')
    .text(b => b.label);

  root.append('g').selectAll('text')
    .data(tiers)
    .join('text')
    .attr('class', 'draft-axis-label')
    .attr('x', -12)
    .attr('y', t => y(t.id) + y.bandwidth() / 2 + 4)
    .attr('text-anchor', 'end')
    .text(t => t.label);

  const cellByKey = new Map((d.cells || []).map(c => [`${c.bucket}:${c.tier}`, c]));
  const annotateDraftCell = (bucket, tier, opts) => {
    const cell = cellByKey.get(`${bucket}:${tier}`);
    if (!cell || x(bucket) === undefined || y(tier) === undefined) return;
    drawChartAnnotation(
      root,
      x(bucket) + x.bandwidth() / 2,
      y(tier) + y.bandwidth() / 2,
      { ...opts, bounds: { iw, ih } }
    );
  };
  annotateDraftCell('1', '50_plus', {
    label: 'Pick 1 dominates this tier',
    detail: `${cellByKey.get('1:50_plus')?.rate || 0}% reach 50+ VORP`,
    dx: 66,
    dy: 56,
    width: 224,
  });
  annotateDraftCell('11_14', '50_plus', {
    label: 'Stars leak past the top 10',
    detail: 'Malone, Kobe, Reggie live here',
    dx: 54,
    dy: 82,
    width: 210,
    delay: 380,
  });
  annotateDraftCell('15_20', 'le_0', {
    label: 'Risk rises fast',
    detail: `${cellByKey.get('15_20:le_0')?.rate || 0}% finish at <=0 VORP`,
    dx: 44,
    dy: -74,
    width: 176,
    delay: 500,
  });

  root.append('text')
    .attr('class', 'draft-axis-label')
    .attr('x', iw / 2).attr('y', ih + 56)
    .attr('text-anchor', 'middle')
    .text('Overall draft pick bucket');
  root.append('text')
    .attr('class', 'draft-axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -ih / 2).attr('y', -70)
    .attr('text-anchor', 'middle')
    .text('Career VORP tier');

  const summary = document.getElementById('draft-summary');
  if (summary && d.summary) {
    summary.textContent = `${d.summary.reliablePlayers.toLocaleString()} matched players · classes ${d.summary.reliabilitySeasons[0]}-${d.summary.reliabilitySeasons[1]} · recent classes held out`;
  }
  storyChartContexts.act5 = { root, x, y, iw, ih };
  selectDraftCell(selectedDraftCell.bucket, selectedDraftCell.tier, false);
}

function selectDraftCell(bucket, tier, redraw = true) {
  if (!DATA.act5) return;
  selectedDraftCell = { bucket, tier };
  const cell = (DATA.act5.cells || []).find(c => c.bucket === bucket && c.tier === tier);
  const bucketMeta = (DATA.act5.pickBuckets || []).find(b => b.id === bucket);
  const tierMeta = (DATA.act5.vorpTiers || []).find(t => t.id === tier);
  if (!cell || !bucketMeta || !tierMeta) return;

  d3.selectAll('.draft-cell').classed('selected', c => c && c.bucket === bucket && c.tier === tier);

  const title = document.getElementById('draft-detail-title');
  const copy = document.getElementById('draft-detail-copy');
  const examples = document.getElementById('draft-examples');
  if (title) title.textContent = `Pick ${bucketMeta.label} -> ${tierMeta.label} VORP`;
  if (copy) {
    const med = cell.medianVorp === null ? 'no median available' : `median ${cell.medianVorp} career VORP`;
    copy.textContent = `${cell.count} of ${cell.total} reliable players landed here (${cell.rate}%). ${med}.`;
  }
  if (examples) {
    examples.innerHTML = cell.examples.length
      ? cell.examples.map(ex => `<div class="draft-example">
          <div><strong>${ex.player}</strong><br><span>${ex.season} · pick ${ex.pick}</span></div>
          <em>${ex.vorp} VORP</em>
        </div>`).join('')
      : '<div class="draft-example"><strong>No reliable examples</strong><em>0</em></div>';
  }
  if (redraw && !document.querySelector('.draft-cell')) drawDraftHeatmap();
}

// =============================================================================
// INIT
// =============================================================================
Object.assign(window, {
  showSection,
  startStoryMode,
  closeStoryMode,
  exploreCurrentStoryView,
  storyNext,
  storyPrev,
  goToStoryStop,
  act1Go,
  act1SetMetric,
  highlightPlayer,
  togglePos,
  toggleTrail,
  updateYear,
  searchPlayer,
  selectAct3Player,
  setMode,
  setSimilarityAnchor,
  setShotZoneYear,
  setShotMapMode,
  drawShotZoneHeatmap,
  drawDraftHeatmap,
  selectDraftCell,
});

bindQuickpicks();
setupScrollNarrative();
renderSection('hero');

// Load act1 eagerly for hero chart
ensureLoaded('act1').then(() => drawHeroChart());

// Prefetch remaining act data
const prefetchIdle = window.requestIdleCallback || (cb => setTimeout(cb, 600));
prefetchIdle(() => ensureLoaded('act4'));
prefetchIdle(() => { ensureLoaded('act2'); ensureLoaded('act3'); });
prefetchIdle(() => { ensureLoaded('act1Shots'); ensureLoaded('act1Real'); ensureLoaded('act5'); });
