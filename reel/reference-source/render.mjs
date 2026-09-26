// Render the doodle to MP4: headless Chromium draws each frame, ffmpeg encodes,
// and the soundtrack comes from the same audio.js (see audio-wav.mjs).
import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const DIR = path.dirname(new URL(import.meta.url).pathname)
const only = process.argv.includes('--stills')
execFileSync('node', [path.join(DIR, 'audio-wav.mjs')], { stdio: 'inherit' })
const types = { '.html': 'text/html', '.js': 'text/javascript' }
const srv = http.createServer((q, r) => { const f = path.join(DIR, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end() } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(b) }) }).listen(0)
const port = srv.address().port
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
await p.goto(`http://127.0.0.1:${port}/`)
await p.evaluate(() => window.__ready)
const FPS = 30, DUR = 60, N = FPS * DUR
if (only) {
  fs.mkdirSync(path.join(DIR, 'stills'), { recursive: true })
  const at = process.argv.slice(process.argv.indexOf('--stills') + 1).map(Number)
  for (const s of at) { const d = await p.evaluate((f) => window.__frame(f), Math.round(s * FPS)); fs.writeFileSync(path.join(DIR, 'stills', `t${String(s).padStart(5, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64')) }
} else {
  const out = path.join(DIR, 'rasmus-schlunsen-reel.mp4')
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', path.join(DIR, 'audio.wav'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] })
  const t0 = Date.now()
  for (let f = 0; f < N; f++) {
    const d = await p.evaluate((i) => window.__frame(i), f)
    if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise((r) => ff.stdin.once('drain', r))
    if (f % 150 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
  ff.stdin.end()
  await new Promise((r) => ff.on('close', r))
  console.log('wrote', out)
}
await b.close(); srv.close()
