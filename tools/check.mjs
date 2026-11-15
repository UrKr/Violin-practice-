// Regression check for note detection: synthesizes test takes and checks what index.html hears.
//   node tools/check.mjs
// The signals mimic the cases that went wrong before: open-string tones with a weak fundamental
// (phantom octave), real octave leaps that must stay, uneven rhythm, out-of-tune notes, a sung-like
// wobble around a semitone boundary. Add a case whenever detection is fixed.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const ctx = vm.createContext({ Math, Float32Array, Array, JSON, console });
vm.runInContext(script.slice(0, script.indexOf('(() => {')) + ';globalThis.A={detectNotes,guessKey,noteName};', ctx);
const { detectNotes, guessKey, noteName } = ctx.A;

const SR = 48000, WEAK = [0.25, 1, 0.7, 0.5, 0.45, 0.3, 0.25, 0.2], NORM = [1, 0.6, 0.45, 0.35, 0.3, 0.2, 0.15, 0.1];
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
// notes: [midi, beats, cents, wobble(cents, slow drift)]
function take(notes, { amps = NORM, bpm = 60, noise = 0.02, vib = 0.004 } = {}) {
  const beat = 60 / bpm, out = [];
  for (let i = 0; i < SR * 0.35; i++) out.push(0);   // like a real take: ~0.35 s of silence each end
  for (const [m, bl, c = 0, wob = 0] of notes) {
    const d = bl * beat, n = Math.round(d * SR); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, cents = c + wob * Math.sin(2 * Math.PI * 1.3 * t);
      const f = 440 * 2 ** ((m - 69 + cents / 100) / 12) * (1 + vib * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t / 0.3));
      ph += 2 * Math.PI * f / SR;
      const env = Math.min(1, t / 0.06) * (0.75 + 0.25 * Math.sin(Math.PI * t / d)) * Math.min(1, (d - t) / 0.05);
      let x = 0; amps.forEach((a, k) => { x += a * Math.sin((k + 1) * ph + k); });
      out.push(x * 0.18 * env + gauss() * noise * env);
    }
  }
  for (let i = 0; i < SR * 0.4; i++) out.push(0);
  return Float32Array.from(out);
}
const G = [55, 57, 59, 60, 62, 64, 66, 67];
const cases = [
  ['G major scale', take(G.map(m => [m, 1])), 'G3 A3 B3 C4 D4 E4 F♯4 G4'],
  ['uneven rhythm', take(G.map((m, i) => [m, [1, 1, 1, 1, 1.4, 0.65, 0.95, 2][i]])), 'G3 A3 B3 C4 D4 E4 F♯4 G4'],
  ['open G, weak fundamental', take([[55, 2], [57, 1], [59, 1], [55, 2]], { amps: WEAK }), 'G3 A3 B3 G3'],
  ['octave leaps', take([[55, 1], [67, 1], [62, 1], [74, 1], [67, 1], [79, 1], [55, 2]]), 'G3 G4 D4 D5 G4 G5 G3'],
  ['octave leaps, weak fundamental', take([[55, 1], [67, 1], [62, 1], [74, 1], [67, 1], [79, 1], [55, 2]], { amps: WEAK }), 'G3 G4 D4 D5 G4 G5 G3'],
  ['arpeggio to G5', take([[55, 1], [59, 1], [62, 1], [67, 1], [71, 1], [74, 1], [79, 2]], { amps: WEAK, noise: 0.04 }), 'G3 B3 D4 G4 B4 D5 G5'],
  ['out of tune B and F#', take(G.map(m => [m, 1, m === 59 ? -28 : m === 66 ? 30 : 0])), 'G3 A3 B3 C4 D4 E4 F♯4 G4'],
  ['note hovering between D# and E', take([[60, 1], [62, 1], [64, 1.5, -45, 18], [65, 1], [67, 1]], { vib: 0.002 }), 'C4 D4 E4 F4 G4'],
  // slides / scratchy starts: a 100 ms slip a whole step below each note. Clean ignores them, Detailed shows them.
  ['slips into notes (clean)', take(G.flatMap(m => [[m - 2, 0.1], [m, 0.9]])), 'G3 A3 B3 C4 D4 E4 F♯4 G4', 0],
  // (in Detailed a slip that equals the previous note just continues it; the others show: A#3, F4)
  ['slips into notes (detailed)', take(G.flatMap(m => [[m - 2, 0.1], [m, 0.9]])), 'G3 A3 B3 A♯3 C4 D4 E4 F♯4 F4 G4', 2],
  // real fast notes are not slips: sixteenths at 100 bpm stay in Clean
  ['fast sixteenths kept (clean)', take([...G, 69, ...G.slice().reverse()].map(m => [m, 0.25]), { bpm: 100 }), 'G3 A3 B3 C4 D4 E4 F♯4 G4 A4 G4 F♯4 E4 D4 C4 B3 A3 G3', 0],
];
let bad = 0;
for (const [name, x, want, detail = 0] of cases) {
  const notes = detectNotes(x, SR, 440, detail), key = guessKey(notes);
  const got = notes.map(n => noteName(n.midi, key)).join(' ');
  const ok = got === want; if (!ok) bad++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name.padEnd(34) + got + (ok ? '' : '   (expected ' + want + ')'));
}
console.log(bad ? `\n${bad} of ${cases.length} failed` : `\nall ${cases.length} passed`);
process.exit(bad ? 1 : 0);
