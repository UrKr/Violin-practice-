// Replay a "Report" file (pib-debug-*.json) through the app's own note detection.
//
//   node tools/replay.mjs path/to/pib-debug-take3-20261115-1612.json [--wav out.wav] [--A 442]
//
// Prints what the take was reported with (the player's description, the notes the app heard
// then) next to what the current index.html hears now, so a fix can be checked against it.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
if (!file) { console.error('usage: node tools/replay.mjs <report.json> [--wav out.wav] [--A 442]'); process.exit(1); }

const rep = JSON.parse(readFileSync(file, 'utf8'));
if (rep.format !== 'play-it-back-debug') { console.error('not a Play it back report'); process.exit(1); }

// the app's top-level functions (detectNotes, quantize, toAbc, alignTarget, ...) live before the main IIFE
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const lib = script.slice(0, script.indexOf('(() => {'));
const ctx = vm.createContext({ Math, Float32Array, Array, JSON, console });
vm.runInContext(lib + '\n;globalThis.__app={detectNotes,guessTempo,guessKey,quantize,toAbc,alignTarget,noteName,parseTarget};', ctx);
const app = ctx.__app;

// decode the 16-bit mono WAV
const wav = Buffer.from(rep.audio.base64, 'base64');
if (opt('wav')) { writeFileSync(opt('wav'), wav); console.log('wrote', opt('wav')); }
const sr = wav.readUInt32LE(24);
let off = 12; while (wav.toString('ascii', off, off + 4) !== 'data') off += 8 + wav.readUInt32LE(off + 4);
const n = wav.readUInt32LE(off + 4) / 2, data = new Float32Array(n);
for (let i = 0; i < n; i++) data[i] = wav.readInt16LE(off + 8 + i * 2) / 32768;

const A4 = +(opt('A') || rep.take.A4 || 440);
console.log(`Take #${rep.take.id}: ${(n / sr).toFixed(2)} s at ${sr} Hz, A=${A4}, exported ${rep.exported}`);
console.log(`Page ${rep.page} (modified ${rep.pageModified})`);
console.log(`Device: ${rep.userAgent}`);
if (rep.take.metro) console.log(`Metronome: ${rep.take.metro.bpm} bpm, ${rep.take.metro.bpb}/4`);
if (rep.take.target) console.log(`Target: ${rep.take.target.str}`);
console.log(`\nReported problem: ${rep.report || '(no description)'}\n`);

const fmt = ns => ns.map(x => `${x.n}:${x.name}${Math.abs(x.cents) >= 20 ? (x.cents > 0 ? '↑' : '↓') : ''}`).join(' ');
console.log('Heard then: ', fmt(rep.heard));
const notes = app.detectNotes(data, sr, A4), key = app.guessKey(notes);
const now = notes.map((x, i) => ({ n: i + 1, name: app.noteName(x.midi, key), cents: x.cents }));
console.log('Heard now:  ', fmt(now), rep.heard.length === now.length && rep.heard.every((h, i) => h.name === now[i].name) ? '(same)' : '(DIFFERENT)');
console.log('\n n  note    start   end     cents');
notes.forEach((x, i) => console.log(String(i + 1).padStart(2), app.noteName(x.midi, key).padEnd(6), x.t0.toFixed(3).padStart(7), x.t1.toFixed(3).padStart(7), String(x.cents).padStart(6)));
if (rep.take.target) {
  const r = app.alignTarget(rep.take.target.notes, notes, rep.take.target.hasOct);
  console.log('\nAgainst target:', r.items.map(it => app.noteName(it.midi, key) + ':' + it.status).join(' '), r.extra ? `(+${r.extra} extra)` : '');
}
console.log(`\nTempo guess ${app.guessTempo(notes)} bpm, key ${key ? key.name : '?'}`);
if (rep.shown && rep.shown.abc) console.log('\nSheet shown then (ABC):\n' + rep.shown.abc);
