// Audio for a film: a supplied track wins, otherwise score.mjs is synthesized.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeWav } from './wav.mjs';

export const TARGET_LUFS = -14;
const TRACK = /^track\.(wav|mp3|m4a|aac|flac|ogg)$/i;

export function audioSource(dir) {
  const track = readdirSync(dir).find((f) => TRACK.test(f));
  if (track) return { kind: 'track', path: join(dir, track) };
  if (existsSync(join(dir, 'score.mjs'))) return { kind: 'score', path: join(dir, 'score.mjs') };
  return null;
}

// Returns the path of the raw (un-normalized) audio, synthesizing it if needed.
export async function rawAudio(dir, film) {
  const src = audioSource(dir);
  if (!src) return null;
  if (src.kind === 'track') return src.path;
  const out = join(dir, 'out', 'score.wav');
  if (existsSync(out) && statSync(out).mtimeMs > statSync(src.path).mtimeMs) return out;
  mkdirSync(join(dir, 'out'), { recursive: true });
  const sampleRate = 48000;
  const { default: score } = await import(`${pathToFileURL(src.path).href}?v=${statSync(src.path).mtimeMs}`);
  writeWav(out, score({ duration: film.duration, sampleRate }), sampleRate);
  return out;
}

function ff(args) {
  try {
    return execFileSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`ffmpeg failed: ${e.stderr || e.message}`);
  }
}

function ffStderr(args) {
  const r = execFileSync('sh', ['-c', 'ffmpeg -hide_banner -nostats "$@" 2>&1', 'ff', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  return r;
}

export function measureLufs(path) {
  const log = ffStderr(['-i', path, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = log.slice(log.lastIndexOf('Summary:'));
  return {
    lufs: Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]),
    truePeak: Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]),
  };
}

// Two-pass EBU R128 normalization to TARGET_LUFS, true peak <= -1 dBTP.
export function normalize(input, output, duration) {
  const base = `loudnorm=I=${TARGET_LUFS}:TP=-1:LRA=11`;
  const log = ffStderr(['-i', input, '-t', String(duration), '-af', `${base}:print_format=json`, '-f', 'null', '-']);
  const m = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
  const second = `${base}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
    `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  ff(['-y', '-v', 'error', '-i', input, '-t', String(duration), '-af', second, '-ar', '48000', '-c:a', 'pcm_s24le', output]);
  return measureLufs(output);
}
