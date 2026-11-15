# Play it back — violin practice app

A single-file web app (`index.html`) for hands-free music practice, mainly violin.
Hosted on GitHub Pages from the `main` branch. Changes should be committed to `main`
(or merged quickly) so the live page updates.

## What it does
- **Loop:** listens, records when sound starts, stops after silence, plays the take back, listens again.
- **Transcription:** each take becomes sheet music (abcjs, loaded from jsDelivr, pinned version).
  YIN pitch detection on a downsampled signal; notes split only on clear re-articulation
  (bowed notes swell and fade); short blips and octave/octave+fifth errors are absorbed.
- **Rhythm:** auto tempo, manual tempo, "first note is a ♪/♩/♩./𝅗𝅥" mode, or the metronome grid.
- **Metronome:** pulsing ring + beat dots; optionally a click (headphones only, or the mic hears it)
  or vibration (Android). With it on, takes snap to bars and playback starts on the next downbeat.
- **Target mode:** player types notes (`G3 A B C4 D E F# G`); takes are aligned to the target
  (edit-distance alignment, octave-free if no octave typed) and coloured green / amber (out of tune) /
  red (wrong, played note shown) / grey (missed). Saved exercises in localStorage.
- **Extras:** tuning reference A=438–445, half-speed playback (WSOLA time-stretch, pitch kept),
  "Hear it" synth of the target, pitch curve view, live tuner, tempo ladder (speeds up after N clean
  takes), progress per exercise by day, drone (tonic + fifth), share take (WAV + PNG via Web Share API).
- **Playback & feedback:** the note being played is highlighted, with a length bar (written vs held).
  Written feedback under the sheet (sharp/flat notes, too long/short notes, wrong/missed notes).
  Settings → Feedback switches: written feedback, intonation, rhythm, highlight while playing.
- **Set as target:** turns a take's transcription (notes as written, octaves only where needed) into
  target notes, via the target panel so it can be edited or saved as an exercise.
- **Pedal:** optional (Settings → Pedal). Bluetooth page turners act as keyboards: right pedal
  (→ ↓ PageDown Space Enter) = the big button, left pedal (← ↑ PageUp) = play the take again.

## Installable app (PWA)
`manifest.webmanifest`, `sw.js` and `icons/` make it installable from GitHub Pages (all paths relative,
so it works under `/Violin-practice-/`). The service worker fetches the page network-first (updates
show up straight away, cached copy offline) and caches the pinned CDN files (abcjs, fonts) on first
use. Bump `CACHE` in `sw.js` only if the list of shell files changes. Icons are rendered from
`icons/icon.svg` (maskable variant keeps the glyph in the safe zone).

## Intonation
Notes are judged against equal temperament or Pythagorean (Settings > Judge against, `refCents`).
The tuner always takes the open strings G D A E in pure fifths from A (A=440: E 660, D 293.3,
G 195.6 Hz), whatever the setting; other notes follow the setting. The drone uses the same
pure-fifth chain, so it agrees with the open strings. Tuner 'In tune' = within 3 cents.

## Layout
Phones: one column, all settings behind the settings button. At 1100px and wider: two columns; the
Listening, Pitch and Feedback setting groups (`.sgrp[data-dock]`) are moved into the main window
under the big button (`placeSettings()`), Tempo and Controls stay in the menu.

## Important details
- **iPhone:** while the mic is open, iOS routes audio to the earpiece. The app closes the mic before
  playback and reopens it afterwards (`micOff` / `micOn`, `navigator.audioSession`). Keep this.
- Everything runs on the device. Recordings are never uploaded. Settings, saved exercises and
  progress live in localStorage; the last 10 takes (16-bit audio + metadata) live in IndexedDB (`pib` / `takes`)
  and are restored, and their notes re-detected, when the page opens.
- The player is a violinist. Test changes against real violin behaviour: bow swells, vibrato,
  scratchy attacks, held first notes.
- UI is deliberately minimal: big state button, icons, little explanatory text.
  Supports light and dark mode via CSS variables.

