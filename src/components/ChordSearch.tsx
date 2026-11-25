const EXAMPLES = ['C', 'Am7', 'G7', 'Dmaj7', 'Fm', 'Bbmaj9', 'Bdim7', 'Esus4'];

interface Props {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}

export function ChordSearch({ value, error, onChange }: Props) {
  return (
    <section className="search">
      <label htmlFor="chord-input" className="visually-hidden">
        Chord name
      </label>
      <input
        id="chord-input"
        className={`search-input${error ? ' has-error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Try Dmaj7, Am7, G7, C"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="chip" onClick={() => onChange(ex)}>
            {ex}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
