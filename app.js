'use strict';
// Hearth showcase. Plain JavaScript, no build step. Every demo here is a scripted recreation of real Hearth behaviour.

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isSimple = () => document.documentElement.dataset.mode === 'simple';
/** Markup for words that differ between the two versions of the page. */
const both = (simple, dev) => `<span class="m-simple">${simple}</span><span class="m-dev">${dev}</span>`;

/* ── 1. Two versions of the page ─────────────────────────────────────────── */
const MODE_KEY = 'hearth-site.mode';
function setMode(mode) {
  document.documentElement.dataset.mode = mode;
  for (const button of $$('[data-set-mode]')) {
    const on = button.dataset.setMode === mode;
    button.setAttribute('aria-checked', String(on));
    button.tabIndex = on ? 0 : -1;
  }
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* storage can be unavailable */ }
}
const toggleMode = () => setMode(isSimple() ? 'developer' : 'simple');
try {
  const saved = localStorage.getItem(MODE_KEY);
  setMode(saved === 'simple' || saved === 'developer' ? saved : 'developer');
} catch { setMode('developer'); }
for (const button of $$('[data-set-mode]')) button.addEventListener('click', () => setMode(button.dataset.setMode));
for (const button of $$('[data-toggle-mode]')) button.addEventListener('click', toggleMode);
$('.mode').addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  toggleMode();
  $(`[data-set-mode="${document.documentElement.dataset.mode}"]`).focus();
});

/* ── 2. The page's own spine ─────────────────────────────────────────────── */
const chapters = $$('main section[data-chapter]');
const spine = $('.spine');
spine.innerHTML = `<span class="spine-count">${chapters.length} chapters</span><span class="spine-line"></span><span class="spine-progress"></span><span class="spine-dot"></span>`
  + chapters.map((c) => `<a href="#${c.id}"><i></i><span>${c.dataset.chapter}</span></a>`).join('');
const spineLinks = $$('a', spine);
function placeSpine() {
  const span = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  chapters.forEach((c, i) => { spineLinks[i].style.top = `${Math.min(100, (c.offsetTop / span) * 100)}%`; });
}
function followSpine() {
  const span = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const share = Math.min(1, Math.max(0, scrollY / span));
  $('.spine-progress', spine).style.height = `${share * 100}%`;
  $('.spine-dot', spine).style.top = `${share * 100}%`;
  let current = 0;
  chapters.forEach((c, i) => { if (c.offsetTop <= scrollY + innerHeight * 0.4) current = i; });
  spineLinks.forEach((a, i) => a.classList.toggle('is-current', i === current));
}
addEventListener('scroll', followSpine, { passive: true });
addEventListener('resize', () => { placeSpine(); followSpine(); });
addEventListener('load', () => { placeSpine(); followSpine(); });
placeSpine(); followSpine();

/* ── 4. Reveal on scroll ─────────────────────────────────────────────────── */
const revealer = new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-in'); revealer.unobserve(entry.target); entry.target.dispatchEvent(new Event('revealed')); }
}, { threshold: 0.18 });
for (const el of $$('.reveal')) revealer.observe(el);

/* ── 5. The demo: one request, start to finish ───────────────────────────── */
const DEMO = {
  request: 'Uploads over 10 MB fail with a 413. Find why and fix the retry loop.',
  steps: [
    { glyph: 'read', verb: 'Read', detail: 'src/upload.ts', meta: 'lines 1–120', dev: '1.4k in · 0.9s', doing: 'Reading src/upload.ts' },
    { glyph: 'search', verb: 'Searched', detail: '"413" in src', meta: '2 files', dev: '2.1k in · 96% cached', doing: 'Searching for “413”' },
    { glyph: 'edit', verb: 'Edited', detail: 'src/upload.ts', meta: '<em class="add">+12</em> <em class="del">−3</em>', dev: '2.6k in · 97% cached', doing: 'Changing src/upload.ts' },
    { glyph: 'run', verb: 'Ran', detail: 'bun test upload', meta: '2.1s', dev: '3.0k in · 98% cached', doing: 'Running the tests' },
  ],
  answer: 'The retry loop retried every failure, including the 413 the server sends when a chunk is too large, so big uploads looped until they timed out. Uploads now go in 5 MB chunks, a 413 halves the chunk once before giving up, and only network errors are retried, with backoff. The upload tests pass.',
};
const demo = {
  thread: $('[data-demo-thread]'), status: $('[data-demo-status]'), composer: $('[data-demo-composer]'),
  meta: $('[data-demo-meta]'), scroll: $('#demo .page-scroll'),
};
let demoRun = 0, demoClock = 0;
const ARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V11a9 9 0 0 1 18 0v10h-4V11a5 5 0 0 0-10 0v10Z"/></svg>';

