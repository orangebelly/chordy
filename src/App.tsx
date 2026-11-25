import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ThemePicker } from './components/ThemePicker';
import { useSortableSections } from './components/useSortableSections';
import { GripIcon, PlayIcon } from './components/Icons';
import { applyTheme, loadTheme, saveTheme, watchSystemTheme, type ThemeId } from './theme';
import { loadPageOrders, PAGE_SECTIONS, savePageOrders, SECTION_TITLES, type SectionId } from './layout';
import { hashFor, PAGES, useHashPage } from './pages';
import { ChordSearch } from './components/ChordSearch';
import { ChordInfo } from './components/ChordInfo';
import { ChordCompare } from './components/ChordCompare';
import { isComparisonInProgress, parseComparison } from './utils/compare';
import { PianoKeyboard } from './components/PianoKeyboard';
import { GuitarFretboard, TuningSelect } from './components/GuitarFretboard';
import { GuitarShape } from './components/GuitarShape';
import { Section } from './components/Section';
import { AudioControls } from './components/AudioControls';
import { ProgressionPanel } from './components/ProgressionPanel';
import { SongBuilder, type SongPosition } from './components/SongBuilder';
import { HarmonyPanel, MelodyPanel, type HarmonyPlayback } from './components/Harmonizer';
import { HelpPanel } from './components/HelpPanel';
import { chordMidiNotes, parseChord, type Chord } from './utils/chordParser';
import { TUNINGS } from './utils/guitarNotes';
import { chordShapes, shapeMidiNotes } from './utils/guitarShapes';
import { buildSteps, parseProgression, type Step } from './utils/progression';
import { addMeasure, loadSong, saveSong, updateMeasure, type Song } from './utils/song';
import {
  audioTime, loadSamples, playArpeggio, playChord, preloadSamples, scheduleNotes, stopAll, type Instrument,
} from './utils/audio';
import { harmonize, keyName as keyNameOf, planToText, withOverrides, type PlanStyle, type SlotOverride } from './utils/harmonize';
import { barCount, loadMelodySession, melodyEnd, quantize, saveMelodySession, type MelodySession } from './utils/melody';

const INITIAL = 'Dmaj7';

type Playing =
  | { kind: 'progression'; index: number }
  | ({ kind: 'song' } & SongPosition)
  | ({ kind: 'harmony' } & HarmonyPlayback);

/** Parse a chord text and attach optimal shapes / voicings, remembering each chord's position in the text. */
function stepsForText(texts: string[], shapesFor: ((c: Chord) => ReturnType<typeof chordShapes>) | null) {
  const refs: { group: number; item: number; chord: Chord }[] = [];
  texts.forEach((text, group) =>
    parseProgression(text).forEach((it, item) => it.chord && refs.push({ group, item, chord: it.chord })),
  );
  const steps = buildSteps(refs.map((r) => r.chord), shapesFor);
  return refs.map((r, i) => ({ ...r, step: steps[i] }));
}

