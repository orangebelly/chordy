import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ThemePicker } from './components/ThemePicker';
import { useSortableSections } from './components/useSortableSections';
import { GripIcon, PlayIcon } from './components/Icons';
import { applyTheme, loadTheme, saveTheme, watchSystemTheme, type ThemeId } from './theme';
import { DEFAULT_ORDER, loadOrder, saveOrder, SECTION_TITLES, type SectionId } from './layout';
import { ChordSearch } from './components/ChordSearch';
import { ChordInfo } from './components/ChordInfo';
import { PianoKeyboard } from './components/PianoKeyboard';
import { GuitarFretboard, TuningSelect } from './components/GuitarFretboard';
import { GuitarShape } from './components/GuitarShape';
import { Section } from './components/Section';
import { AudioControls } from './components/AudioControls';
import { ProgressionPanel } from './components/ProgressionPanel';
import { SongBuilder, type SongPosition } from './components/SongBuilder';
import { chordMidiNotes, parseChord, type Chord } from './utils/chordParser';
import { TUNINGS } from './utils/guitarNotes';
import { chordShapes, shapeMidiNotes } from './utils/guitarShapes';
import { buildSteps, parseProgression, type Step } from './utils/progression';
import { addMeasure, loadSong, saveSong, updateMeasure, type Song } from './utils/song';
import { playArpeggio, playChord, preloadSamples, stopAll, type Instrument } from './utils/audio';

const INITIAL = 'Dmaj7';

type Playing = { kind: 'progression'; index: number } | ({ kind: 'song' } & SongPosition);

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

  // Section order (drag to rearrange; persisted)
  const [order, setOrderState] = useState<SectionId[]>(loadOrder);
  const setOrder = (o: SectionId[]) => {
    setOrderState(o);
    saveOrder(o);
  };
  const { stackRef, drag, startDrag, onHandleKeyDown } = useSortableSections(order, setOrder);
  useEffect(() => saveSong(song), [song]);

  const result = parseChord(input);
  const error = result.ok ? null : result.error;

  // Fingerings are written for standard tuning only.
  const isStandard = tuning === TUNINGS[0];
  const shapesFor = isStandard ? chordShapes : null;
  const shapes = useMemo(() => (isStandard ? chordShapes(chord) : []), [chord, isStandard]);
  const shape = shapes[shapeIndex];

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

  function stopEverything() {
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
      : `${song.measures.find((m) => m.id === song.arrangement[playing.slot])?.name ?? 'Song'} · ${playing.slot + 1} of ${song.arrangement.length}`;

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
    search: (
      <Section
        drag={dragProps('search')} id="search" title="Chord search" summary={chord.symbol}>
        <ChordSearch value={input} error={error} onChange={handleChange} />
        {error && <p className="stale-note">Still showing {chord.symbol}.</p>}
      </Section>
    ),
    chord: (
      <Section
        drag={dragProps('chord')} id="chord" title="Chord breakdown" summary={`${chord.symbol} = ${chord.tones.map((t) => t.name).join(' ')}`}>
        <ChordInfo chord={chord} />
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
        drag={dragProps('shape')} id="shape" title="Guitar chord shape" summary={shape ? `${chord.symbol}  ${shape.frets.map((f) => f ?? 'x').join('')}` : chord.symbol}>
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
        <div className="topbar-tools">
          {order.join() !== DEFAULT_ORDER.join() && (
            <button className="btn btn--ghost btn--sm" onClick={() => setOrder(DEFAULT_ORDER)}>
              Reset layout
            </button>
          )}
          <ThemePicker value={theme} onChange={setTheme} />
        </div>
      </header>

      <main className="stack" ref={stackRef}>
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

      <footer className="credits">
        Piano: Salamander Grand Piano by Alexander Holm (CC-BY 3.0) · Guitar: tonejs-instruments by Nicholaus Brosowsky (CC-BY 3.0)
      </footer>
    </div>
  );
}