async function playDemo() {
  const id = ++demoRun;
  clearInterval(demoClock);
  const wait = async (ms) => { await sleep(reduced ? 0 : ms); if (id !== demoRun) throw new Error('replaced'); };
  const follow = () => { demo.scroll.scrollTop = demo.scroll.scrollHeight; };
  try {
    demo.thread.innerHTML = '';
    demo.status.innerHTML = '';
    demo.meta.textContent = 'Started 2:14 AM · 0 requests';
    demo.composer.innerHTML = '<span class="ph">Message Hearth</span>';
    await wait(500);

    // Typing the request.
    demo.composer.innerHTML = '<span data-typed></span><span class="cursor"></span>';
    const typed = $('[data-typed]', demo.composer);
    for (const ch of DEMO.request) { typed.textContent += ch; await wait(16 + Math.random() * 22); }
    await wait(450);

    // Sent: the request lifts into the page; the turn starts its clock.
    demo.composer.innerHTML = '<span class="ph">Steer this task</span>';
    demo.thread.insertAdjacentHTML('beforeend', `<div class="slip">${DEMO.request}</div>`);
    demo.meta.textContent = 'Started 2:14 AM · 1 request';
    const started = Date.now();
    const tick = () => { demo.status.innerHTML = `<i></i><span data-label>Working</span><span class="t">· ${Math.round((Date.now() - started) / 1000)}s</span>`; };
    tick(); demoClock = setInterval(tick, 1000);

    const reply = document.createElement('div');
    reply.className = 'reply';
    reply.innerHTML = `<span class="reply-mark">${ARCH}</span><div class="thought">Thinking…</div><p class="activity m-simple" data-activity></p><div class="tools m-dev" data-tools></div>`;
    demo.thread.append(reply);
    follow();
    await wait(1300);
    $('.thought', reply).textContent = 'Thought for 4s';

    // Steps, each running then done.
    const tools = $('[data-tools]', reply), activity = $('[data-activity]', reply);
    for (const step of DEMO.steps) {
      const row = document.createElement('div');
      row.className = 'tool is-running';
      row.innerHTML = `<i class="g g-${step.glyph}"></i><b>${step.verb}</b><code>${step.detail}</code><span class="meta"><span class="step m-dev"></span><span data-m></span></span><span class="mark"></span>`;
      tools.append(row);
      activity.innerHTML = `${step.doing}…`;
      follow();
      await wait(step.glyph === 'run' ? 1500 : 850);
      row.classList.remove('is-running');
      $('[data-m]', row).innerHTML = step.meta;
      $('.step', row).textContent = step.dev;
      $('.mark', row).textContent = '✓';
    }
    activity.innerHTML = 'Looked at 2 files, changed 1 and ran 1 command <span>›</span>';

    // The answer streams in, word by word.
    const answer = document.createElement('p');
    answer.className = 'answer';
    answer.innerHTML = '<span data-words></span><span class="caret"></span>';
    reply.append(answer);
    const words = $('[data-words]', answer);
    for (const word of DEMO.answer.split(' ')) { words.textContent += (words.textContent ? ' ' : '') + word; follow(); await wait(34 + Math.random() * 30); }
    $('.caret', answer).remove();

    // The ledger closes the reply.
    clearInterval(demoClock);
    demo.status.innerHTML = '';
    reply.insertAdjacentHTML('beforeend', `
      <div class="ledger-live m-dev"><span class="strong">Changed 1 file <em class="add">+12</em> <em class="del">−3</em></span><span>Ran 1 command</span><span class="okt">Checks passed</span></div>
      <p class="metrics-live m-dev">qwen3.8-flash · first token 0.6s · 41 tok/s · 3.0k in · 214 out · 8.2s</p>
      <div class="ledger-live m-simple"><span class="strong">Changed 1 file</span><button type="button" class="chip">Review changes</button><button type="button" class="chip">Undo</button></div>
      <p class="done-live m-simple">Done · your turn</p>`);
    demo.meta.textContent = 'Started 2:14 AM · 1 request · 1 file changed';
    demo.composer.innerHTML = '<span class="ph">Message Hearth</span>';
    await wait(60);
    follow();
  } catch (error) {
    if (error.message !== 'replaced') throw error;
  }
}
const demoWatcher = new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) { demoWatcher.disconnect(); playDemo(); }
}, { threshold: 0.45 });
demoWatcher.observe($('#demo'));
$('[data-demo-play]').addEventListener('click', playDemo);

