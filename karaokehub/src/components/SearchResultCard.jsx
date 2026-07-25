import { Plus } from 'lucide-react';
import { parseSongTitle } from '../lib/utils';

export default function SearchResultCard({ result, onAdd }) {
  const { title, artist } = parseSongTitle(result.title);
  return (
    <div className="result-row">
      <div className="result-row-thumb" style={{ backgroundImage: `url(${result.thumbnail})` }} />
      <div className="result-row-info">
        <h4 title={result.title}>{title}</h4>
        <p>{artist || result.channel}</p>
      </div>
      <button className="result-row-add" onClick={() => onAdd(result)}>
        <Plus size={15} /> Add
      </button>
    </div>
  );
}
