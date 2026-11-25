# Chord Visualizer

An interactive music-theory tool for beginners learning piano and guitar chords.

- Type a chord (e.g. `Dmaj7`, `Am7`, `G7`) to see its notes, intervals, piano keys and guitar fretboard
- Playable guitar chord shapes with finger numbers
- Chord progressions with automatically chosen guitar shapes (least hand movement) and smooth piano voicings
- Save progressions as measures and arrange them into a whole song
- Real recorded piano and guitar sounds (Web Audio API)

## Run locally

```bash
npm install
npm run dev      # start the dev server
npm test         # run the unit tests
npm run build    # production build in dist/
```

The build is a static site — `dist/` can be hosted anywhere (GitHub Pages, Netlify, Vercel…).

## Credits

Audio samples (in `public/samples/`):

- **Piano:** [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, licensed [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- **Guitar:** acoustic guitar samples from [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) by Nicholaus Brosowsky, licensed [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)
