import { Plus } from 'lucide-react';
import { parseSongTitle } from '../lib/utils';

export default function TrendingRow({ rank, song, onAdd }) {
  const { title, artist } = parseSongTitle(song.title);
  return (
    <div className="result-row trending-row">
      <span className="trending-rank">{rank}</span>
      <div className="result-row-thumb" style={{ backgroundImage: `url(${song.thumbnail_url})` }} />
      <div className="result-row-info">
        <h4 title={song.title}>{title}</h4>
        <p>
          {artist}
          <span className="result-row-duration"> • {song.play_count} play{song.play_count === 1 ? '' : 's'}</span>
        </p>
      </div>
      <button className="result-row-add" onClick={() => onAdd(song)}>
        <Plus size={15} /> Add
      </button>
    </div>
  );
}
