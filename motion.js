'use strict';
// Hearth showcase: the motion layer. A WebGL flame in the arch, one canvas of light and sparks for the whole page,
// kinetic type, a scroll-pushed marquee, and two pinned scenes scrubbed by scroll (the journey and the morph).

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  const T0 = performance.now();

  /* ── Shared state: pointer and scroll velocity ─────────────────────── */
  const pointer = { x: innerWidth / 2, y: innerHeight * 0.35, sx: innerWidth / 2, sy: innerHeight * 0.35, speed: 0, seen: false };
  addEventListener('pointermove', (e) => {
    pointer.speed = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.seen = true;
  }, { passive: true });
  let lastScroll = scrollY, velocity = 0;
  addEventListener('scroll', () => { velocity = velocity * 0.6 + (scrollY - lastScroll) * 0.4; lastScroll = scrollY; }, { passive: true });

  /* ── WebGL flame ───────────────────────────────────────────────────── */
  const FLAME_FS = `
precision mediump float;
uniform vec2 uRes; uniform float uTime; uniform float uIgnite; uniform float uWind;
float hash(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float baseY = 0.13;
  float maxH = 0.6 * uIgnite + 0.0001;
  float y = (uv.y - baseY) / maxH;
  float t = uTime;
  vec2 q = vec2(uv.x * 5.0, uv.y * 4.2 - t * 1.9);
  float n1 = fbm(q);
  float n2 = fbm(q * 2.1 + vec2(0.0, -t * 1.4));
  float x = (uv.x - 0.5) / 0.2;
  x += (n1 - 0.5) * 1.4 * clamp(y, 0.0, 1.5) + uWind * y * y * 1.3;
  float halfW = max(0.001, (1.0 - pow(clamp(y, 0.0, 1.0), 0.85)) * (0.82 + 0.38 * n2));
  float body = 1.0 - smoothstep(halfW * 0.22, halfW, abs(x));
  body *= smoothstep(-0.05, 0.07, y);
  body *= 1.0 - smoothstep(0.5 + 0.45 * n2, 1.05, y);
  float core = (1.0 - smoothstep(0.0, halfW * 0.4 + 0.001, abs(x))) * (1.0 - smoothstep(0.02, 0.36, y)) * smoothstep(-0.03, 0.05, y);
  float heat = clamp(body * (0.6 + 0.42 * n1) + core * 0.45, 0.0, 1.0);
  vec3 deep = vec3(0.5, 0.09, 0.02);
  vec3 orange = vec3(0.98, 0.4, 0.09);
  vec3 gold = vec3(1.0, 0.68, 0.3);
  vec3 white = vec3(1.0, 0.92, 0.76);
  vec3 col = mix(deep, orange, smoothstep(0.04, 0.38, heat));
  col = mix(col, gold, smoothstep(0.42, 0.78, heat));
  col = mix(col, white, smoothstep(0.9, 1.0, heat));
  float flicker = 0.9 + 0.1 * noise(vec2(t * 3.1, 0.5));
  float a = smoothstep(0.02, 0.32, heat) * clamp(uIgnite * 1.4, 0.0, 1.0) * flicker;
  gl_FragColor = vec4(col * a, a);
}`;
  function createFlame(canvas) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    const shader = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null; };
    const vs = shader(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }');
    const fs = shader(gl.FRAGMENT_SHADER, FLAME_FS);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = { res: gl.getUniformLocation(prog, 'uRes'), time: gl.getUniformLocation(prog, 'uTime'), ignite: gl.getUniformLocation(prog, 'uIgnite'), wind: gl.getUniformLocation(prog, 'uWind') };
    return {
      draw(time, ignite, wind) {
        const dpr = Math.min(2, devicePixelRatio || 1);
        const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(u.res, w, h); gl.uniform1f(u.time, time); gl.uniform1f(u.ignite, ignite); gl.uniform1f(u.wind, wind);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    };
  }
  const heroMark = $('.hero-mark');
  const heroFlame = createFlame($('[data-flame]'));
  const footFlame = createFlame($('[data-flame-foot]'));
  if (heroFlame) document.documentElement.classList.add('has-flame');
  let heroIgnite = reduced ? 1 : 0, footIgnite = reduced ? 1 : 0, wind = 0;
  let footSeen = false;

  /* ── One canvas of light: glow, sparks, embers, the intro streak ──── */
  const canvas = $('.pool');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(1.5, devicePixelRatio || 1);
  const size = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
  size(); addEventListener('resize', size);
  const sparks = [];
  const embers = Array.from({ length: reduced ? 0 : 34 }, () => newEmber(true));
  function newEmber(anywhere) {
    return { x: Math.random() * innerWidth, y: anywhere ? Math.random() * innerHeight : innerHeight + 10, vy: -(0.15 + Math.random() * 0.45), r: 0.6 + Math.random() * 1.3, a: 0.08 + Math.random() * 0.22, ph: Math.random() * 6.28 };
  }
  /** A burst of sparks at a point on screen (keys, landings, bars). */
  function burst(x, y, n = 26, spread = 1) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, sp = (0.6 + Math.random() * 2.6) * spread;
      sparks.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.2, life: 1, decay: 0.012 + Math.random() * 0.02, r: 0.6 + Math.random() * 1.4, g: -0.02 });
    }
  }
  window.FX = { burst };
  const glow = (x, y, r, alpha) => {
    if (alpha <= 0.002) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255, 170, 95, ${alpha})`);
    g.addColorStop(0.4, `rgba(242, 154, 75, ${alpha * 0.35})`);
    g.addColorStop(1, 'rgba(242, 154, 75, 0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const heroGeom = () => {
    const r = heroMark.getBoundingClientRect();
    return { cx: r.left + r.width / 2, base: r.top + r.height * (21 / 24), mid: r.top + r.height * 0.62, tip: r.top + r.height * 0.42, visible: r.bottom > -100 && r.top < innerHeight + 100, w: r.width };
  };
  // The intro: a spark streaks in from the dark, strikes the hearth, and the arch draws itself.
  const intro = { start: 300, hit: 1050, done: reduced, flashed: false, trail: [] };

  function drawIntro(now) {
    if (intro.done) return;
    const t = now - T0;
    const g = heroGeom();
    if (t >= intro.start && t < intro.hit) {
      const k = easeIO(seg(t, intro.start, intro.hit));
      const sx = -60, sy = innerHeight * 0.95, cx = innerWidth * 0.18, cy = innerHeight * 0.05, tx = g.cx, ty = g.mid;
      const x = (1 - k) * (1 - k) * sx + 2 * (1 - k) * k * cx + k * k * tx;
      const y = (1 - k) * (1 - k) * sy + 2 * (1 - k) * k * cy + k * k * ty;
      intro.trail.push({ x, y });
      if (intro.trail.length > 22) intro.trail.shift();
      intro.trail.forEach((p, i) => {
        const f = i / intro.trail.length;
        ctx.fillStyle = `rgba(255, ${190 + 50 * f | 0}, ${120 + 100 * f | 0}, ${f * 0.9})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 0.6 + f * 2.6, 0, Math.PI * 2); ctx.fill();
      });
      glow(x, y, 60, 0.5);
      if (Math.random() < 0.6) sparks.push({ x, y, vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.2) * 1.2, life: 1, decay: 0.03, r: 0.8, g: 0.03 });
    }
    if (t >= intro.hit) {
      if (!intro.flashed) { intro.flashed = true; burst(g.cx, g.mid, 60, 1.6); }
      const f = seg(t, intro.hit, intro.hit + 900);
      const R = Math.max(innerWidth, innerHeight) * (0.2 + ease(f) * 1.1);
      glow(g.cx, g.mid, R, 0.45 * (1 - f));
      if (f >= 1) intro.done = true;
    }
  }

  /* ── Kinetic headline: letters, then the cursor lifts them ─────────── */
  const display = $('[data-kinetic]');
  const chars = [];
  if (display) {
    let i = 0;
    const out = [];
    for (const node of [...display.childNodes]) {
      if (node.nodeName === 'BR') { out.push('<br>'); continue; }
      const words = node.textContent.split(/(\s+)/);
      for (const word of words) {
        if (!word) continue;
        if (/^\s+$/.test(word)) { out.push(' '); continue; }
        out.push(`<span class="w">${[...word].map((c) => `<span class="ch" style="--i:${i++}"><span>${c}</span></span>`).join('')}</span>`);
      }
    }
    display.setAttribute('aria-label', display.textContent.replace(/\s+/g, ' ').trim());
    display.innerHTML = out.join('');
    for (const el of $$('.ch > span', display)) chars.push({ el, x: 0, y: 0, lift: 0 });
  }
  let charsMeasured = false;
  const measureChars = () => { for (const c of chars) { const r = c.el.getBoundingClientRect(); c.x = r.left + r.width / 2 + scrollX; c.y = r.top + r.height / 2 + scrollY; } charsMeasured = true; };
  addEventListener('resize', () => { charsMeasured = false; });
  function liftChars() {
    if (reduced || !finePointer || !pointer.seen) return;
    if (!charsMeasured) measureChars();
    for (const c of chars) {
      const d = Math.hypot(pointer.x + scrollX - c.x, pointer.y + scrollY - c.y);
      const target = Math.pow(clamp(1 - d / 170), 2) * 14;
      if (Math.abs(target - c.lift) < 0.05) continue;
      c.lift += (target - c.lift) * 0.25;
      c.el.style.transform = c.lift > 0.05 ? `translateY(${(-c.lift).toFixed(2)}px)` : '';
      c.el.style.color = c.lift > 6 ? 'var(--flame-hi)' : '';
    }
  }

  /* ── Titles rise from behind a line ────────────────────────────────── */
  for (const title of $$('.title')) {
    let i = 0;
    const out = [];
    for (const node of [...title.childNodes]) {
      if (node.nodeName === 'BR') { out.push('<br>'); continue; }
      for (const word of node.textContent.split(/(\s+)/)) {
        if (!word) continue;
        if (/^\s+$/.test(word)) { out.push(' '); continue; }
        out.push(`<span class="w"><span style="--i:${i++}">${word}</span></span>`);
      }
    }
    title.innerHTML = out.join('');
  }
  const titleWatch = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); titleWatch.unobserve(e.target); }
  }, { threshold: 0.4 });
  for (const t of $$('.title')) titleWatch.observe(t);

  /* ── Marquee pushed by scroll ──────────────────────────────────────── */
  const rows = $$('[data-marquee] .mq-row').map((row) => {
    const original = row.innerHTML;
    row.innerHTML = original + original + original + original;
    return { row, dir: Number(row.dataset.dir), x: 0, width: 0 };
  });
  const measureRows = () => { for (const r of rows) r.width = r.row.scrollWidth / 4; };
  measureRows(); addEventListener('resize', measureRows); addEventListener('load', measureRows);
  function moveMarquee(dt) {
    for (const r of rows) {
      const speed = (reduced ? 0 : 38) + Math.abs(velocity) * 2.2;
      r.x -= r.dir * speed * dt * (velocity < -0.5 ? -1 : 1);
      if (r.width) { r.x %= r.width; if (r.x > 0) r.x -= r.width; }
      r.row.style.transform = `translate3d(${r.x.toFixed(1)}px, 0, 0)`;
    }
  }

  /* ── The journey (pinned, scrubbed) ────────────────────────────────── */
  const J = {
    section: $('#journey'), stage: $('[data-jstage]'), canvas: $('[data-jcanvas]'), slip: $('[data-jslip]'), text: $('[data-jtext]'),
    nodesBox: $('[data-jnodes]'), chipsBox: $('[data-jchips]'), diff: $('[data-jdiff]'), term: $('[data-jterm]'), dotsBox: $('[data-jdots]'),
    result: $('[data-jresult]'), ledger: $('[data-jledger]'), check: $('[data-jcheck]'), progress: $('[data-jprogress]'), phases: $$('.j-phases li'),
  };
  J.phases.forEach((li, i) => { li.dataset.n = String(i + 1); });
  const REQUEST = 'Uploads over 10 MB fail with a 413. Find why and fix the retry loop.';
  const NODES = [
    { id: 'pkg', name: 'package.json', x: 0.07, y: 0.4 }, { id: 'index', name: 'src/index.ts', x: 0.13, y: 0.6 },
    { id: 'server', name: 'src/server.ts', x: 0.09, y: 0.82 }, { id: 'api', name: 'src/api.ts', x: 0.3, y: 0.47 },
    { id: 'chunk', name: 'src/chunk.ts', x: 0.33, y: 0.72 }, { id: 'upload', name: 'src/upload.ts', x: 0.52, y: 0.58 },
    { id: 'test', name: 'test/upload.test.ts', x: 0.5, y: 0.86 }, { id: 'time', name: 'src/time.ts', x: 0.68, y: 0.76 },
    { id: 'retry', name: 'src/retry.ts', x: 0.74, y: 0.43 }, { id: 'config', name: 'src/config.ts', x: 0.84, y: 0.62 },
    { id: 'log', name: 'src/log.ts', x: 0.6, y: 0.32 }, { id: 'readme', name: 'README.md', x: 0.83, y: 0.86 },
  ];
  const EDGES = [['upload', 'retry'], ['upload', 'chunk'], ['upload', 'api'], ['upload', 'time'], ['upload', 'config'], ['test', 'upload'], ['index', 'api'], ['server', 'index'], ['retry', 'time'], ['api', 'log'], ['config', 'log'], ['pkg', 'index'], ['retry', 'log'], ['readme', 'config']];
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  J.nodesBox.innerHTML = NODES.map((n) => `<div class="j-node" data-node="${n.id}" style="left:${n.x * 100}%;top:${n.y * 100}%"><span class="dot"></span><span class="name">${n.name}</span><span class="tag"></span></div>`).join('');
  for (const n of NODES) n.el = $(`[data-node="${n.id}"]`, J.nodesBox);
  const CHIPS = [
    '<i class="g g-read"></i><b>Read</b><code>src/upload.ts</code><span class="ok">✓</span>',
    '<i class="g g-search"></i><b>Searched</b><code>"413" · 2 files</code><span class="ok">✓</span>',
    '<i class="g g-read"></i><b>Read</b><code>src/retry.ts</code><span class="ok">✓</span>',
    '<i class="g g-edit"></i><b>Edited</b><code>src/upload.ts</code><em class="add">+12</em><em class="del">−3</em>',
    '<i class="g g-run"></i><b>Ran</b><code>bun test upload</code><span class="ok">14 pass</span>',
  ];
  J.chipsBox.innerHTML = CHIPS.map((c) => `<div class="j-chip">${c}</div>`).join('');
  const chipEls = $$('.j-chip', J.chipsBox);
  J.dotsBox.innerHTML = '<i></i>'.repeat(14);
  const dotEls = $$('i', J.dotsBox);
  const dels = $$('.j-dl.del', J.diff), adds = $$('.j-dl.add', J.diff);
  const addTexts = adds.map((a) => { const span = $('span', a); const text = span.dataset.type; span.textContent = ''; return { span, text }; });
  const cmdSpan = $('.j-cmd [data-type]', J.term); const cmdText = cmdSpan.dataset.type; cmdSpan.textContent = '';
  const ledgerItems = $$('.j-ledger-items > *', J.ledger);
  const jctx = J.canvas.getContext('2d');
  let jw = 0, jh = 0, jp = 0, landed = false;
  const sizeJ = () => { const r = J.stage.getBoundingClientRect(); jw = r.width; jh = r.height; J.canvas.width = jw * dpr; J.canvas.height = jh * dpr; };
  sizeJ(); new ResizeObserver(sizeJ).observe(J.stage);
  const place = (el, r, o = 1) => { el.style.left = `${r[0] * 100}%`; el.style.top = `${r[1] * 100}%`; el.style.width = `${r[2] * 100}%`; el.style.height = r[3] ? `${r[3] * 100}%` : ''; el.style.opacity = o; };
  const mixRect = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
  const sectionProgress = (el) => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); };
  const PH = [0, 0.16, 0.4, 0.6, 0.78, 1];
  const jstate = { edges: 0, dim: 0, beam1: 0, beam2: 0, ripple: 0, fade: 0, fly: 0 };

  function renderJourney(p) {
    jp = p;
    J.progress.style.width = `${p * 100}%`;
    const phase = PH.findIndex((v, i) => p >= v && p < PH[i + 1]);
    const now = phase < 0 ? 4 : phase;
    J.phases.forEach((li, i) => {
      li.classList.toggle('is-now', i === now);
      li.classList.toggle('is-done', i < now);
      $('.bar i', li).style.width = `${(i === now ? seg(p, PH[i], PH[i + 1]) : i < now ? 1 : 0) * 100}%`;
    });
    const q0 = seg(p, 0, 0.14), q1 = seg(p, 0.16, 0.4), q2 = seg(p, 0.4, 0.6), q3 = seg(p, 0.6, 0.78), q4 = seg(p, 0.78, 1);

    // 0 · the request types itself, then the slip lifts to the corner.
    const typed = Math.round(ease(q0) * REQUEST.length);
    if (J.text.textContent.length !== typed) J.text.textContent = REQUEST.slice(0, typed);
    $('.j-caret', J.slip).style.opacity = q1 > 0.15 ? 0 : 1;
    const lift = ease(seg(q1, 0, 0.22));
    J.slip.style.left = `${lerp(18, 3, lift)}%`;
    J.slip.style.top = `${lerp(36, 4, lift)}%`;
    J.slip.style.transform = `scale(${lerp(1, 0.66, lift)})`;
    J.slip.style.opacity = String(q0 > 0 || p > 0 ? 1 - ease(seg(q4, 0, 0.2)) * 0.85 : 0.0001);

    // 1 · the project appears; a beam reads, a ripple searches, a second beam reads.
    NODES.forEach((n, i) => {
      const k = ease(seg(q1, 0.06 + i * 0.022, 0.2 + i * 0.022));
      const focus = n.id === 'upload' || n.id === 'retry';
      const dim = focus ? 1 - 0.35 * seg(q3, 0, 0.3) : 1 - 0.72 * ease(seg(q2, 0, 0.2));
      n.el.style.setProperty('--s', (0.6 + 0.4 * k).toFixed(3));
      n.el.style.setProperty('--o', (k * dim * (1 - 0.8 * ease(seg(q4, 0, 0.2)))).toFixed(3));
    });
    jstate.edges = ease(seg(q1, 0.12, 0.42));
    jstate.dim = ease(seg(q2, 0, 0.2));
    jstate.beam1 = seg(q1, 0.3, 0.46);
    jstate.ripple = seg(q1, 0.5, 0.74);
    jstate.beam2 = seg(q1, 0.76, 0.92);
    jstate.fade = ease(seg(q4, 0, 0.2));
    const up = byId.upload.el, re = byId.retry.el;
    up.classList.toggle('is-read', q1 >= 0.46);
    up.classList.toggle('is-hit', q1 >= 0.6 && q2 < 0.9);
    re.classList.toggle('is-hit', q1 >= 0.66 && q1 < 0.92);
    re.classList.toggle('is-read', q1 >= 0.92);
    up.classList.toggle('is-edit', q2 >= 0.92);
    $('.tag', up).textContent = q2 >= 0.92 ? 'edited' : q1 >= 0.6 && q1 < 0.92 ? '“413”' : 'read';
    $('.tag', re).textContent = q1 >= 0.92 ? 'read' : '“413”';
    const chipOn = [q1 >= 0.46, q1 >= 0.74, q1 >= 0.92, q2 >= 0.92, q3 >= 0.92];
    chipEls.forEach((c, i) => { c.classList.toggle('on', chipOn[i] && q4 < 0.12); });

    // 2 · the diff grows out of the file and writes itself.
    const nodeRect = [byId.upload.x, byId.upload.y - 0.02, 0.02, 0.04];
    const diffRect = [0.32, 0.24, 0.62, 0.0];
    const diffSide = [0.03, 0.3, 0.5, 0.0];
    const g2 = ease(seg(q2, 0.04, 0.3)), g3 = ease(seg(q3, 0, 0.25));
    let dr = mixRect(nodeRect, diffRect, g2); dr = mixRect(dr, diffSide, g3);
    place(J.diff, [dr[0], dr[1], dr[2], 0], seg(q2, 0.04, 0.14) * (1 - 0.85 * jstate.fade));
    J.diff.style.transform = `scale(${lerp(0.4, 1, g2) * lerp(1, 0.96, jstate.fade)})`;
    J.diff.style.transformOrigin = '0 0';
    J.diff.style.filter = jstate.fade > 0.05 ? `blur(${(jstate.fade * 3).toFixed(1)}px)` : '';
    dels.forEach((d, k) => d.style.setProperty('--strike', ease(seg(q2, 0.3 + k * 0.06, 0.42 + k * 0.06)).toFixed(3)));
    addTexts.forEach((a, k) => {
      const f = seg(q2, 0.5 + k * 0.1, 0.62 + k * 0.1);
      const n = Math.round(f * a.text.length);
      if (a.span.textContent.length !== n) a.span.textContent = a.text.slice(0, n);
      adds[k].style.setProperty('--fill', f.toFixed(3));
    });

    // 3 · the tests run beside it.
    const termIn = ease(seg(q3, 0.1, 0.28));
    place(J.term, [0.57, 0.3, 0.39, 0], termIn * (1 - 0.85 * jstate.fade));
    J.term.style.transform = `translateY(${lerp(30, 0, termIn)}px) scale(${lerp(1, 0.96, jstate.fade)})`;
    J.term.style.filter = jstate.fade > 0.05 ? `blur(${(jstate.fade * 3).toFixed(1)}px)` : '';
    const cmdN = Math.round(seg(q3, 0.2, 0.34) * cmdText.length);
    if (cmdSpan.textContent.length !== cmdN) cmdSpan.textContent = cmdText.slice(0, cmdN);
    const on = Math.floor(seg(q3, 0.36, 0.86) * 14 + 0.0001);
    dotEls.forEach((d, i) => d.classList.toggle('on', i < on));
    J.result.style.opacity = seg(q3, 0.86, 0.96);

    // 4 · the ledger assembles; an ember lands on "Checks passed".
    const lin = ease(seg(q4, 0.08, 0.26));
    J.ledger.style.opacity = lin;
    J.ledger.style.transform = `translate(-50%, calc(-50% + ${lerp(30, 0, lin)}px)) scale(${lerp(0.96, 1, lin)})`;
    J.ledger.style.setProperty('--rule', ease(seg(q4, 0.2, 0.4)).toFixed(3));
    ledgerItems.forEach((it, i) => it.classList.toggle('on', q4 >= 0.38 + i * 0.09));
    J.ledger.style.setProperty('--acts', seg(q4, 0.7, 0.85).toFixed(3));
    jstate.fly = seg(q4, 0.52, 0.64);
    if (jstate.fly >= 1 && !landed) {
      landed = true;
      const r = J.check.getBoundingClientRect();
      burst(r.left + 6, r.top + r.height / 2, 34, 1.1);
    }
    if (q4 < 0.5) landed = false;
  }

  function drawJourney(time) {
    const c = jctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, jw, jh);
    const P = (n) => ({ x: n.x * jw, y: n.y * jh });
    const fade = 1 - jstate.fade * 0.85;
    // Edges, drawn outward from their first node.
    for (const [a, b] of EDGES) {
      const A = P(byId[a]), B = P(byId[b]);
      const focus = (a === 'upload' || b === 'upload') && (a === 'retry' || b === 'retry');
      const alpha = (focus ? 0.4 : 0.16) * (1 - (focus ? 0 : 0.7) * jstate.dim) * fade;
      if (jstate.edges <= 0 || alpha <= 0.01) continue;
      c.strokeStyle = `rgba(235, 230, 220, ${alpha})`;
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(lerp(A.x, B.x, jstate.edges), lerp(A.y, B.y, jstate.edges)); c.stroke();
    }
    // Reading beams from the request to a file, with tokens running along them.
    const slipR = J.slip.getBoundingClientRect(), stageR = J.stage.getBoundingClientRect();
    const S = { x: slipR.left - stageR.left + slipR.width * 0.5, y: slipR.bottom - stageR.top };
    const beam = (target, k) => {
      if (k <= 0 || k >= 1) return;
      const T = P(target);
      const C = { x: (S.x + T.x) / 2 + 60, y: S.y + 30 };
      const at = (u) => ({ x: (1 - u) * (1 - u) * S.x + 2 * (1 - u) * u * C.x + u * u * T.x, y: (1 - u) * (1 - u) * S.y + 2 * (1 - u) * u * C.y + u * u * T.y });
      c.setLineDash([3, 6]); c.lineDashOffset = -time * 0.04;
      c.strokeStyle = `rgba(242, 154, 75, ${0.55 * Math.sin(k * Math.PI)})`;
      c.beginPath(); c.moveTo(S.x, S.y); c.quadraticCurveTo(C.x, C.y, T.x, T.y); c.stroke(); c.setLineDash([]);
      for (let i = 0; i < 9; i++) {
        const u = ((time * 0.0006 + i / 9) % 1) * ease(k * 1.4 > 1 ? 1 : k * 1.4);
        const pt = at(u);
        c.fillStyle = `rgba(255, 200, 140, ${0.85 * Math.sin(k * Math.PI)})`;
        c.beginPath(); c.arc(pt.x, pt.y, 1.6, 0, Math.PI * 2); c.fill();
      }
      const head = at(ease(k));
      const g = c.createRadialGradient(head.x, head.y, 0, head.x, head.y, 22);
      g.addColorStop(0, 'rgba(255, 200, 140, .9)'); g.addColorStop(1, 'rgba(242, 154, 75, 0)');
      c.fillStyle = g; c.fillRect(head.x - 22, head.y - 22, 44, 44);
    };
    beam(byId.upload, jstate.beam1);
    beam(byId.retry, jstate.beam2);
    // The search ripple.
    if (jstate.ripple > 0 && jstate.ripple < 1) {
      const O = P(byId.upload);
      const R = ease(jstate.ripple) * Math.max(jw, jh) * 0.75;
      for (let i = 0; i < 3; i++) {
        const rr = R - i * 26;
        if (rr <= 0) continue;
        c.strokeStyle = `rgba(242, 154, 75, ${(1 - jstate.ripple) * (0.5 - i * 0.14)})`;
        c.lineWidth = 1.5 - i * 0.4;
        c.beginPath(); c.arc(O.x, O.y, rr, 0, Math.PI * 2); c.stroke();
      }
    }
    // Warm glow under the files that were read.
    for (const id of ['upload', 'retry']) {
      const n = byId[id];
      if (!n.el.classList.contains('is-read') && !n.el.classList.contains('is-hit')) continue;
      const Pn = P(n);
      const g = c.createRadialGradient(Pn.x, Pn.y, 0, Pn.x, Pn.y, 70);
      g.addColorStop(0, `rgba(242, 154, 75, ${0.18 * fade})`); g.addColorStop(1, 'rgba(242, 154, 75, 0)');
      c.fillStyle = g; c.fillRect(Pn.x - 70, Pn.y - 70, 140, 140);
    }
    // The ember flies from the test result to "Checks passed".
    if (jstate.fly > 0 && jstate.fly < 1) {
      const a = J.result.getBoundingClientRect(), b = J.check.getBoundingClientRect();
      const A = { x: a.left - stageR.left + 40, y: a.top - stageR.top }, B = { x: b.left - stageR.left + 6, y: b.top - stageR.top + b.height / 2 };
      const u = easeIO(jstate.fly);
      const x = lerp(A.x, B.x, u), y = lerp(A.y, B.y, u) - Math.sin(u * Math.PI) * 120;
      const g = c.createRadialGradient(x, y, 0, x, y, 26);
      g.addColorStop(0, 'rgba(255, 244, 220, 1)'); g.addColorStop(0.3, 'rgba(255, 194, 122, .8)'); g.addColorStop(1, 'rgba(242, 154, 75, 0)');
      c.fillStyle = g; c.fillRect(x - 26, y - 26, 52, 52);
    }
  }

  /* ── The morph (pinned, scrubbed) ──────────────────────────────────── */
  const M = { section: $('#faces'), card: $('[data-morph]'), rows: $$('.mo-row'), rowsBox: $('[data-mo-rows]'), act: $('[data-mo-activity]'), metas: $$('.mo-meta'),
    ldev: $('[data-mo-ldev]'), lsimple: $('[data-mo-lsimple]'), metrics: $('[data-mo-metrics]'), done: $('[data-mo-done]'), knob: $('[data-mo-knob]'), lDev: $('[data-mo-dev]'), lSimple: $('[data-mo-simple]') };
  const actText = M.act.textContent.trim().replace(/\s*›$/, '');
  // Spaces stay ordinary so the sentence can wrap on a narrow screen.
  M.act.innerHTML = [...actText].map((ch) => (ch === ' ' ? ' ' : `<span class="c">${ch}</span>`)).join('') + ' <span class="c">›</span>';
  const actChars = $$('.c', M.act);
  const simpleItems = [...M.lsimple.children];
  function renderMorph(p) {
    const q = seg(p, 0.1, 0.86);
    const e = easeIO(seg(q, 0.35, 0.65));
    M.lDev.style.transform = `translateY(${-100 * e}%)`; M.lDev.style.opacity = 1 - e;
    M.lSimple.style.transform = `translateY(${100 * (1 - e)}%)`; M.lSimple.style.opacity = e;
    M.knob.style.transform = `translateX(${(18 * easeIO(q)).toFixed(1)}px)`;
    const m = ease(seg(q, 0, 0.25));
    for (const meta of M.metas) { meta.style.transform = `translateX(${m * 60}px)`; meta.style.opacity = 1 - m; meta.style.filter = m > 0.02 ? `blur(${(m * 5).toFixed(1)}px)` : ''; }
    M.rows.forEach((row, i) => {
      const r = easeIO(seg(q, 0.14 + i * 0.06, 0.44 + i * 0.06));
      row.style.transform = `translateY(${(-31 * i * r).toFixed(1)}px) scaleY(${(1 - 0.55 * r).toFixed(3)})`;
      row.style.opacity = i === 0 ? 1 - seg(q, 0.44, 0.58) : 1 - r;
    });
    M.rowsBox.style.height = `${lerp(124, M.act.offsetHeight + 8, easeIO(seg(q, 0.2, 0.6)))}px`;
    const shown = Math.round(seg(q, 0.5, 0.74) * actChars.length);
    actChars.forEach((c, i) => { c.style.opacity = i < shown ? 1 : 0; });
    const l = seg(q, 0.55, 0.7);
    M.ldev.style.opacity = 1 - l; M.ldev.style.transform = `translateY(${-8 * l}px)`;
    simpleItems.forEach((it, i) => { const s = ease(seg(q, 0.66 + i * 0.06, 0.8 + i * 0.06)); it.style.opacity = s; it.style.transform = `translateY(${(1 - s) * 10}px) scale(${0.9 + 0.1 * s})`; });
    M.metrics.style.opacity = 1 - seg(q, 0.8, 0.9);
    M.done.style.opacity = seg(q, 0.86, 0.96);
  }

  /* ── Odometer for the total ────────────────────────────────────────── */
  const total = $('[data-count-to]');
  if (total) {
    const from = total.dataset.countFrom ?? total.textContent.trim(), to = total.dataset.countTo;
    total.textContent = '';
    total.setAttribute('aria-label', to);
    [...to].forEach((ch, i) => {
      if (!/\d/.test(ch)) { total.insertAdjacentHTML('beforeend', `<span>${ch}</span>`); return; }
      const start = Number(from[i] ?? 0);
      const col = document.createElement('span');
      col.className = 'odo';
      col.innerHTML = `<span class="odo-col">${Array.from({ length: 30 }, (_, k) => `<span>${k % 10}</span>`).join('')}</span>`;
      total.append(col);
      const inner = $('.odo-col', col);
      inner.style.transform = `translateY(${-start}em)`;
      inner.dataset.target = String(20 + Number(ch));
      inner.style.transitionDelay = `${i * 0.12}s`;
    });
    const watch = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      watch.disconnect();
      for (const col of $$('.odo-col', total)) col.style.transform = `translateY(${-Number(col.dataset.target)}em)`;
      setTimeout(() => { const r = total.getBoundingClientRect(); burst(r.right - 10, r.top + r.height * 0.4, 40, 1.4); }, reduced ? 0 : 2500);
    }, { threshold: 0.6 });
    watch.observe(total);
  }

  /* ── The frame loop ────────────────────────────────────────────────── */
  const visible = new Set();
  const seen = new IntersectionObserver((entries) => { for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target); }, { rootMargin: '200px 0px' });
  for (const el of [J.section, M.section, $('.foot'), $('[data-marquee]'), $('#hero')]) if (el) seen.observe(el);
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const time = (now - T0) / 1000;
    velocity *= 0.92;
    pointer.sx += (pointer.x - pointer.sx) * 0.08; pointer.sy += (pointer.y - pointer.sy) * 0.08;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    glow(pointer.sx, pointer.sy, 320, finePointer ? 0.045 : 0);

    // The hearth: light breathes with the flame; sparks leave the tip with the wind.
    const g = heroGeom();
    if (g.visible) {
      const t = now - T0;
      if (!reduced) heroIgnite = ease(seg(t, 2200, 3600));
      const target = finePointer && pointer.seen ? clamp((pointer.sx - g.cx) / 500, -1, 1) * 0.55 : Math.sin(time * 0.4) * 0.15;
      wind += (target + clamp(velocity * 0.01, -0.3, 0.3) - wind) * 0.05;
      heroFlame?.draw(time, heroIgnite, wind);
      const breathe = 0.2 + Math.sin(time * 1.1) * 0.025 + Math.sin(time * 4.3) * 0.015;
      glow(g.cx, g.mid, 200 + g.w, breathe * heroIgnite);
      if (!reduced && heroIgnite > 0.5 && Math.random() < 0.35 * heroIgnite) {
        sparks.push({ x: g.cx + (Math.random() - 0.5) * 10 + wind * 20, y: g.tip + 10, vx: wind * 0.9 + (Math.random() - 0.5) * 0.5, vy: -0.8 - Math.random() * 1.3, life: 1, decay: 0.008 + Math.random() * 0.01, r: 0.6 + Math.random() * 1.1, g: -0.004 });
      }
      liftChars();
    }
    drawIntro(now);

    // Footer hearth lights when you reach it.
    if (visible.has($('.foot')) && footFlame) {
      if (!footSeen) footSeen = true;
      if (!reduced) footIgnite = Math.min(1, footIgnite + dt * 0.7);
      footFlame.draw(time + 7, footIgnite, Math.sin(time * 0.5) * 0.2);
    }

    // Ambient embers drift up the page; scrolling pushes them.
    for (const e of embers) {
      e.y += e.vy - velocity * 0.05; e.x += Math.sin(time * 0.8 + e.ph) * 0.25;
      if (e.y < -10 || e.y > innerHeight + 20) Object.assign(e, newEmber(false), velocity < -2 ? { y: -5, vy: Math.abs(e.vy) * 0.3 } : {});
      ctx.fillStyle = `rgba(255, 186, 120, ${e.a * (0.7 + 0.3 * Math.sin(time * 2 + e.ph))})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    }
    // A faint trail when the cursor moves fast.
    if (!reduced && finePointer && pointer.speed > 18) {
      sparks.push({ x: pointer.x, y: pointer.y, vx: (Math.random() - 0.5) * 0.6, vy: -0.3 - Math.random() * 0.4, life: 0.7, decay: 0.03, r: 0.7, g: -0.01 });
      pointer.speed *= 0.5;
    }
    // Sparks.
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.vx *= 0.985; s.vy = s.vy * 0.985 + s.g; s.x += s.vx; s.y += s.vy; s.life -= s.decay;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(255, ${170 + 70 * s.life | 0}, ${100 + 120 * s.life | 0}, ${s.life})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (0.5 + s.life), 0, Math.PI * 2); ctx.fill();
    }
    if (sparks.length > 500) sparks.splice(0, sparks.length - 500);
    ctx.globalCompositeOperation = 'source-over';

    // Pinned scenes.
    if (visible.has(J.section)) { renderJourney(sectionProgress(J.section)); drawJourney(now - T0); }
    if (visible.has(M.section)) renderMorph(sectionProgress(M.section));
    if (visible.has($('[data-marquee]'))) moveMarquee(dt);

    requestAnimationFrame(frame);
  }
  renderJourney(0); renderMorph(0);
  if (reduced) { heroFlame?.draw(1, 1, 0); }
  requestAnimationFrame(frame);
})();
