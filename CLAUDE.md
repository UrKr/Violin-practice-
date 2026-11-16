# Play it back — violin practice app

A single-file web app (`index.html`) for hands-free music practice, mainly violin.
Hosted on GitHub Pages from the `main` branch. Changes should be committed to `main`
(or merged quickly) so the live page updates.

## What it does
- **Loop:** listens, records when sound starts, stops after silence, plays the take back, listens again.
  With target notes that have rests, a written rest doesn't end the take: `silenceLimit()` waits out the
  longest rest still ahead plus a beat (metronome tempo, or that target's last tempo) until the last note
  has started (live tracking). A leading rest needs nothing: takes start at the first sound, rhythm is
  judged relative, and with the metronome the first note lands where it was played in the bar ('Hear it'
  skips a leading rest).
- **Transcription:** each take becomes sheet music (abcjs, loaded from jsDelivr, pinned version).
  YIN pitch detection on a downsampled signal; notes split only on clear re-articulation
  (bowed notes swell and fade); short blips and octave/octave+fifth errors are absorbed.
- **Rhythm:** auto tempo, manual tempo, "first note is a ♪/♩/♩./𝅗𝅥" mode, or the metronome grid.
- **Metronome:** pulsing ring + beat dots; optionally a click (headphones only, or the mic hears it)
  or vibration (Android). With it on, takes snap to bars and playback starts on the next downbeat.
- **Target mode:** player types notes in LilyPond notation (`g4 a b c d e fis g`); takes are aligned to the target
  (edit-distance alignment, octave-free if no octave typed) and coloured green / amber (out of tune) /
  red (wrong, played note shown) / grey (missed). Saved exercises in localStorage.
- **Extras:** tuning reference A=438–445, half-speed playback (WSOLA time-stretch, pitch kept),
  "Hear it" synth of the target, pitch curve view, live tuner, tempo ladder (speeds up after N clean
  takes), progress per exercise by day, drone (tonic + fifth), share take (WAV + PNG via Web Share API).
- **Playback & feedback:** the note being played is highlighted, with a length bar (written vs held).
  Written feedback under the sheet (sharp/flat notes, too long/short notes, wrong/missed notes).
  Settings → Feedback switches: written feedback, intonation, rhythm, highlight while playing.
- **Set as target:** turns a take's transcription (notes as written, with its time and key signature)
  into target notes, via the target panel so it can be edited or saved as an exercise.
- **MusicXML:** import a score (notes panel > Piece) and export a take's transcription or the target
  (MusicXML button) to open in MuseScore etc.
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

## First run and settings
A quick guide (`showGuide`, 5 steps lighting up the big button, focus row, notes panel, practice panel,
settings) shows once on the first visit (`pib-guide`) and from Settings > Quick guide. Rarely changed
settings rows carry `.adv` and only show with 'Show all settings' (body.allset, `pib-allset`): sensitivity,
speed-up ladder, manual tempo, notes detail, drone note, clef, the single feedback switches, pedal.
Browser tests start fresh, so they set `pib-guide` (and `pib-allset` to reach hidden settings) first.

## Layout
Phones: one column, all settings behind the settings button. Settings run from the most to the least
often changed: Feedback, Tempo, Listening, Pitch, Controls (and within a group the hidden rows last).
At 1100px and wider: two columns; the Feedback, Listening and Pitch setting groups (`.sgrp[data-dock]`)
are moved into the main window under the big button (`placeSettings()`), Tempo and Controls stay in the menu.

## Important details
- **iPhone:** while the mic is open, iOS routes audio to the earpiece. The app closes the mic before
  playback and reopens it afterwards (`micOff` / `micOn`, `navigator.audioSession`). Keep this.
  Exception: Settings > Listening > 'Stop when I play' keeps the mic open during playback to
  hear the player (`makeBarge`: mic pitch vs the playback buffer 0-0.3 s back, octaves equal, or 9 dB over
  the echo level measured in the first 0.8 s; ~0.25 s in a row). On by default except on iPhone, where it
  needs headphones. Offline: the speaker echo alone (also reverberant, full volume) never triggers it;
  starting to play is caught in ~0.3 s.
- Everything runs on the device. Recordings are never uploaded. Settings, saved exercises and
  progress live in localStorage; the last 10 takes (16-bit audio + metadata) live in IndexedDB (`pib` / `takes`)
  and are restored, and their notes re-detected, when the page opens.
- The player is a violinist. Test changes against real violin behaviour: bow swells, vibrato,
  scratchy attacks, held first notes.
- UI is deliberately minimal and compact: big state button, icons, little explanatory text. Explanations
  live in tooltips (`title`); on phones the MusicXML / Share / Report buttons show only their icon
  (`.share.ic .lbl`); messages (`toast`) float at the bottom instead of pushing the page down.
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
`node tools/audit.mjs [--abc]` is the wider audit: 20 realistic violin scenarios (re-bowed repeated notes,
détaché, staccato, soft notes, wide vibrato, shifts, scratchy attacks, E6-E7, cello range, dotted
rhythm, triplets, trill, rests between phrases, grace notes, a double stop a fifth apart).
An open string left ringing (or ringing in sympathy) under a higher note makes the mix repeat at a lower
period (G4 over a ringing G3 reads G3; D4 over it reads G2). Two fixes: `detectNotes(..., low)` gets the
instrument's lowest open string less a whole step (`lowNote()`); a note below it goes up an octave (or an
octave and a fifth, whichever period the sound repeats at better) when most of the sound repeats there
(a sung low note doesn't, and stays). And the melody decides: a note, or a run of up to 3 moving by step,
that jumps 9+ semitones away from the notes on both sides the same way, while an octave back it would be
within a fourth of them, moves an octave (single notes first). Not when it has the same note name as a
neighbour (a real octave leap), and the sound must not disagree (up: it repeats at the higher period;
down: it doesn't repeat cleanly at its own period but does at twice it); with 2+ other big leaps in the
take (octave studies, broken chords) the sound has to agree clearly. Real sixths across strings stay. Limitation: a G3 as loud as
-6 dB under a G4 between notes a fifth away (D4 G4 D4) can't be told from a real G3. Test signals keep only ~0.35 s of silence at each end, like
real takes: offline signals with long silences hid a noise-floor bug once. Also check the real reports
(`tools/replay.mjs`) - a real violin's strong harmonics and room echo behave differently from synthesis.

## Practice tools
- **Instruments** (Settings > Pitch): violin, viola (alto clef, C G D A), cello (bass/tenor clef, C G D A).
  Tuner strings, drone octave and the generator's lowest note follow it.
- **Target notes: LilyPond notation** (`parseLy`, written by `writeLy` / `compactTarget`):
  `\relative { \time 3/4 \key d \major r2 a'4 | d e8 fis g4 | a2.~ | a4 r b }`. Dutch names (fis, bes,
  es, as; f# and bb also read), ' and , octaves, \relative / \fixed / absolute, lengths 1-128 with dots
  carried over, r/R/s rests, ~ ties (joined into one note), \tuplet / \times, <chords> (top note),
  | bar checks (a bar that doesn't add up is a warning, not an error), \time (sets the metronome's beats
  per bar), \key (major keys C G D A E F Bb Eb Ab and their minors), \partial; slurs, articulations,
  dynamics, fingerings, clef, tempo, header blocks ignored; `<<` and `\\` (several voices) not supported.
  Bar checks without \time set the meter (a short first bar = pickup). Plain notes without braces or
  \relative are relative from f' (first note in octave 4) and leave the octave free when judging
  (`hasOct`); without any lengths a target is pitch only. The app always writes `\relative { ... }`
  with bar checks when it knows the meter. Triplets are judged exactly but drawn rounded to sixteenths.
  The first notation (`G3:1 A B C4`, `parseOldTarget`) is still read: stored exercises, routine,
  settings, piece, progress and issue keys are converted once at start (`migrateTargets`), old links
  and restored takes on the fly (`oldToLy`). Rhythm is judged against the metronome tempo (if the take used it) or the
  best-fitting tempo: held vs written length (+/-25%) and early/late (>= 1/4 beat), see `targetRhythm`.
- **Generator** (notes panel): scales (major, three minors), arpeggios, broken thirds, 1-3 octaves,
  spelled from the key (`makeScale`), written compactly with `compactTarget`.
- **Piece (MusicXML)** (notes panel): opens `.musicxml`/`.xml`/`.mxl` (zip read by hand, `DecompressionStream`).
  `parseMusicXML`: per part staff 1, first voice; chords → top note; grace/cue notes dropped; ties joined;
  times rounded to sixteenths (tuplets approximated); a short first bar is a pickup (placed at the end of a
  full bar, shown with bar 1); implicit short bars elsewhere keep their length. `pieceTarget` turns bars a..b
  into target notes (a note tied in from before is a rest). Part chosen by instrument name. The range is
  `piece.a..piece.b` (bar indexes, 0 = 'pickup' when there is one): the panel's From / How many set it; the
  bar above the sheet (`pieceBar`) moves either end by a bar (− / +, `pieceEdge`) and steps to the previous /
  next section of the same length (‹ / Next ›, `pieceStep`). Remembered in `pib-piece`.
- **Exercise links:** `?t=<notes>&n=<name>` loads and saves an exercise. **Play by ear:** a hidden random
  phrase in the generator's key, revealed after a take.
- **Practice panel** (chart icon): practice time per day (`pib-time`), streak, and per-note intonation
  tendencies over 2 weeks (`pib-tend`, raw cents, judged when shown).
  At the top, **Today** (`planToday`): up to 3 exercises from saved / routine / played ones, scored by days
  since practised, last session's accuracy (`pib-progress`) and recurring problems (`pib-issues`, stored
  after each take of a target with 2+ takes), minus 4 if practised today; each with its reasons and a
  Practise button (target + its last tempo). **Backup / Restore** (Settings > Controls) saves every pib-*
  entry and optionally the recent takes in one JSON file.
- **Pitch view:** vibrato rate/width/evenness and bow steadiness (`soundOf`), and Compare with another take.
- **Metronome** (Settings > Tempo): visual only, click (scheduled on the audio clock; needs headphones so
  the mic doesn't hear it) or vibrate (Android). **Sync** (`syncMs`, saved in settings): Bluetooth output
  (and the mic) make the player's sound arrive late against the beat. Measure (`measureSync`): 4-beat
  count-in, then 8 short notes with the clicks; onsets (`calibFeed`, loudness jumps in 128-sample blocks,
  timed like a take) against their beats, median kept unless the spread is over 40 ms; − / + adjust by 10.
  A take's grid starts syncMs later (`take.metro.t0`), so its bars and the downbeat playback line up with
  what was played. With the click, the beat ring is drawn `ac.outputLatency` late, when the click is heard.
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
- **Live note** (Settings > Feedback > Live note while playing, on by default): while recording, the big
  button shows the note being played (`livePitch` on the last ~4096 samples, median of 5 readings, a new
  note after 3 steady readings or a re-bow) and its cents under the judging setting. With target notes:
  'Next <note>' under the button, and with rhythm a length bar against the written length (tempo from
  the metronome, or the last take of that target). Hidden in Zen mode. An eye button left of the circle (mirroring the
  stop button) toggles it in one tap, also while recording; it is the same setting.
- **Summary** (target takes, 'Summary (n)' tab from 2 takes of the same target; `summarize`): over the
  last takes of that target (up to 10), recurring problems per note ranked by frequency x weight (wrong /
  missed 3, rhythm 2, intonation 1.5 scaled by size and only when off the same way in 40%+ of takes),
  the target staff coloured by each note's main problem with 'k/n' above, and right notes per take.
  From the 3rd take the top one also shows in the normal feedback as 'Most often'.
- **Series** (under target notes / a target result: 'Play it 3x 5x 10x back to back'): no playback and no
  feedback between takes (body.series hides the sheet; a bar counts takes, Stop ends early); after the last
  take listening stops and the Summary of exactly those takes opens (`lastSeries`, `summaryTakes`).
- **Hear it right** (`fixPlan`, `renderFix`, `hearFixed`): each mistake row has a ▶ that plays that note with
  one note either side as played, a pause, then the same notes corrected from the player's own recording:
  each note resampled to the right pitch (judging setting) and WSOLA-stretched to its written length at its
  written place (target tempo from `targetRhythm`, or the sheet's lengths without a target), crossfaded.
  Missed notes and wrong notes more than a fourth off are a synthesized tone at the take's loudness; extra
  notes are left out. 'Yours, fixed' (shown when there is anything to fix) plays the whole take corrected.
- **Coach** (button beside Drone, `coach`, saved in settings): instead of playing each take back, waits for its
  notes (`coachAfter`). With target notes: clean = 'Clean! Once more'; else the most serious mistake (wrong /
  missed, then rhythm, then tuning, as the Focus switches allow; the Summary's recurring one if 3+ takes)
  becomes a passage (`coachPassage`: a note before, two for rhythm, one after, plus a mistake right after;
  3-6 notes) set as a temporary target (`target.coach`, written by `passageStr` keeping its place in the bar;
  `coach.full` holds the exercise, which is what gets saved). It plays yours then right (`hearFixed`) and
  listens to the passage; right twice in a row = back to the whole exercise; each miss replays the demo;
  try 3 slows the metronome 10%; after 5 tries back to the whole exercise. Passage takes don't count for
  progress, ladder or recurring problems. Setting any other target ends the passage. What is going on is
  always shown: the big button says Yours / Right (the demo's two halves, `coach.phase`), Checking (reading
  a take), Your turn (listening for the passage); the coach bar (always there while Coach is on) says
  'Play the whole piece…', '✓ Clean', or 'Practise notes 3–5', the problem, Listen / Your turn / Right!
  Once more / Not yet, try 2 of 5, and two dots for the two right takes, with ▶ (hear it right) and Skip;
  the staff shows the whole piece with the passage in colour and the rest faded. Once there is a take, an
  ossia (`drawOssia`, two staves via `%%score 1 2`, only the bars of the passage): above, what was played
  (`playedOver`: the take's notes on the piece's grid at its own tempo and offset from `targetRhythm`,
  octave shift removed; unflagged starts and lengths drawn as written, only flagged timing shown as played;
  red wrong or extra, amber off in time or tune, green right; invisible rests elsewhere); below, the
  written bars, the passage in ink and its neighbours faded. `toAbc(..., opt)` takes {total, rest:'x'} so
  both staves break into the same bars. Without target notes it plays 'Yours, fixed' when something is off.
- **Mistakes on the staff** (`fixList(..., inline)`, `markStaff`): each problem note carries a short label in its
  colour (the note played below a wrong one; above: '+27' / '−15' cents, 'long', 'short', 'early', 'late',
  the most serious only). Tapping a marked note (nearest within 40 px) shows one line in plain words
  ('C♯4 you played C4 · ¼ beat late') and plays it yours, then right. Below the staff only the counts,
  general points (intervals, extra notes, 'Most often') and ✓ lines; a steady tempo is a ✓ line, the graph
  shows only when something is off. The Summary keeps its numbered rows.
- **Focus** (row under the metronome): All / Tuning / Rhythm / Notes / Zen set the Feedback switches in one
  tap (`FOCUS` presets: intonation, rhythm, written feedback; Zen = zen mode); no button is lit for a custom mix.
- **Training** (notes panel): **Rhythm drill** (`makeDrill`, `DRILLS`): two bars of 4/4 on one open string
  (quarters & eighths, dotted, syncopation, rests, mixed); switches focus to Rhythm and the metronome on.
  **Sight-reading** (`makeSight`, `SIGHT` levels 1-4: length, keys, leaps, rhythms; ends on the tonic):
  no Hear it before playing; after each take good (90%+ right, rhythm right) / weak (<60%); 3 good in a row
  = level up, 2 weak = level down (`pib-sight`); 'Next phrase' in the result. Drill / sight / ear targets
  aren't kept as the saved target. A target on one pitch class gets no key signature (`keyOf`).
- **Tempo graph** (`tempoHTML`, under the feedback when rhythm is judged): tempo per note (written beats /
  seconds between starts, lengths as written at the player's own tempo), straight-line trend, scatter;
  'speeds up / slows down from X to Y', 'steady (±n)', 'rushing / dragging N%' vs the metronome.
- **Routine** (notes panel): exercises in order, each with its own tempo (`pib-routine`); a bar above the
  sheet steps through them; the position and any tempo change (ladder or +/-) are remembered per exercise.

## Ideas discussed but not built
- A teacher version (assign exercises, see students' progress and takes); would need accounts and a server.
  (Exercise links are the light version without a server.)
