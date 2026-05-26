// =============================================================================
// AIRBALL — NBA Data Story
// Acts 1–4: D3 v7
// =============================================================================

const DATA = { act1: null, act2: null, act3: null, act4: null };
const LOADED = new Set();

const DATA_PATHS = {
  act1: '../js/act1_revolution.json',
  act2: '../js/act2_bubbles.json',
  act3: '../js/act3_players.json',
  act4: '../js/act4_dynasties.json',
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
// SECTION SWITCHER
// =============================================================================
const sections = ['hero', 'act1', 'act2', 'act3', 'act4'];

async function showSection(id) {
  sections.forEach(s => {
    const el = document.getElementById(s);
    el.style.display = 'none';
    el.classList.remove('visible');
  });
  const target = document.getElementById(id);
  target.style.display = 'flex';
  target.classList.add('visible');
  document.querySelectorAll('.nav-act').forEach(el => {
    el.classList.toggle('active', el.dataset.section === id);
  });
  window.scrollTo(0, 0);

  if (id === 'hero') { await ensureLoaded('act1'); drawHeroChart(); }
  if (id === 'act1') { await ensureLoaded('act1'); drawAct1(act1Step); drawSmallMults(); }
  if (id === 'act2') { await ensureLoaded('act2'); drawAct2(); }
  if (id === 'act3') { await ensureLoaded('act3'); initAct3Defaults(); }
  if (id === 'act4') { await ensureLoaded('act4'); buildDynastyLegend(); drawAct4(); }
}

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
  el.classList.add('active');
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
// ACT 2 — Era Explorer
// =============================================================================
const posColors = { PG: '#4fc3f7', SG: '#ff6b1a', SF: '#66bb6a', PF: '#ab47bc', C: '#ef5350' };
let currentYear = 2015, highlightName = '', playing = false, playInterval = null;
let mutedPos = new Set();
let trailMode = false;

function toggleTrail() {
  trailMode = !trailMode;
  const btn = document.getElementById('trail-toggle');
  btn.classList.toggle('active', trailMode);
  btn.setAttribute('aria-pressed', trailMode);
  drawAct2();
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
  highlightName = (val || '').toLowerCase().trim();
  drawAct2();
}

function togglePos(pos, el) {
  if (mutedPos.has(pos)) { mutedPos.delete(pos); el.classList.remove('muted'); }
  else { mutedPos.add(pos); el.classList.add('muted'); }
  drawAct2();
}

function updateYear(val) {
  currentYear = parseInt(val);
  document.getElementById('year-display').textContent = currentYear;
  document.getElementById('era-watermark').textContent = eraNameForYear(currentYear);
  drawAct2();
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
      document.getElementById('year-slider').value = currentYear;
      document.getElementById('year-display').textContent = currentYear;
      document.getElementById('era-watermark').textContent = eraNameForYear(currentYear);
      drawAct2();
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
  if (act3Initialized) { drawRadar(); drawHeadToHead(); return; }
  const s = DATA.act3.search;
  const lb = s.find(p => p.name === 'LeBron James');
  const mj = s.find(p => p.name === 'Michael Jordan');
  if (lb) selectAct3Player('A', lb.id);
  if (mj) selectAct3Player('B', mj.id);
  // Highlight default quickpick
  const def = document.querySelector('.qp[data-a="LeBron James"]');
  if (def) def.classList.add('active');
  act3Initialized = true;
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
  btn.classList.add('active');
  document.getElementById('radar-mode-label').innerHTML =
    mode === 'normalized' ? 'Normalized<br>career stats' : 'Raw career<br>stats';
  document.getElementById('mode-explain').textContent =
    mode === 'normalized'
      ? 'Percentile rank across all NBA history (1974 →). Bigger is better.'
      : 'Raw career averages — context-free. Eras vary wildly in pace.';
  drawRadar();
  updateVerdict();
  drawHeadToHead();
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
}

function toggleDynasty(name) {
  if (activeTeams.has(name)) {
    if (activeTeams.size === 1) return;
    activeTeams.delete(name);
    document.getElementById('leg-' + name).classList.add('muted');
  } else {
    activeTeams.add(name);
    document.getElementById('leg-' + name).classList.remove('muted');
  }
  drawAct4();
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

  const teams = Object.entries(DATA.act4);
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
// INIT
// =============================================================================
bindQuickpicks();
showSection('hero');

// Load act1 eagerly for hero chart
ensureLoaded('act1').then(() => drawHeroChart());

// Prefetch remaining act data
const prefetchIdle = window.requestIdleCallback || (cb => setTimeout(cb, 600));
prefetchIdle(() => ensureLoaded('act4'));
prefetchIdle(() => { ensureLoaded('act2'); ensureLoaded('act3'); });
