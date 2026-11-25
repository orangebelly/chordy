# Build a Simple Interactive Chord Visualizer

Act as a senior frontend engineer. Build a lightweight, interactive music theory tool for beginners learning piano and guitar chords.

## 1. Product Goal

Build a simple web application where users can enter a chord name (e.g. Dmaj7, C, Am7, G7) and immediately see:

1. The notes that make up the chord.
2. The corresponding keys highlighted on a piano keyboard.
3. The corresponding notes highlighted on a guitar fretboard.
4. The actual chord played through audio.

The goal is to help beginners visually and aurally understand how chords are constructed across different instruments.

Keep the application simple. No authentication, backend, database, or unnecessary features.

## 2. Tech Stack

- React
- TypeScript
- Vite
- CSS (no need for a heavy UI framework)
- Web Audio API for sound generation

The application must:
- Run locally with `npm install` and `npm run dev`.
- Be deployable as a static website.
- Work on desktop and mobile browsers.
- Require no backend or external API.

## 3. Main Interface

Create a clean, minimal interface with the following sections:

### A. Chord Search

At the top of the page:

- An input field to enter a chord symbol.
- Example placeholder: `Try Dmaj7, Am7, G7, C`
- A few clickable example chord buttons.
- Update all visualizations immediately when the chord changes.
- Show a friendly error if the chord notation is invalid or unsupported.

### B. Chord Composition

Display the chord's composition prominently.

Example: Dmaj7

- D — Root (1)
- F# — Major 3rd (3)
- A — Perfect 5th (5)
- C# — Major 7th (7)

Also display:
- Chord name
- Chord type
- Intervals
- Note names

Make the root note visually distinct from the other chord tones.

### C. Interactive Piano Keyboard

Render a realistic piano keyboard.

Requirements:
- Display at least 2 octaves.
- Correctly render white and black keys.
- Highlight all notes belonging to the selected chord.
- Use one color for the root note and another color for the remaining chord tones.
- Display note names on highlighted keys.
- Clicking a key plays its corresponding note.
- Include an option to play the entire chord.
- Include an option to play notes individually (arpeggio).

### D. Interactive Guitar Fretboard

Render a horizontal guitar fretboard.

Requirements:
- Standard 6-string tuning: E A D G B E (low to high).
- Display frets 0–12.
- Clearly label string names and fret numbers.
- Highlight every fret position that corresponds to a note in the selected chord.
- Use the same root/other-note color scheme as the piano.
- Display note names inside highlighted fret positions.
- Clicking a fret plays the corresponding note.
- Allow users to toggle between standard tuning and alternative tunings only if this can be implemented without unnecessary complexity.

Important:
- The piano and guitar must represent the exact same set of pitch classes.
- The fretboard must calculate notes correctly based on standard guitar tuning and semitone intervals.
- Do not simply display arbitrary chord shapes from a static image.
- Highlight all matching chord tones within the displayed fret range.

### E. Audio Controls

Provide three simple controls:

1. Play Chord: Play all chord notes simultaneously.
2. Play Arpeggio: Play notes sequentially.
3. Stop: Stop playback.

Use the Web Audio API.

Requirements:
- Generate sound without external audio files.
- Use a simple piano-like or clean synthesized tone.
- Keep audio implementation lightweight.
- Handle browser audio restrictions by initializing audio after user interaction.

## 4. Chord Theory Engine

Implement a small, reusable chord calculation module.

Support at least:

| Chord Type | Intervals |
|---|---|
| Major | 1, 3, 5 |
| Minor | 1, b3, 5 |
| Diminished | 1, b3, b5 |
| Augmented | 1, 3, #5 |
| Sus2 | 1, 2, 5 |
| Sus4 | 1, 4, 5 |
| Dominant 7 | 1, 3, 5, b7 |
| Major 7 | 1, 3, 5, 7 |
| Minor 7 | 1, b3, 5, b7 |
| Minor Major 7 | 1, b3, 5, 7 |
| Diminished 7 | 1, b3, b5, bb7 |
| Half-diminished 7 | 1, b3, b5, b7 |
| Add9 | 1, 3, 5, 9 |
| Major 9 | 1, 3, 5, 7, 9 |
| Minor 9 | 1, b3, 5, b7, 9 |

Support common chord notation aliases:
- C, Cmaj, Cmajor
- Cm, Cmin
- C7
- Cmaj7, CM7
- Cm7, Cmin7
- Cdim, Caug
- Csus2, Csus4
- Cadd9

Support all 12 root notes, including sharps and flats.

Use correct enharmonic spelling where practical. Keep pitch calculation separate from note spelling.

## 5. Design Requirements

Visual style:
- Minimalist music education application.
- White or light neutral background.
- Clean typography.
- Piano and guitar visualizations should be the main focus.
- Root notes: orange.
- Other chord tones: blue.
- Non-chord notes: neutral gray/white.
- Clear spacing and readable labels.

Suggested layout:

1. Chord search at the top.
2. Chord composition and interval breakdown.
3. Piano keyboard.
4. Guitar fretboard.
5. Audio controls.

Both instruments should update simultaneously when the user changes the chord.

Avoid unnecessary animations, complex navigation, dashboards, or decorative elements.

## 6. Code Structure

Keep the code modular and straightforward.

Suggested structure:

src/
  components/
    ChordSearch.tsx
    ChordInfo.tsx
    PianoKeyboard.tsx
    GuitarFretboard.tsx
    AudioControls.tsx
  utils/
    chordParser.ts
    musicTheory.ts
    guitarNotes.ts
    audio.ts
  App.tsx
  main.tsx

Do not over-engineer the application. Prefer simple functions and readable code over unnecessary abstractions.

## 7. Correctness and Testing

Verify the following examples:

- Dmaj7 = D, F#, A, C#
- D7 = D, F#, A, C
- Dm7 = D, F, A, C
- C = C, E, G
- Am7 = A, C, E, G
- G7 = G, B, D, F

Check that:
- Piano highlights the correct keys.
- Guitar fretboard highlights the correct pitch classes.
- Root notes are visually distinguished.
- Clicking piano keys and guitar frets plays the correct pitches.
- Chord playback and arpeggio playback work.
- Changing the chord updates all components.
- Enharmonic notes are handled consistently.
- Invalid chord input does not crash the application.

## 8. Implementation Instructions

First inspect the existing project structure.

Then:
1. Explain the implementation plan briefly.
2. Build the minimum working version.
3. Run the application and fix any errors.
4. Test the chord calculation logic.
5. Verify the piano and guitar visualizations against the test cases.

Prioritize a working MVP over feature completeness.

Do not add features that are not explicitly requested. Do not introduce unnecessary dependencies.