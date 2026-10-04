#!/usr/bin/env node
// node beats.mjs films/<name>  -> measures the beat grid of track.* (or the synthesized score) into beats.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { audioSource, rawAudio } from './lib/audio.mjs';
import { measureBeats } from './lib/beats.mjs';

const dir = resolve(process.argv[2] ?? '.');
const film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8'));
const src = audioSource(dir);
if (!src) { console.error('no track.* or score.mjs in', dir); process.exit(1); }
const grid = measureBeats(await rawAudio(dir, film), film.duration);
writeFileSync(join(dir, 'beats.json'), JSON.stringify({ source: relative(dir, src.path), measured: true, ...grid }, null, 2) + '\n');
console.log(`${grid.bpm} BPM, ${grid.beats.length} beats, first at ${grid.offset}s -> ${relative(process.cwd(), join(dir, 'beats.json'))}`);
