import { writeFileSync } from 'node:fs';

// Writes 32-bit float PCM so nothing clips before loudness normalization.
export function writeWav(path, channels, sampleRate) {
  const n = channels[0].length, ch = channels.length, bytes = n * ch * 4;
  const buf = Buffer.alloc(44 + bytes);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + bytes, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20);
  buf.writeUInt16LE(ch, 22); buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * ch * 4, 28); buf.writeUInt16LE(ch * 4, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(bytes, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++, o += 4) buf.writeFloatLE(channels[c][i], o);
  writeFileSync(path, buf);
}