export default function App() {
  const [input, setInput] = useState(INITIAL);
  const [tuning, setTuning] = useState(TUNINGS[0]);
  const [instrument, setInstrument] = useState<Instrument>('piano');
  const [shapeIndex, setShapeIndex] = useState(0);
  // Keep showing the last valid chord while the user is mid-typing.
  const [chord, setChord] = useState<Chord>(() => {
    const r = parseChord(INITIAL);
    if (!r.ok) throw new Error('Initial chord must be valid');
    return r.chord;
  });

  // Song (saved in localStorage) and the progression editor
  const [song, setSong] = useState<Song>(loadSong);
  const [progText, setProgText] = useState('C Am F G');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => preloadSamples(), []);

  // Theme (persisted; "Match system" follows the OS setting live)
  const [theme, setTheme] = useState<ThemeId>(loadTheme);
  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
    return theme === 'system' ? watchSystemTheme(() => applyTheme('system')) : undefined;
  }, [theme]);

  // Current page (URL hash). All state lives here in App, so switching pages loses nothing.
  const [page, goTo] = useHashPage();

  // Section order per page (drag to rearrange; persisted)
  const [orders, setOrders] = useState(loadPageOrders);
  const order = orders[page];
  const setOrder = (o: SectionId[]) => {
    const next = { ...orders, [page]: o };
    setOrders(next);
    savePageOrders(next);
  };
  const { stackRef, drag, startDrag, onHandleKeyDown } = useSortableSections(order, setOrder);

  // Harmonize page: the recorded melody and its settings (persisted)
  const [melodySession, setMelodySession] = useState<MelodySession>(loadMelodySession);
  useEffect(() => saveMelodySession(melodySession), [melodySession]);
  const melody = useMemo(() => quantize(melodySession.raw, melodySession.grid), [melodySession.raw, melodySession.grid]);
  const melodyBars = barCount(melody, melodySession.beatsPerBar);
  const suggestions = useMemo(
    () =>
      harmonize(melody, {
        beatsPerBar: melodySession.beatsPerBar,
        chordsPerBar: melodySession.beatsPerBar % 2 === 0 ? melodySession.chordsPerBar : 1,
        key: melodySession.key ?? undefined,
      }),
    [melody, melodySession.beatsPerBar, melodySession.chordsPerBar, melodySession.key],
  );
  // Chords the user swapped in apply only to the melody + settings they were picked for.
  const swapSig = useMemo(
    () => JSON.stringify([melody.map((n) => [n.midi, n.start, n.duration]), melodySession.beatsPerBar, melodySession.chordsPerBar, melodySession.key]),
    [melody, melodySession.beatsPerBar, melodySession.chordsPerBar, melodySession.key],
  );
  const swaps = melodySession.swaps?.sig === swapSig ? melodySession.swaps.plans : {};
  const harmony = useMemo(
    () => ({ ...suggestions, plans: suggestions.plans.map((pl) => withOverrides(pl, swaps[pl.style], melody)) }),
    [suggestions, swaps, melody], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function swapChord(style: PlanStyle, i: number, choice: SlotOverride | null) {
    setMelodySession((s) => {
      const cur = s.swaps?.sig === swapSig ? s.swaps.plans : {};
      const forPlan = { ...cur[style] };
      if (choice) forPlan[i] = choice;
      else delete forPlan[i];
      return { ...s, plan: style, swaps: { sig: swapSig, plans: { ...cur, [style]: forPlan } } };
    });
    const symbol = choice?.symbol ?? suggestions.plans.find((pl) => pl.style === style)?.slots[i]?.chord.symbol;
    const r = symbol ? parseChord(symbol) : null;
    if (r?.ok) {
      const step = buildSteps([r.chord], shapesFor)[0];
      stopEverything();
      setSelectedStep(null);
      showStep(step);
      playChord(instrument, stepNotes(step));
    }
  }

  function resetPlan(style: PlanStyle) {
    setMelodySession((s) => {
      if (s.swaps?.sig !== swapSig) return s;
      const { [style]: _, ...rest } = s.swaps.plans;
      return { ...s, swaps: { sig: swapSig, plans: rest } };
    });
  }

  // Undo for the melody: every change to the notes (recorded, edited, deleted) can be stepped back.
  // Where harmonize playback starts (beats); set by hovering the roll, or by pausing.
  const [playCursor, setPlayCursor] = useState(0);

  const rawHistory = useRef<MelodySession['raw'][]>([]);
  const prevRaw = useRef(melodySession.raw);
  const undoing = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  useEffect(() => {
    if (prevRaw.current === melodySession.raw) return;
    if (!undoing.current) rawHistory.current = [...rawHistory.current.slice(-199), prevRaw.current];
    undoing.current = false;
    prevRaw.current = melodySession.raw;
    setCanUndo(rawHistory.current.length > 0);
  }, [melodySession.raw]);
  function undoMelody() {
    const last = rawHistory.current.pop();
    if (!last) return;
    undoing.current = true;
    setMelodySession((s) => ({ ...s, raw: last }));
  }
  const selectedPlan = harmony.plans.find((pl) => pl.style === melodySession.plan) ?? harmony.plans[0] ?? null;
  const planSteps = (style: PlanStyle) => {
    const plan = harmony.plans.find((pl) => pl.style === style);
    return plan ? buildSteps(plan.slots.map((sl) => sl.chord), shapesFor) : [];
  };
  useEffect(() => saveSong(song), [song]);

  // "Em7 vs C7": compare two chords. The instruments show one side at a time.
  const comparison = useMemo(() => parseComparison(input), [input]);
  const cmp = comparison?.ok ? comparison : null;
  const [cmpSide, setCmpSide] = useState<'a' | 'b'>('a');
  const [cmpIdx, setCmpIdx] = useState<[number, number]>([0, 0]);

  const result = parseChord(input);
  const error = comparison
    ? comparison.ok ? null : comparison.error
    : result.ok || isComparisonInProgress(input) ? null : result.error;

  // Fingerings are written for standard tuning only.
  const isStandard = tuning === TUNINGS[0];
  const shapesFor = isStandard ? chordShapes : null;
  const shapes = useMemo(() => (isStandard ? chordShapes(chord) : []), [chord, isStandard]);
  const cmpShapes = useMemo(
    () => (cmp && isStandard ? [chordShapes(cmp.a), chordShapes(cmp.b)] as const : null),
    [cmp, isStandard],
  );
  const shape = cmp ? cmpShapes?.[cmpSide === 'a' ? 0 : 1][cmpIdx[cmpSide === 'a' ? 0 : 1]] : shapes[shapeIndex];

  // Progression editor: shapes optimised over this progression.
  const progItems = useMemo(() => parseProgression(progText), [progText]);
  const progSteps = useMemo(() => {
    const byItem: (Step | undefined)[] = progItems.map(() => undefined);
    stepsForText([progText], shapesFor).forEach((r) => (byItem[r.item] = r.step));
    return byItem;
  }, [progText, progItems, shapesFor]);

  // Whole song: shapes optimised across every measure, including the joins between them.
  const songSteps = useMemo(() => {
    const byId = new Map(song.measures.map((m) => [m.id, m.chords]));
    return stepsForText(song.arrangement.map((id) => byId.get(id) ?? ''), shapesFor);
  }, [song.measures, song.arrangement, shapesFor]);

  const editingMeasure = song.measures.find((m) => m.id === editingId) ?? null;

  function showStep(step: Step) {
    setInput(step.chord.symbol);
    setChord(step.chord);
    setShapeIndex(step.shapeIndex ?? 0);
  }

  function handleChange(value: string) {
    setInput(value);
    setSelectedStep(null);
    const c = parseComparison(value);
    if (c) {
      if (c.ok) {
        setChord(cmpSide === 'b' ? c.b : c.a);
        setCmpIdx([0, 0]);
        setShapeIndex(0);
      }
      return;
    }
    const r = parseChord(value);
    if (r.ok) {
      setChord(r.chord);
      setShapeIndex(0);
    }
  }

  function selectStep(i: number) {
    const step = progSteps[i];
    if (!step) return;
    setSelectedStep(i);
    showStep(step);
  }

  /** Piano: close voicing from the root. Guitar: the notes of the current shape. */
  function notesFor(inst: Instrument) {
    return inst === 'guitar' && shape ? shapeMidiNotes(shape) : chordMidiNotes(chord);
  }

  function stepNotes(step: Step) {
    if (instrument === 'piano') return step.piano;
    return step.shape ? shapeMidiNotes(step.shape) : chordMidiNotes(step.chord);
  }

  const playToken = useRef(0);

  function stopEverything() {
    playToken.current++;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlaying(null);
    stopAll();
  }

  /** Play steps one after another, updating the piano/guitar views as each chord sounds. */
  function playSequence(seq: { step: Step; pos: Playing }[]) {
    stopEverything();
    const ms = (60 / song.bpm) * song.beatsPerChord * 1000;
    seq.forEach(({ step, pos }, n) => {
      timers.current.push(
        window.setTimeout(() => {
          setPlaying(pos);
          showStep(step);
          playChord(instrument, stepNotes(step));
        }, n * ms),
      );
    });
    timers.current.push(window.setTimeout(() => setPlaying(null), seq.length * ms));
  }

  function playProgression() {
    playSequence(
      progSteps.flatMap((step, index) => (step ? [{ step, pos: { kind: 'progression' as const, index } }] : [])),
    );
  }

  function playSong(fromSlot = 0) {
    playSequence(
      songSteps
        .filter((r) => r.group >= fromSlot)
        .map((r) => ({ step: r.step, pos: { kind: 'song' as const, slot: r.group, item: r.item } })),
    );
  }

  /** Melody alone (style null) or melody + a plan's chords, on one shared audio clock. */
  /**
   * Melody alone (style null) or melody + a plan's chords, on one shared audio clock,
   * starting at beat `from` (the roll's start cursor). Notes already sounding at
   * `from` play their remaining length.
   */
  async function playHarmony(style: PlanStyle | null, from = playCursor) {
    stopEverything();
    const token = playToken.current;
    const plan = style ? harmony.plans.find((pl) => pl.style === style) ?? null : null;
    const steps = style ? planSteps(style) : [];
    const endBeat = Math.max(melodyEnd(melody), plan ? plan.slots.length * plan.slots[0].duration : 0);
    if (from >= endBeat - 1e-9) from = 0; // cursor past the end: play from the top
    await Promise.all([loadSamples('piano'), plan ? loadSamples(instrument) : null]);
    if (token !== playToken.current) return; // stopped while loading
    const bpm = melodySession.bpm;
    const sec = 60 / bpm;
    const at = audioTime() + 0.08;
    // Everything still to sound after `from`, clipped to start there.
    const clip = (start: number, duration: number) => {
      const s0 = Math.max(start, from);
      const e0 = start + duration;
      return e0 - s0 > 1e-9 ? { start: (s0 - from) * sec, duration: (e0 - s0) * sec } : null;
    };
    void scheduleNotes('piano', melody.flatMap((n) => {
      const c = clip(n.start, n.duration);
      return c ? [{ midi: n.midi, ...c, volume: 0.85 }] : [];
    }), at);
    if (plan) {
      const notes = plan.slots.flatMap((sl, i) => {
        const c = clip(sl.start, sl.duration);
        return c ? stepNotes(steps[i]).map((midi, k) => ({
          midi, start: c.start + (instrument === 'guitar' ? k * 0.03 : 0), duration: c.duration, volume: 0.32,
        })) : [];
      });
      void scheduleNotes(instrument, notes, at);
    }
    // startedAt = when beat 0 would have been, so the playhead maths stays simple.
    const startedAt = performance.now() + (at - audioTime()) * 1000 - from * sec * 1000;
    const lead = startedAt - performance.now();
    setPlaying({ kind: 'harmony', style, slot: null, startedAt, bpm });
    plan?.slots.forEach((sl, i) => {
      if (sl.start + sl.duration <= from + 1e-9) return;
      timers.current.push(
        window.setTimeout(() => {
          setPlaying({ kind: 'harmony', style, slot: i, startedAt, bpm });
          showStep(steps[i]);
        }, Math.max(0, lead + sl.start * sec * 1000)),
      );
    });
    timers.current.push(window.setTimeout(() => setPlaying(null), lead + endBeat * sec * 1000 + 300));
  }

  /** Stop, leaving the start cursor where playback was (so Space resumes from there). */
  function pauseHarmony() {
    if (playing?.kind !== 'harmony') return stopEverything();
    const beat = ((performance.now() - playing.startedAt) / 1000) * (playing.bpm / 60);
    stopEverything();
    const g = melodySession.grid;
    setPlayCursor(Math.max(0, Math.floor(beat / g + 1e-6) * g));
  }

  /** Space on the roll: melody + the selected plan's chords, or pause. */
  function togglePlay() {
    if (playing?.kind === 'harmony') pauseHarmony();
    else void playHarmony(selectedPlan?.style ?? null);
  }

  function showPlanChord(style: PlanStyle, i: number) {
    const step = planSteps(style)[i];
    if (!step) return;
    stopEverything();
    setMelodySession((s) => ({ ...s, plan: style }));
    setSelectedStep(null);
    showStep(step);
    playChord(instrument, stepNotes(step));
  }

  /** Put a plan's chords into the Compose page's progression editor. */
  function sendPlanToCompose(style: PlanStyle, asMeasure: boolean) {
    const plan = harmony.plans.find((pl) => pl.style === style);
    if (!plan) return;
    stopEverything();
    const text = planToText(plan);
    // One chord per slot: match the progression's beats-per-chord when it can be expressed (1, 2 or 4).
    const beats = plan.slots[0].duration;
    let next = [1, 2, 4].includes(beats) ? { ...song, beatsPerChord: beats } : song;
    if (asMeasure) {
      const added = addMeasure(next, text);
      next = added.song;
      setEditingId(added.id);
    } else setEditingId(null);
    setSong(next);
    setProgText(text);
    setSelectedStep(null);
    goTo('compose');
  }

  function saveAsNewMeasure() {
    const { song: next, id } = addMeasure(song, progText.trim());
    setSong(next);
    setEditingId(id);
  }

  function editMeasure(id: string) {
    const m = song.measures.find((x) => x.id === id);
    if (!m) return;
    setEditingId(id);
    setProgText(m.chords);
    setSelectedStep(null);
  }

  // Display-only text for the transport dock.
  const playbackStatus = !playing
    ? null
    : playing.kind === 'progression'
      ? `Progression · chord ${playing.index + 1} of ${progItems.length}`
      : playing.kind === 'harmony'
        ? `Melody${playing.style ? ` + ${harmony.plans.find((pl) => pl.style === playing.style)?.name ?? ''} chords` : ''}${playing.slot !== null && selectedPlan ? ` · bar ${(harmony.plans.find((pl) => pl.style === playing.style)?.slots[playing.slot]?.bar ?? 0) + 1}` : ''}`
        : `${song.measures.find((m) => m.id === song.arrangement[playing.slot])?.name ?? 'Song'} · ${playing.slot + 1} of ${song.arrangement.length}`;
  const harmonyPlayback = playing?.kind === 'harmony' ? playing : null;

  const dragProps = (id: SectionId) => ({
    onPointerDown: (e: PointerEvent) => startDrag(id, e),
    onKeyDown: (e: KeyboardEvent) => onHandleKeyDown(id, e),
    isDragging: drag?.id === id,
  });

  function playPianoChord() {
    stopEverything();
    playChord('piano', chordMidiNotes(chord));
  }

  const sections: Record<SectionId, ReactNode> = {
    melody: (
      <Section
        drag={dragProps('melody')} id="melody" title="Melody"
        summary={melody.length ? `${melody.length} notes · ${melodyBars} bar${melodyBars > 1 ? 's' : ''} · ${melodySession.bpm} BPM` : 'Empty'}>
        <MelodyPanel
          session={melodySession}
          update={setMelodySession}
          notes={melody}
          bars={melodyBars}
          slots={selectedPlan?.slots}
          playback={harmonyPlayback}
          onSlotClick={(i) => selectedPlan && showPlanChord(selectedPlan.style, i)}
          onPlayMelody={() => playHarmony(null)}
          cursor={playCursor}
          onCursor={setPlayCursor}
          onTogglePlay={togglePlay}
          onStop={stopEverything}
          highlight={harmonyPlayback?.slot != null ? chord : null}
          onUndo={undoMelody}
          canUndo={canUndo}
        />
      </Section>
    ),
    harmony: (
      <Section
        drag={dragProps('harmony')} id="harmony" title="Harmony suggestions"
        summary={selectedPlan ? `${keyNameOf(harmony.key)} · ${selectedPlan.name}: ${planToText(selectedPlan)}` : keyNameOf(harmony.key)}>
        <HarmonyPanel
          result={suggestions}
          plans={harmony.plans}
          notes={melody}
          session={melodySession}
          update={setMelodySession}
          selected={selectedPlan?.style ?? null}
          playback={harmonyPlayback}
          onPlay={(st) => playHarmony(st)}
          onStop={stopEverything}
          onChordClick={showPlanChord}
          onSwap={swapChord}
          onResetPlan={resetPlan}
          onSendProgression={(st) => sendPlanToCompose(st, false)}
          onSaveMeasure={(st) => sendPlanToCompose(st, true)}
        />
      </Section>
    ),
    search: (
      <Section
        drag={dragProps('search')} id="search" title="Chord search" summary={cmp ? `${cmp.a.symbol} vs ${cmp.b.symbol}` : chord.symbol}>
        <ChordSearch value={input} error={error} onChange={handleChange} />
        {error && <p className="stale-note">Still showing {chord.symbol}.</p>}
      </Section>
    ),
    chord: (
      <Section
        drag={dragProps('chord')} id="chord" title={cmp ? 'Chord comparison' : 'Chord breakdown'}
        summary={cmp ? `${cmp.a.symbol} vs ${cmp.b.symbol}` : `${chord.symbol} = ${chord.tones.map((t) => t.name).join(' ')}`}>
        {cmp ? (
          <ChordCompare a={cmp.a} b={cmp.b} side={cmpSide} onSide={(sd) => {
            setCmpSide(sd);
            setChord(sd === 'a' ? cmp.a : cmp.b);
          }} />
        ) : (
          <ChordInfo chord={chord} />
        )}
      </Section>
    ),
    piano: (
      <Section
        drag={dragProps('piano')} id="piano" title="Piano" summary={chord.tones.map((t) => t.name).join(' ')}
        actions={
          <button className="btn btn--outline btn--sm" onClick={playPianoChord}>
            <PlayIcon /> Play
          </button>
        }
      >
        <PianoKeyboard chord={chord} />
      </Section>
    ),
    shape: (
      <Section
        drag={dragProps('shape')} id="shape" title={cmp ? 'Guitar chord shapes' : 'Guitar chord shape'}
        summary={cmp ? `${cmp.a.symbol} vs ${cmp.b.symbol}` : shape ? `${chord.symbol}  ${shape.frets.map((f) => f ?? 'x').join('')}` : chord.symbol}>
        {cmp ? (
          <div className="shape-compare">
            {([cmp.a, cmp.b] as const).map((c, i) => {
              const list = cmpShapes?.[i] ?? [];
              const sd = i === 0 ? 'a' : 'b';
              return (
                <div key={i} className={`shape-compare-col${cmpSide === sd ? ' is-shown' : ''}`}>
                  <GuitarShape
                    chord={c}
                    shapes={list}
                    shapeIndex={Math.min(cmpIdx[i], Math.max(0, list.length - 1))}
                    onShapeIndexChange={(k) => {
                      setCmpIdx(i === 0 ? [k, cmpIdx[1]] : [cmpIdx[0], k]);
                      setCmpSide(sd);
                      setChord(c);
                    }}
                    onStrum={() => {
                      stopEverything();
                      const sh = list[cmpIdx[i]];
                      playChord('guitar', sh ? shapeMidiNotes(sh) : chordMidiNotes(c));
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <GuitarShape
            chord={chord}
            shapes={shapes}
            shapeIndex={shapeIndex}
            onShapeIndexChange={setShapeIndex}
            onStrum={() => {
              stopEverything();
              playChord('guitar', notesFor('guitar'));
            }}
          />
        )}
      </Section>
    ),
    fretboard: (
      <Section
        drag={dragProps('fretboard')}
        id="fretboard"
        title="Guitar fretboard"
        summary={tuning.name}
        actions={
          <TuningSelect
            tuning={tuning}
            onChange={(t) => {
              setTuning(t);
              setShapeIndex(0);
            }}
          />
        }
      >
        <GuitarFretboard chord={chord} tuning={tuning} shape={shape} />
        <div className="legend">
          <span><i className="swatch hl-root" /> Root</span>
          <span><i className="swatch hl-tone" /> Chord tone</span>
        </div>
      </Section>
    ),
    progression: (
      <Section
        drag={dragProps('progression')} id="progression" title="Chord progression" summary={progText}>
        <ProgressionPanel
          text={progText}
          onTextChange={(t) => {
            setProgText(t);
            setSelectedStep(null);
          }}
          items={progItems}
          shapes={progSteps.map((s) => s?.shape)}
          selectedIndex={selectedStep}
          playingIndex={playing?.kind === 'progression' ? playing.index : null}
          onSelect={selectStep}
          bpm={song.bpm}
          onBpmChange={(bpm) => setSong({ ...song, bpm })}
          beatsPerChord={song.beatsPerChord}
          onBeatsChange={(beatsPerChord) => setSong({ ...song, beatsPerChord })}
          onPlay={playProgression}
          onStop={stopEverything}
          editingName={editingMeasure?.name ?? null}
          hasUnsavedChanges={!!editingMeasure && editingMeasure.chords !== progText.trim()}
          onSaveNew={saveAsNewMeasure}
          onUpdate={() => editingMeasure && setSong(updateMeasure(song, editingMeasure.id, { chords: progText.trim() }))}
          onCancelEdit={() => setEditingId(null)}
        />
      </Section>
    ),
    song: (
      <Section
        drag={dragProps('song')} id="song" title="My song" summary={`${song.title} · ${song.arrangement.length} measures`}>
        <SongBuilder
          song={song}
          onSongChange={setSong}
          editingId={editingMeasure?.id ?? null}
          onEdit={editMeasure}
          playing={playing?.kind === 'song' ? playing : null}
          onPlay={playSong}
          onStop={stopEverything}
        />
      </Section>
    ),
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Chord Visualizer</span>
          <span className="brand-tagline">See and hear how chords are built on piano and guitar</span>
        </div>
        <nav className="tabs" aria-label="Pages">
          {PAGES.map((pg) => (
            <a key={pg.id} href={hashFor(pg.id)} className={`tab${pg.id === page ? ' is-active' : ''}`}
              aria-current={pg.id === page ? 'page' : undefined} title={pg.hint}>
              {pg.label}
            </a>
          ))}
        </nav>
        <div className="topbar-tools">
          <ThemePicker value={theme} onChange={setTheme} />
        </div>
      </header>

      {order.join() !== PAGE_SECTIONS[page].join() && (
        <div className="page-head">
          <button className="btn btn--ghost btn--sm" onClick={() => setOrder(PAGE_SECTIONS[page])}>
            Reset layout
          </button>
        </div>
      )}

      <main className="stack" ref={stackRef} key={page} data-page={page}>
        {order.map((id) => (
          <Fragment key={id}>{sections[id]}</Fragment>
        ))}
        {drag && <div className="drop-indicator" style={{ top: drag.indicatorTop }} aria-hidden="true" />}
      </main>
      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <GripIcon /> {SECTION_TITLES[drag.id]}
        </div>
      )}

      <AudioControls
        instrument={instrument}
        onInstrumentChange={setInstrument}
        onPlayChord={() => {
          stopEverything();
          playChord(instrument, notesFor(instrument));
        }}
        onPlayArpeggio={() => {
          stopEverything();
          playArpeggio(instrument, notesFor(instrument));
        }}
        onStop={stopEverything}
        chordSymbol={chord.symbol}
        status={playbackStatus}
      />

      <HelpPanel page={page} />

      <footer className="credits">
        Piano: Salamander Grand Piano by Alexander Holm (CC-BY 3.0) · Guitar: tonejs-instruments by Nicholaus Brosowsky (CC-BY 3.0)
      </footer>
    </div>
  );
}