## Testing
A useful end-to-end test: Playwright + Chromium with
`--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<recording.wav>`
feeds a recording in as the microphone. A G major one-octave scale at about 59 bpm should
transcribe as `G A B C | D E F♯ G` in G major (quarter notes), with E and F♯ slightly sharp at A=440
and in tune at A=442.

## Problem reports
Under each take, **Report** opens a box listing the notes the app heard (numbered); the player says
what was wrong and **Export** saves one `pib-debug-take<N>-<date>.json`: the take's audio (16-bit WAV,
base64), the notes heard (times, cents, written vs held length), the ABC shown, target alignment,
settings and the player's description. Reports are usually dropped in `debug/`.
`node tools/replay.mjs <report.json> [--wav out.wav] [--A 442]` runs the current `index.html` note
detection on it and prints then-vs-now, so a fix can be checked against the report.
`node tools/check.mjs` is the regression check for note detection: synthesized takes (scales, weak-
fundamental open strings, octave leaps, out-of-tune notes, a note hovering between two semitones)
with the expected notes. Run it after any change to `detectNotes`, and add a case for each fix.

## Practice tools
- **Instruments** (Settings > Pitch): violin, viola (alto clef, C G D A), cello (bass/tenor clef, C G D A).
  Tuner strings, drone octave and the generator's lowest note follow it.
- **Target notes syntax:** `G3 A B C4` (octave optional: nearest to the previous note). A length in beats
  can follow, carried over until it changes: `G3:1 A B D:2`, `A:1/2`, rests `r:1`. Without lengths a
  target is pitch only. Rhythm is judged against the metronome tempo (if the take used it) or the
  best-fitting tempo: held vs written length (+/-25%) and early/late (>= 1/4 beat), see `targetRhythm`.
- **Generator** (notes panel): scales (major, three minors), arpeggios, broken thirds, 1-3 octaves,
  spelled from the key (`makeScale`), written compactly with `compactTarget`.
- **Exercise links:** `?t=<notes>&n=<name>` loads and saves an exercise. **Play by ear:** a hidden random
  phrase in the generator's key, revealed after a take.
- **Practice panel** (chart icon): practice time per day (`pib-time`), streak, and per-note intonation
  tendencies over 2 weeks (`pib-tend`, raw cents, judged when shown).
- **Pitch view:** vibrato rate/width/evenness and bow steadiness (`soundOf`), and Compare with another take.
- **Metronome** (Settings > Tempo): visual only, click (scheduled on the audio clock; needs headphones so
  the mic doesn't hear it) or vibrate (Android).
- **Automatic sensitivity** (Settings > Listening, on by default): while listening, the quiet 20% of the
  last ~6 s is the room's noise; the trigger goes 12 dB above it. The first ~0.5 s only measures.
- **Interval intonation:** `intervalsOf` measures steps between connected notes against equal temperament
  and Pythagorean (spelling-aware). Feedback reports systematic patterns ('Half steps 27 cents narrow');
  the practice panel tracks interval sizes over 2 weeks.
- **Notes detail** (Settings > Pitch > Notes; `detectNotes(..., detail)`, `quantize(..., detail)`):
  Clean (default) absorbs notes shorter than 40% of a typical note in the take (0.1-0.2 s: slides,
  scratchy starts), uses sixteenths only when most of the passage is that fast, merges semitone wobbles
  more readily; Normal = the earlier behaviour; Detailed keeps every note from 70 ms. The last note always
  lasts at least to the next beat (not Detailed). Changing it re-reads the shown take.
- **Zen mode** (Settings > Feedback): body.zen hides the sheet, feedback, routine bar and toasts; takes
  are still analysed (practice time, tendencies) so switching back shows everything.
- **Routine** (notes panel): exercises in order, each with its own tempo (`pib-routine`); a bar above the
  sheet steps through them; the position and any tempo change (ladder or +/-) are remembered per exercise.

## Ideas discussed but not built
- A teacher version (assign exercises, see students' progress and takes); would need accounts and a server.
  (Exercise links are the light version without a server.)
