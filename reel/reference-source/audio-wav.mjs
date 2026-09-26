// Render the soundtrack in Node (same code as the browser) → audio.wav
import fs from 'node:fs'
import vm from 'node:vm'
vm.runInThisContext(fs.readFileSync(new URL('./timeline.js', import.meta.url), 'utf8'))
vm.runInThisContext(fs.readFileSync(new URL('./audio.js', import.meta.url), 'utf8'))
const t0 = Date.now()
const { L, R, sr } = globalThis.renderAudio(44100)
const n = L.length, buf = Buffer.alloc(44 + n * 4)
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12)
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(sr, 24)
buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40)
for (let i = 0; i < n; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4)
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4)
}
fs.writeFileSync(new URL('./audio.wav', import.meta.url), buf)
console.log('audio.wav', (n / sr).toFixed(1) + 's', 'in', Date.now() - t0, 'ms')
