// 要素を、その大きさぴったりで PNG にする（ヘッドレス Chrome を DevTools プロトコルで操作）。
//   使い方: node shot.mjs jobs.json
//   jobs.json: [{ "url": "file:///...", "out": "/path/x.png", "selector": "#w", "width": 792, "scale": 2 }, ...]
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const profile = mkdtempSync(join(tmpdir(), 'shot-'));
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  chrome.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); });
  setTimeout(() => rej(new Error('chrome did not start')), 20000);
});
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const waiters = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  else if (m.method) for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });
const once = method => new Promise(res => waiters.push({ method, res }));

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable');
for (const j of jobs) {
  await S('Emulation.setDeviceMetricsOverride', { width: j.width || 792, height: 900, deviceScaleFactor: j.scale || 2, mobile: false });
  const loaded = once('Page.loadEventFired');
  await S('Page.navigate', { url: j.url });
  await loaded;
  const { result } = await S('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression:
    `(async()=>{ await Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))); const r=document.querySelector(${JSON.stringify(j.selector || 'body')}).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()` });
  const clip = { ...result.value, scale: 1 };
  const { data } = await S('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
  writeFileSync(j.out, Buffer.from(data, 'base64'));
  console.log('shot', j.out.split('/').pop(), Math.round(clip.width) + 'x' + Math.round(clip.height));
}
ws.close(); chrome.kill();
await new Promise(r => chrome.on('exit', r));
try { rmSync(profile, { recursive: true, force: true }); } catch {}