/* ── 7. Replay ───────────────────────────────────────────────────────────── */
(function replay() {
  const FILES = ['src/upload.ts', 'src/retry.ts', 'src/chunk.ts', 'src/api.ts', 'src/config.ts', 'test/upload.test.ts', 'package.json', 'README.md'];
  const STEPS = [
    { say: both('You asked: “Uploads over 10 MB fail with a 413.”', 'Request 1 · “Uploads over 10 MB fail with a 413…”'), read: [], edit: [] },
    { say: both('It read the upload code.', 'Read src/upload.ts · lines 1–120'), read: ['src/upload.ts'], edit: [] },
    { say: both('It searched for “413” and found it in two files.', 'Searched "413" in src · 2 files'), read: ['src/retry.ts'], edit: [] },
    { say: both('It read the retry helper.', 'Read src/retry.ts · lines 1–60'), read: ['src/retry.ts'], edit: [] },
    { say: both('It read the test to see what is expected.', 'Read test/upload.test.ts · lines 1–88'), read: ['test/upload.test.ts'], edit: [] },
    { say: both('It changed the upload code.', 'Edited src/upload.ts · +12 −3'), read: [], edit: ['src/upload.ts'] },
    { say: both('It ran the upload tests. They passed.', 'Ran bun test upload · 14 pass · 2.1s'), read: [], edit: [] },
    { say: both('It explained what was wrong. One file changed.', 'Answer · Changed 1 file +12 −3 · checks passed'), read: [], edit: [] },
  ];
  const map = $('[data-filemap]'), range = $('[data-replay-range]'), caption = $('[data-replay-caption]'), play = $('[data-replay-play]');
  map.innerHTML = FILES.map((f) => { const [dir, name] = f.includes('/') ? [f.slice(0, f.lastIndexOf('/') + 1), f.slice(f.lastIndexOf('/') + 1)] : ['', f]; return `<div class="file" data-file="${f}"><small>${dir || '&nbsp;'}</small>${name}</div>`; }).join('');
  const show = (i) => {
    const read = new Set(), edit = new Set();
    STEPS.slice(0, i + 1).forEach((s) => { s.read.forEach((f) => read.add(f)); s.edit.forEach((f) => edit.add(f)); });
    const now = new Set([...STEPS[i].read, ...STEPS[i].edit]);
    for (const tile of $$('.file', map)) {
      const f = tile.dataset.file;
      tile.classList.toggle('is-edit', edit.has(f));
      tile.classList.toggle('is-read', read.has(f) && !edit.has(f));
      tile.classList.toggle('is-now', now.has(f));
    }
    caption.innerHTML = `<span class="dim">Step ${i + 1} of ${STEPS.length} · </span>${STEPS[i].say}`;
    range.value = String(i);
  };
  let timer = 0;
  const stop = () => { clearInterval(timer); timer = 0; play.textContent = '▶'; play.setAttribute('aria-label', 'Play the replay'); };
  play.addEventListener('click', () => {
    if (timer) return stop();
    if (Number(range.value) >= STEPS.length - 1) show(0);
    play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pause the replay');
    timer = setInterval(() => { const next = Number(range.value) + 1; if (next >= STEPS.length) return stop(); show(next); }, 950);
  });
  range.addEventListener('input', () => { stop(); show(Number(range.value)); });
  show(0);
  $('#replay').addEventListener('revealed', () => { if (!reduced) play.click(); }, { once: true });
})();

