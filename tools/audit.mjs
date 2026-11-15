// Transcription audit: realistic violin-like scenarios with known answers, run through index.html.
//   node tools/audit.mjs [--abc]      (--abc also prints the sheet each one would get)
// Covers what tools/check.mjs doesn't: re-bowed repeated notes, détaché, staccato, crescendo, a soft
// note between loud ones, wide vibrato, shifts, scratchy attacks, high positions up to E7, cello range,
// dotted rhythm, triplets, a trill, a rest between phrases, a long first note, a grace note.
// Cases marked 'known' are known limitations: reported, but they don't fail the run.
import { readFileSync } from 'node:fs'; import vm from 'node:vm';
import { dirname, join } from 'node:path'; import { fileURLToPath } from 'node:url';
const html=readFileSync(join(dirname(fileURLToPath(import.meta.url)),'..','index.html'),'utf8');
const sc=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const ctx=vm.createContext({Math,Float32Array,Array,JSON,console});
vm.runInContext(sc.slice(0,sc.indexOf('(() => {'))+';globalThis.A={detectNotes,guessKey,guessTempo,quantize,toAbc,noteName};',ctx);
const {detectNotes,guessKey,guessTempo,quantize,toAbc,noteName}=ctx.A;
const SR=48000; let seed=7; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647; const g=()=>Math.sqrt(-2*Math.log(rnd()+1e-12))*Math.cos(2*Math.PI*rnd());
const AMPS=[1,.6,.45,.35,.3,.2,.15,.1];
// seg: {m, d (s), c cents, vr vib rate, vc vib cents, amp, dip (bow change: amplitude dip at start), noise (ms scratch), slide (ms from previous pitch), gap (s silence after), two (second midi: double stop), ring (midi of an open string ringing on, level)}
// lead / tail like a real take: the app keeps ~0.35 s before the first sound and after the last
function synth(segs,{lead=0.35,tail=0.4,room=0.002}={}){
  const out=[]; const push=v=>out.push(v+g()*room);
  for(let i=0;i<SR*lead;i++) push(0);
  let prev=null, ringPh=0, ringAmp=0, ringF=0;
  for(const s of segs){
    const n=Math.round(s.d*SR); let ph=0, ph2=0; const amp=s.amp??1;
    for(let i=0;i<n;i++){
      const t=i/SR;
      let cents=(s.c||0)+(s.vc||0)*Math.sin(2*Math.PI*(s.vr||5.5)*t)*Math.min(1,t/0.25);
      let m=s.m;
      if(s.slide && prev!==null && t<s.slide/1000){ const k=t/(s.slide/1000); m=prev+(s.m-prev)*k; }
      const f=440*2**((m-69+cents/100)/12); ph+=2*Math.PI*f/SR;
      let env=Math.min(1,t/0.05)*Math.min(1,(s.d-t)/0.04);
      if(s.swell) env*=0.3+0.7*Math.sin(Math.PI*t/s.d);
      if(s.cresc) env*=0.15+0.85*(t/s.d);
      let x=0; AMPS.forEach((a,k)=>x+=a*Math.sin((k+1)*ph));
      if(s.two){ const f2=440*2**((s.two-69)/12); ph2+=2*Math.PI*f2/SR; AMPS.forEach((a,k)=>x+=0.8*a*Math.sin((k+1)*ph2)); }
      if(s.noise && t<s.noise/1000) x+=g()*1.5*(1-t/(s.noise/1000));
      push(x*0.12*amp*env);
    }
    if(s.ring){ ringF=440*2**((s.ring-69)/12); ringAmp=s.ringLevel||0.3; }
    if(s.gap) for(let i=0;i<s.gap*SR;i++) push(0);
    prev=s.m;
  }
  for(let i=0;i<SR*tail;i++) push(0);
  // sympathetic ring added on top over the whole take after it starts (simplified)
  return Float32Array.from(out);
}
const q=(m,d,o={})=>({m,d,...o});
const beat=60/72;
const G=[55,57,59,60,62,64,66,67];
const cases=[
  ['legato G scale', G.map(m=>q(m,beat,{swell:1})), 'G3 A3 B3 C4 D4 E4 F♯4 G4'],
  ['repeated notes, re-bowed (4× D4, then E4)', [q(62,beat,{swell:1}),q(62,beat,{swell:1}),q(62,beat,{swell:1}),q(62,beat,{swell:1}),q(64,beat*2,{swell:1})], 'D4 D4 D4 D4 E4'],
  ['repeated notes, fast détaché 8ths (6× A4)', Array(6).fill(0).map(()=>q(69,beat/2)), 'A4 A4 A4 A4 A4 A4'],
  ['detached with gaps (staccato)', G.map(m=>q(m,beat*0.5,{gap:beat*0.5})), 'G3 A3 B3 C4 D4 E4 F♯4 G4'],
  ['long crescendo on one note', [q(62,4*beat,{cresc:1}),q(64,beat)], 'D4 E4'],
  ['soft note between loud ones (−26 dB)', [q(62,beat),q(64,beat,{amp:0.05}),q(66,beat),q(67,beat)], 'D4 E4 F♯4 G4'],
  ['wide romantic vibrato ±40 cents', [q(64,2*beat,{vc:40,vr:5.5}),q(66,2*beat,{vc:40,vr:5.5}),q(67,2*beat,{vc:40})], 'E4 F♯4 G4'],
  ['vibrato ±25 on a flat note (−30)', [q(62,2*beat,{c:-30,vc:25}),q(64,2*beat)], 'D4 E4'],
  ['shift slides (150 ms) between positions', [q(64,beat),q(71,beat,{slide:150}),q(76,beat,{slide:150}),q(69,beat,{slide:150})], 'E4 B4 E5 A4'],
  ['scratchy attacks (60 ms noise)', G.slice(0,5).map(m=>q(m,beat,{noise:60})), 'G3 A3 B3 C4 D4'],
  ['high positions E6 A6 E7', [q(88,beat),q(93,beat),q(100,beat),q(93,beat)], 'E6 A6 E7 A6'],
  ['fifth position C6 D6 E6', [q(84,beat),q(86,beat),q(88,beat)], 'C6 D6 E6'],
  ['cello low C2 G2 D3', [q(36,beat),q(43,beat),q(50,beat)], 'C2 G2 D3'],
  ['dotted rhythm ♩. ♪ ♩. ♪', [q(62,1.5*beat),q(64,0.5*beat),q(66,1.5*beat),q(67,0.5*beat),q(69,2*beat)], 'D4 E4 F♯4 G4 A4'],
  ['triplets (3 per beat)', [62,64,66,67,69,71].map(m=>q(m,beat/3)).concat([q(74,2*beat)]), 'D4 E4 F♯4 G4 A4 B4 D5'],
  ['trill D–E (8 notes)', [62,64,62,64,62,64,62,64].map(m=>q(m,0.11)).concat([q(62,beat*2)]), 'D4 E4 D4 E4 D4 E4 D4 E4 D4'],
  ['two phrases with a rest', [q(62,beat),q(64,beat),q(66,beat,{gap:1.2}),q(67,beat),q(69,beat)], 'D4 E4 F♯4 G4 A4'],
  // known: two notes a fifth apart repeat together at the period an octave below the lower one (D3)
  ['double stop D4+A4', [q(62,2*beat,{two:69}),q(64,beat)], 'D4 E4|A4 E4|D4 A4 E4|A4 D4 E4', 0, 'known'],
  ['first note held long (4 beats)', [q(55,4*beat,{swell:1}),q(57,beat),q(59,beat)], 'G3 A3 B3'],
  ['grace-note-like quick neighbour (80 ms)', [q(64,beat),q(66,0.08),q(64,beat)], 'E4 E4'],
  // from a report: a high (Pythagorean-ish) leading note, ~half a semitone sharp, read partly as the
  // note above; its first piece went to the note before, so the lengths looked uneven
  ['even A scale, G# 45 sharp, vibrato crossing', [57,59,61,62,64,66,68,69].map(m=>q(m,1.25,{c:m===68?45:m===66?30:0,vc:m===68?12:0,vr:5,swell:1})), 'A3 B3 C♯4 D4 E4 F♯4 G♯4 A4', 0, '', 'A,4 B,4 C4 D4 | E4 F4 G4 A4'],
];
let fails=0;
let known=0;
for(const [name,segs,want,detail=0,flag,wantAbc] of cases){
  const x=synth(segs), notes=detectNotes(x,SR,440,detail), key=guessKey(notes);
  const got=notes.map(n=>noteName(n.midi,key)).join(' ');
  let abc=''; try{ const bpm=guessTempo(notes); abc=toAbc(quantize(notes,bpm,undefined,detail),bpm,'auto',4,key,4).split('\n').slice(5).join(' ').trim()+'  ('+bpm+' bpm)'; }catch(e){ abc='ERR '+e.message; }
  const ok=want.split('|').includes(got) && (!wantAbc || abc.includes(wantAbc)); if(!ok){ if(flag==='known') known++; else fails++; }
  console.log((ok?'ok   ':flag==='known'?'known':'FAIL ')+name.padEnd(44)+got+(ok?'':'   (want '+want+(wantAbc?' / sheet '+wantAbc+', got '+abc:'')+')'));
  if(process.argv.includes('--abc')) console.log('      '+abc);
}
console.log(`\n${cases.length-fails-known}/${cases.length} ok`+(known?`, ${known} known limitation`:'')+(fails?`, ${fails} FAILED`:''));
process.exit(fails?1:0);
