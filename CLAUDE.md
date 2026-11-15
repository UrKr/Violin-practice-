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
- **Visual metronome:** pulsing ring + beat dots (no sound, because the mic would hear clicks).
  With it on, takes snap to bars and playback starts on the next downbeat.
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

## Ideas discussed but not built
- Note lengths in target mode, with rhythm judged against the metronome.
- A teacher version (assign exercises, see students' progress and takes); would need accounts and a server.
- Viola and cello support (C string range).
