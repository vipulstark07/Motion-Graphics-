// Captures 4g.sukiyodesigns.com for the film: desktop and mobile scroll sequences with the hero
// video layer made transparent (the film composites the live footage underneath), hero layers at 2x,
// and layout metrics. Requests go through curl so TLS is verified against the environment's CA bundle.
//   node films/sukiyo/tools/capture.mjs   then convert capture/seq/*.png to assets/*.webp (see README in commit)
import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
// Fetch every request with curl (verifies TLS against the proxy CA bundle) and hand it to the page.
async function viaCurl(route) {
  const req = route.request();
  if (!/^https?:/.test(req.url())) return route.continue();
  try {
    const { stdout } = await run('curl', ['-sS', '-L', '--max-time', '60', '-D', '-', '-o', '-', req.url()], { encoding: 'buffer', maxBuffer: 1 << 28 });
    let buf = stdout, headers = {}, status = 200;
    // strip one or more header blocks (redirects)
    while (buf.slice(0, 5).toString() === 'HTTP/') {
      const end = buf.indexOf('\r\n\r\n');
      const lines = buf.slice(0, end).toString().split('\r\n');
      status = Number(lines[0].split(' ')[1]); headers = {};
      for (const l of lines.slice(1)) { const i = l.indexOf(':'); if (i > 0) headers[l.slice(0, i).toLowerCase()] = l.slice(i + 1).trim(); }
      buf = buf.slice(end + 4);
    }
    delete headers['content-encoding']; delete headers['content-length']; delete headers['transfer-encoding'];
    await route.fulfill({ status, headers, body: buf });
  } catch (e) { console.error('curl failed', req.url().slice(0, 100), String(e).slice(0, 120)); await route.abort(); }
}
const b = await chromium.launch();

const SEQ = new URL('../capture/seq', import.meta.url).pathname;
import { mkdirSync as mk, writeFileSync as wf } from 'node:fs';
const CLEAR = `video{opacity:0!important} html,body{background:transparent!important}
  main, main > section:first-of-type, main > div { background-color: transparent !important; }`;
async function open(vp, dpr) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: dpr });
  await p.route('**/*', viaCurl);
  await p.goto('https://4g.sukiyodesigns.com/', { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(2500);
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 600) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(100); }
  await go(p, 0);
  // make the paper wrapper (parent of the fixed <main>) transparent too
  await p.evaluate(() => { const m = document.querySelector('main'); if (m?.parentElement) m.parentElement.style.background = 'transparent'; });
  return p;
}
async function go(p, y) {
  await p.evaluate((y) => window.scrollTo(0, y), y);
  let last = '';
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(60);
    const tf = await p.evaluate(() => getComputedStyle(document.querySelector('main')).transform + '|' + scrollY);
    if (tf === last) break; last = tf;
  }
  await p.waitForTimeout(250);
}
async function seq(p, name, from, to, step, clear) {
  mk(`${SEQ}/${name}`, { recursive: true });
  if (clear) await p.addStyleTag({ content: CLEAR });
  const ys = [];
  for (let y = from, i = 0; y <= to; y += step, i++) {
    await go(p, y);
    const real = await p.evaluate(() => { const m = getComputedStyle(document.querySelector('main')).transform; const ty = m === 'none' ? 0 : -Number(m.split(',')[5].replace(')', '')); return ty || scrollY; });
    ys.push(Math.round(real * 100) / 100);
    await p.screenshot({ path: `${SEQ}/${name}/${String(i).padStart(3, '0')}.png`, omitBackground: !!clear });
  }
  wf(`${SEQ}/${name}/scroll.json`, JSON.stringify(ys));
  console.log(name, ys.length, 'frames', ys[0], '->', ys[ys.length - 1]);
}

// ---- desktop
let p = await open({ width: 1440, height: 900 }, 1);
const D = await p.evaluate(() => {
  const sec = (txt) => [...document.querySelectorAll('section')].find((s) => s.innerText.includes(txt));
  const top = (el) => el.getBoundingClientRect().top + scrollY;
  const h1 = document.querySelector('h1');
  const lines = [...h1.querySelectorAll('*')].filter((e) => e.children.length === 0).map((e) => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return { text: e.innerText, x: r.left, y: r.top, w: r.width, h: r.height, font: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight, style: cs.fontStyle, ls: cs.letterSpacing, lh: cs.lineHeight, color: cs.color };
  });
  const cs = getComputedStyle(h1);
  return { services: top(sec('Every trade')), philosophy: top(sec('expediency')), work: top(sec('Built to last')), h1: { html: h1.innerHTML.slice(0, 400), font: cs.fontFamily, size: cs.fontSize, lh: cs.lineHeight, ls: cs.letterSpacing, color: cs.color, rect: h1.getBoundingClientRect().toJSON() }, lines };
});
console.log(JSON.stringify(D, null, 1));
wf(`${SEQ}/desktop-layout.json`, JSON.stringify(D, null, 2));
await go(p, D.philosophy - 60);
await p.screenshot({ path: `${SEQ}/desktop-philosophy.png` });
await go(p, D.work + 40);
await p.screenshot({ path: `${SEQ}/desktop-work.png` });
await go(p, 0);
// hero at 2x, transparent, with and without the headline
await p.close();
p = await open({ width: 1440, height: 900 }, 2);
await p.addStyleTag({ content: CLEAR });
await p.screenshot({ path: `${SEQ}/desktop-hero-2x.png`, omitBackground: true });
await p.addStyleTag({ content: 'h1{visibility:hidden!important}' });
await p.screenshot({ path: `${SEQ}/desktop-hero-2x-nohead.png`, omitBackground: true });
await p.close();
p = await open({ width: 1440, height: 900 }, 1);
await seq(p, 'desktop', 0, Math.round(D.services - 120), 24, true);
await p.close();

// ---- mobile
p = await open({ width: 390, height: 844 }, 2);
const M = await p.evaluate(() => {
  const sec = (txt) => [...document.querySelectorAll('section')].find((s) => s.innerText.includes(txt));
  const top = (el) => el.getBoundingClientRect().top + scrollY;
  return { philosophy: top(sec('expediency')), jobsite: top(sec('job site')), services: top(sec('Every trade')) };
});
console.log('mobile', JSON.stringify(M));
wf(`${SEQ}/mobile-layout.json`, JSON.stringify(M, null, 2));
await p.addStyleTag({ content: CLEAR });
await p.screenshot({ path: `${SEQ}/mobile-hero.png`, omitBackground: true });
await seq(p, 'mobile', Math.round(M.jobsite - 200), Math.round(M.philosophy + 40), 30, true);
await b.close();