/* ── 8. Cache ribbon ─────────────────────────────────────────────────────── */
(function ribbon() {
  const box = $('[data-ribbon]'), caption = $('[data-cache-caption]');
  const STEPS = [
    { k: 1.4, c: 0, why: 'first request' }, { k: 2.1, c: 0.96 }, { k: 2.6, c: 0.97 }, { k: 3.0, c: 0.98 }, { k: 3.6, c: 0.97 },
    { k: 4.1, c: 0.98 }, { k: 4.9, c: 0.98 }, { k: 5.4, c: 0.98 }, { k: 2.2, c: 0.18, why: 'compaction' }, { k: 2.8, c: 0.95 },
    { k: 3.3, c: 0.97 }, { k: 3.9, c: 0.98 },
  ];
  const max = Math.max(...STEPS.map((s) => s.k));
  const WHY = {
    'first request': both('the first request has nothing to reuse yet.', 'first request — nothing cached yet.'),
    compaction: both('the chat was summarised to save memory, so the model read the summary fresh.', 'compaction rewrote the history, so the prefix changed.'),
  };
  box.innerHTML = STEPS.map((s, i) => `<button type="button" class="bar${s.why ? ' is-break' : ''}" ${s.why ? `data-break="${s.why}"` : ''} data-i="${i}" aria-label="Step ${i + 1}: ${s.k}k tokens, ${Math.round(s.c * 100)}% reused"><span class="cached" style="height:${s.c * 100}%"></span><span class="fresh" style="height:${(1 - s.c) * 100}%"></span></button>`).join('');
  box.parentElement.classList.add('ribbon-wrap');
  const describe = (i) => {
    const s = STEPS[i];
    const lead = `<span class="dim">Step ${i + 1} · </span>${s.k.toFixed(1)}k tokens · <b>${Math.round(s.c * 100)}% reused</b>`;
    caption.innerHTML = s.why ? `${lead}<br><span style="color:var(--ember-hi)">Cache broke: ${WHY[s.why]}</span>` : `${lead}<br><span class="dim">${both('Fast: it only read what was new.', 'Prefix reused; only the new tail was processed.')}</span>`;
  };
  for (const bar of $$('.bar', box)) {
    bar.addEventListener('pointerenter', () => describe(Number(bar.dataset.i)));
    bar.addEventListener('focus', () => describe(Number(bar.dataset.i)));
  }
  $('#cache').addEventListener('revealed', () => {
    $$('.bar', box).forEach((bar, i) => setTimeout(() => { bar.style.height = `${(STEPS[i].k / max) * 100}%`; }, reduced ? 0 : i * 70));
    setTimeout(() => describe(8), reduced ? 0 : 1600);
    box.classList.add('is-in');
  }, { once: true });
})();

/* ── 9. Blind-edit lens ──────────────────────────────────────────────────── */
(function lens() {
  const button = $('[data-lens-toggle]'), lensBox = $('[data-lens]');
  const scan = () => { lensBox.classList.remove('scanning'); void lensBox.offsetWidth; lensBox.classList.add('scanning'); };
  $('#lens').addEventListener('revealed', () => setTimeout(scan, 400), { once: true });
  button.addEventListener('click', () => {
    scan();
    const on = !lensBox.classList.contains('show');
    lensBox.classList.toggle('show', on);
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? 'Hide what it read' : 'Show what it read';
  });
})();

