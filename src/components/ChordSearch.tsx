const EXAMPLES = ['C', 'Am7', 'G7', 'Dmaj7', 'Fm', 'G9', 'Asus4add9', 'Bbmaj9', 'Bdim7', 'Esus4'];

interface Props {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}

export function ChordSearch({ value, error, onChange }: Props) {
  return (
    <div className="search">
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
    </div>
  );
}