/* ── 10. Try in a copy first ─────────────────────────────────────────────── */
(function tryInCopy() {
  const log = $('[data-copy-log]'), tryButton = $('[data-copy-try]'), allow = $('[data-copy-allow]'), deny = $('[data-copy-deny]');
  const stage = $('[data-copy-stage]');
  const stageTo = () => { const box = $('.cs-box', stage).getBoundingClientRect(), from = $('.cs-project', stage).getBoundingClientRect(); stage.style.setProperty('--to', `${box.left - from.left + 18}px`); };
  const setStage = (...names) => { stage.classList.remove('is-cloning', 'is-sealed', 'is-running', 'is-done'); stage.classList.add(...names); };
  let busy = false;
  const add = (html, cls = '') => { log.insertAdjacentHTML('beforeend', `<li class="${cls}">${html}</li>`); };
  tryButton.addEventListener('click', async () => {
    if (busy) return;
    busy = true; tryButton.disabled = true; log.innerHTML = '';
    stageTo(); setStage('is-cloning');
    add(`<span class="k">⧉</span><span>${both('Made an instant copy of your project', 'Cloned the project in 0.2 s — copy-on-write, 1,284 files')}</span>`);
    await sleep(reduced ? 0 : 1100);
    setStage('is-cloning', 'is-sealed');
    add(`<span class="k">◇</span><span>${both('Sealed it off: no internet, no other apps', 'Sandbox verified: no network · no other apps · writes stay in the clone')}</span>`);
    await sleep(reduced ? 0 : 1300);
    setStage('is-cloning', 'is-sealed', 'is-running');
    add(`<span class="k">›</span><span>${both('Ran the command in the copy (3.4 s)', 'Ran <code>npx eslint src --fix</code> in 3.4 s · exit 0')}</span>`);
    await sleep(reduced ? 0 : 1400);
    setStage('is-cloning', 'is-sealed', 'is-done');
    const box = $('.cs-box', stage).getBoundingClientRect();
    window.FX?.burst(box.left + 40, box.bottom - 16, 18, 0.7);
    add(`<span class="k">=</span><span><b>Would change 3 files.</b> ${both('Nothing else was touched; the copy is gone.', 'Nothing outside the clone changed; it was deleted.')}<span class="mini-diff">src/upload.ts   <em class="add">+2</em> <em class="del">−2</em><br>src/retry.ts    <em class="add">+1</em> <em class="del">−1</em><br>src/api.ts      <em class="add">+3</em> <em class="del">−3</em></span></span>`, 'result');
    busy = false;
  });
  const decide = (allowed) => {
    log.querySelector('.decision')?.remove();
    add(`<span class="k">${allowed ? '✓' : '×'}</span><span class="verdict ${allowed ? '' : 'no'}">${allowed ? both('Allowed — it ran on your project.', 'Allowed — ran for real; the edits are snapshotted and revertible.') : both('Denied — nothing ran on your project.', 'Denied — the model is told and continues without it.')}</span>`, 'decision');
    tryButton.disabled = false;
  };
  allow.addEventListener('click', () => decide(true));
  deny.addEventListener('click', () => decide(false));
})();

/* ── 11. Chat blame ──────────────────────────────────────────────────────── */
(function blame() {
  const REQUESTS = {
    2: { title: 'Uploads over 10 MB fail with a 413', said: 'Big uploads now go in 5 MB chunks, and a 413 halves the chunk once before giving up.' },
    3: { title: 'Only retry network errors', said: 'Retries now stop on errors the server will keep returning, and wait longer each time.' },
  };
  const k = (s) => `<span class="kw">${s}</span>`, s = (t) => `<span class="s">${t}</span>`, n = (t) => `<span class="n">${t}</span>`;
  const LINES = [
    [`${k('import')} { sleep, backoff } ${k('from')} ${s("'./time'")};`, 0],
    ['', 0],
    [`${k('export const')} MB = ${n('1024')} * ${n('1024')};`, 0],
    [`${k('export const')} DEFAULT_CHUNK = ${n('5')} * MB;`, 2],
    ['', 0],
    [`${k('export async function')} upload(file: Blob, opts: Options = {}) {`, 0],
    [`  ${k('let')} chunk = opts.chunk ?? DEFAULT_CHUNK;`, 2],
    [`  ${k('for')} (${k('let')} i = ${n('0')}; i &lt; MAX_TRIES; i++) {`, 0],
    [`    ${k('const')} res = ${k('await')} send(file, chunk);`, 0],
    [`    ${k('if')} (res.status === ${n('413')} &amp;&amp; chunk &gt; MB) { chunk /= ${n('2')}; ${k('continue')}; }`, 2],
    [`    ${k('if')} (res.ok || !retryable(res)) ${k('return')} res;`, 3],
    [`    ${k('await')} sleep(backoff(i));`, 3],
    ['  }', 0],
    ['}', 0],
  ];
  const box = $('[data-blame-lines]'), caption = $('[data-blame-caption]'), reply = $('[data-blame-reply]');
  box.innerHTML = LINES.map(([code, req], i) => {
    const first = req && LINES[i - 1]?.[1] !== req;
    return `<div class="eline" data-req="${req}" data-line="${i + 1}"><span class="no">${i + 1}</span><span class="gut">${req ? `<i style="--n:${i}" class="${first ? 'first' : ''}" title="Written by request ${req} in this chat. Click to open that reply."></i>` : ''}</span><span class="code">${code || ' '}</span></div>`;
  }).join('');
  const light = (req) => { for (const line of $$('.eline', box)) line.classList.toggle('is-lit', !!req && line.dataset.req === String(req)); };
  for (const line of $$('.eline', box)) {
    const req = Number(line.dataset.req);
    if (!req) continue;
    line.addEventListener('pointerenter', () => { caption.innerHTML = `<span class="dim">Line ${line.dataset.line} · </span>written by <b>request ${req}</b> — “${REQUESTS[req].title}”`; light(req); });
    line.addEventListener('pointerleave', () => light(Number(reply.dataset.req) || 0));
    line.addEventListener('click', () => {
      reply.hidden = false; reply.dataset.req = String(req);
      reply.innerHTML = `<b>Request ${req}</b> · ${REQUESTS[req].title}<p>${REQUESTS[req].said}</p>`;
      reply.style.animation = 'none'; void reply.offsetWidth; reply.style.animation = '';
      light(req);
    });
  }
})();

/* ── 12. The Desk ────────────────────────────────────────────────────────── */
(function desk() {
  const root = $('[data-desk]');
  const lists = { needs: $('[data-group="needs"] ul', root), working: $('[data-group="working"] ul', root), changed: $('[data-group="changed"] ul', root) };
  let spare = [
    { title: 'Bump dependencies', note: 'Needs approval: bun update', action: 'Approve', files: 2, add: 18, del: 18 },
    { title: 'Tidy the README', note: 'Needs approval: edit README.md', action: 'Approve', files: 1, add: 9, del: 4 },
  ];
  const count = () => { for (const [key, ul] of Object.entries(lists)) $('em', ul.parentElement).textContent = ul.children.length ? ul.children.length : ''; };
  function row(item, group) {
    const li = document.createElement('li');
    li.className = 'desk-row';
    if (group === 'needs') li.innerHTML = `<b><span class="sq${item.failed ? ' red' : ''}"></span>${item.title}</b><small>${item.note}</small><button type="button" class="chip">${item.action}</button>`;
    if (group === 'working') li.innerHTML = `<b><span class="live"></span>${item.title}</b><small data-t>Working · 0s</small>`;
    if (group === 'changed') li.innerHTML = `<b>${item.title}</b><small>${item.files} file${item.files === 1 ? '' : 's'} changed · <em class="add">+${item.add}</em> <em class="del">−${item.del}</em></small><button type="button" class="chip">Review</button>`;
    lists[group].prepend(li);
    count();
    if (group === 'needs') $('button', li).addEventListener('click', () => { const at = li.getBoundingClientRect(); li.remove(); work(item, 3, at); refill(); });
    if (group === 'changed') $('button', li).addEventListener('click', (e) => { e.target.textContent = 'Reviewed'; e.target.disabled = true; setTimeout(() => { li.style.opacity = '.45'; }, 300); });
    return li;
  }
  /** The new row starts where the old one was and glides into its place. */
  const flyFrom = (li, from) => {
    if (reduced || !from) return;
    const to = li.getBoundingClientRect();
    li.style.transition = 'none';
    li.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px)`;
    li.style.animation = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => { li.style.transition = 'transform .7s cubic-bezier(.2,.7,.2,1)'; li.style.transform = ''; }));
  };
  async function work(item, seconds = 3, from) {
    const li = row(item, 'working');
    flyFrom(li, from);
    for (let t = 1; t <= seconds; t++) { await sleep(1000); $('[data-t]', li).textContent = `Working · ${t}s`; }
    const at = li.getBoundingClientRect();
    li.remove();
    const done = row(item, 'changed');
    flyFrom(done, at);
    window.FX?.burst(done.getBoundingClientRect().right - 40, done.getBoundingClientRect().top + 20, 14, 0.6);
  }
  function refill() {
    if (lists.needs.children.length || !spare.length) return;
    const next = spare.shift();
    setTimeout(() => row(next, 'needs'), 4500);
  }
  row({ title: 'Fix flaky upload test', note: 'Stopped: the model server went away', action: 'Retry', failed: true, files: 1, add: 6, del: 2 }, 'needs');
  row({ title: 'Rename config keys', note: 'Needs approval: mv config/*.json config/legacy/', action: 'Approve', files: 3, add: 24, del: 24 }, 'needs');
  row({ title: 'Refactor auth middleware', files: 4, add: 86, del: 41 }, 'changed');
  root.addEventListener('revealed', () => work({ title: 'Docs pass for the API', files: 3, add: 40, del: 12 }, 6), { once: true });
})();

/* On a touch screen the keys become cards to tap. */
if (matchMedia('(pointer: coarse)').matches) {
  const sub = $('[data-keys-sub]');
  if (sub) sub.textContent = 'Tap a card to see it light up. On a Mac, every one of these is a key.';
  const note = $('.hero-note');
  if (note) note.firstChild.textContent = 'This page has two versions, like the app. ';
}

/* ── 13. Keys ────────────────────────────────────────────────────────────── */
(function keys() {
  const press = (key) => {
    const card = $(`.key[data-key="${CSS.escape(key)}"]`);
    if (!card) return;
    card.classList.remove('is-pressed'); void card.offsetWidth; card.classList.add('is-pressed');
    const r = card.getBoundingClientRect();
    window.FX?.burst(r.left + 40, r.top + 28, 22, 0.9);
    clearTimeout(card._t); card._t = setTimeout(() => card.classList.remove('is-pressed'), 900);
  };
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
    let hit = null;
    if (mod && e.shiftKey && key === 'm') hit = 'M';
    else if (mod && e.shiftKey && key === 'h') hit = 'H';
    else if (mod && !e.shiftKey && key === 'k') hit = 'k';
    else if (mod && key === '/') hit = '/';
    else if (mod && key === '.') hit = '.';
    else if (mod && !e.shiftKey && key === 'f') hit = 'f';
    else if (e.key === 'Escape') hit = '.';
    if (!hit) return;
    if (hit !== 'f' && e.key !== 'Escape') e.preventDefault(); // the browser keeps its own find and Escape
    press(hit);
    if (hit === 'M') toggleMode();
    if (hit === 'H') $('#desk').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  });
  for (const card of $$('.key')) card.addEventListener('click', () => { press(card.dataset.key); if (card.dataset.key === 'M') toggleMode(); });
})();

/* ── 14. Numbers ─────────────────────────────────────────────────────────── */
(function numbers() {
  const ROWS = [
    ['Capability', '40 fixed features', 5.5, 10],
    ['Reliability', '11 failure scenarios + tests', 9.45, 10],
    ['Usability', 'accessibility, keyboard, feedback', 7.05, 9.57],
    ['Speed', 'startup, typing, streaming', 9.35, 9.36],
    ['Design', 'checks + blind judges', 7.97, 8.79],
  ];
  const box = $('[data-scores]');
  box.innerHTML = ROWS.map(([name, note, before, after]) => `<div class="score"><span class="name">${name}<small>${note}</small></span><span class="track"><span class="before" data-w="${before * 10}"></span><span class="after" data-w="${after * 10}"></span></span><span class="vals">${before} → <b>${after}</b></span></div>`).join('');
  box.addEventListener('revealed', () => { for (const bar of $$('[data-w]', box)) bar.style.width = `${bar.dataset.w}%`; }, { once: true });
  box.addEventListener('revealed', () => {
    setTimeout(() => { for (const head of $$('.after', box)) { const r = head.getBoundingClientRect(); window.FX?.burst(r.right, r.top + 1, 12, 0.6); } }, reduced ? 0 : 1650);
  }, { once: true });
})();
