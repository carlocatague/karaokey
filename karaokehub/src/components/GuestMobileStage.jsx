import { useMemo, useState, useRef, useEffect } from 'react';
import {
  Search,
  ListMusic,
  Heart,
  History,
  Mic,
  LogOut,
  Lock,
  Sparkles,
  TrendingUp,
  Plus,
  Play,
  Pause,
  SkipForward,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { parseSongTitle } from '../lib/utils';
import { toggleFavorite, isFavorited, getFavorites } from '../lib/favorites';

function GuestResultRow({ song, onAdd, playedRecently }) {
  const { title, artist } = parseSongTitle(song.title);
  const [fav, setFav] = useState(() => isFavorited(song.videoId));

  return (
    <div className="gm-row">
      <div className="gm-row-thumb" style={{ backgroundImage: `url(${song.thumbnail})` }} />
      <div className="gm-row-info">
        <h4 title={song.title}>{title}</h4>
        <p>
          {artist || song.channel}
          {song.duration && <span className="gm-row-meta"> • {song.duration}</span>}
        </p>
        {playedRecently && <span className="gm-badge">Played Recently</span>}
      </div>
      <div className="gm-row-actions">
        <button className="gm-add-btn" onClick={() => onAdd(song)}>
          <Plus size={14} /> Add
        </button>
        <button
          className={`gm-heart-btn ${fav ? 'on' : ''}`}
          onClick={() => setFav(toggleFavorite(song).some((f) => f.videoId === song.videoId))}
          title={fav ? 'Remove from favorites' : 'Save to favorites'}
        >
          <Heart size={16} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}

export default function GuestMobileStage({
  room,
  playingItem,
  queue,
  canControl,
  hostName,
  sessionId,
  query,
  setQuery,
  results,
  searching,
  searchError,
  trending,
  onAdd,
  onExit,
  isPlayerPlaying,
  onPlay,
  onPause,
  onStop,
  onSkip,
  onRemoveReservation,
  onReorder,
}) {
  const [navTab, setNavTab] = useState('search');
  const [resultsMode, setResultsMode] = useState('suggestions');

  const recentlyPlayedIds = useMemo(
    () => new Set(queue.filter((i) => i.status === 'done').map((i) => i.video_id)),
    [queue]
  );

  const popularNow = trending;
  const suggestions = useMemo(
    () => [...trending].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)),
    [trending]
  );

  const upcoming = queue.filter((i) => i.status !== 'done');
  const history = queue.filter((i) => i.status === 'done');
  const mySongs = queue.filter((i) => i.session_id === sessionId);
  const favorites = getFavorites();
  const isMySong = playingItem?.session_id === sessionId;
  // Only the person who reserved the song currently playing gets the
  // playback panel -- the room-wide guest_controls setting no longer
  // grants control over someone else's song, only the host can override.
  const showControls = isMySong;

  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const listRef = useState(() => ({ current: null }))[0];

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  function handleAddWithToast(song) {
    onAdd(song);
    const { title } = parseSongTitle(song.title);
    setToast(title || song.title);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }

  function handleDragStart(e, itemId) {
    setDragId(itemId);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handleDragMove(e) {
    if (!dragId || !listRef.current) return;
    const rows = listRef.current.querySelectorAll('[data-qrow]');
    let closestId = null;
    let closestDist = Infinity;
    rows.forEach((row) => {
      const rect = row.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(e.clientY - center);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = row.dataset.qrow;
      }
    });
    if (closestId && closestId !== dragId) setOverId(closestId);
  }

  function handleDragEnd() {
    if (dragId && overId && dragId !== overId) {
      onReorder(dragId, overId);
    }
    setDragId(null);
    setOverId(null);
  }

  return (
    <div className="gm-app">
      <div className="gm-topbar">
        <div className="gm-brand">
          <span>Kara<span className="brand-okey">OKEY!</span></span>
        </div>
        <div className="gm-topbar-right">
          <span className="gm-room-pill">{room.code}</span>
          <button className="gm-exit-btn" onClick={onExit} title="Leave room">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="gm-content">
        {navTab === 'search' && (
          <>
            {playingItem ? (
              <div className="gm-now-playing">
                <p className="gm-now-playing-label">Now playing</p>
                <div className="gm-now-playing-row">
                  <div
                    className="gm-now-playing-thumb"
                    style={{ backgroundImage: `url(${playingItem.thumbnail_url})` }}
                  />
                  <div>
                    <h3>{playingItem.title}</h3>
                    <p><Mic size={12} /> {playingItem.singer_name}</p>
                  </div>
                </div>
                 {showControls ? (
                  <div className="gm-controls-panel">
                    <p className="gm-controls-label">
                      {isMySong ? 'Your song — playback controls' : 'Playback controls'}
                    </p>
                    <div className="gm-controls-row">
                      <button className="gm-ctrl-btn play" onClick={onPlay} disabled={!room?.is_paused}>
                        <Play size={16} /> Play
                      </button>
                      <button className="gm-ctrl-btn pause" onClick={onPause} disabled={Boolean(room?.is_paused)}>
                        <Pause size={16} /> Pause
                      </button>
                      <button className="gm-ctrl-btn danger" onClick={onSkip}>
                        <SkipForward size={16} /> Skip
                      </button>
                    </div>
                  </div>
                ) : (
                    <div className="gm-lock-notice">
                    <Lock size={13} />
                    Only <strong>{playingItem.singer_name}</strong> can control this song.
                  </div>
                )}
              </div>
            ) : (
              <div className="gm-now-playing gm-now-playing-empty">
                <p className="gm-now-playing-label">Nothing on stage yet</p>
                <p className="muted small" style={{ margin: 0 }}>
                  Add a song below to get the party started.
                </p>
              </div>
            )}

            <div className="gm-search-wrap">
              <Search size={16} className="gm-search-icon" />
              <input
                className="gm-search-input"
                placeholder="Search for karaoke songs…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {query.trim().length < 2 && (
              <div className="gm-mode-pills">
                <button
                  className={`gm-mode-pill ${resultsMode === 'suggestions' ? 'active' : ''}`}
                  onClick={() => setResultsMode('suggestions')}
                >
                  <Sparkles size={13} /> Suggestions
                </button>
                <button
                  className={`gm-mode-pill ${resultsMode === 'popular' ? 'active' : ''}`}
                  onClick={() => setResultsMode('popular')}
                >
                  <TrendingUp size={13} /> Popular Now
                </button>
              </div>
            )}

            {searching && <p className="muted small">Searching YouTube…</p>}
            {searchError && <div className="form-error">{searchError}</div>}

            <div className="gm-results">
              {query.trim().length >= 2
                ? results.map((r) => (
                    <GuestResultRow
                      key={r.videoId}
                      song={r}
                      onAdd={handleAddWithToast}
                      playedRecently={recentlyPlayedIds.has(r.videoId)}
                    />
                  ))
                : (resultsMode === 'popular' ? popularNow : suggestions).map((song) => (
                    <GuestResultRow
                      key={song.video_id}
                      song={{
                        videoId: song.video_id,
                        title: song.title,
                        thumbnail: song.thumbnail_url,
                        channel: '',
                      }}
                      onAdd={handleAddWithToast}
                      playedRecently={recentlyPlayedIds.has(song.video_id)}
                    />
                  ))}
              {query.trim().length < 2 && trending.length === 0 && (
                <p className="muted small">Nothing trending yet — be the first to add a song.</p>
              )}
            </div>
          </>
        )}

                {navTab === 'queue' && (
          <div className="gm-list-section">
            <h3>Up next ({upcoming.length})</h3>
            {upcoming.length === 0 ? (
              <p className="muted small">The queue is empty.</p>
            ) : (
              <div ref={(el) => { listRef.current = el; }}>
                {upcoming.map((item) => (
                  <div
                    key={item.id}
                    data-qrow={item.id}
                    className={`gm-simple-row ${overId === item.id ? 'gm-row-over' : ''} ${dragId === item.id ? 'gm-row-dragging' : ''}`}
                  >
                    {item.status === 'waiting' && (
                      <span
                        className="gm-drag-handle"
                        onPointerDown={(e) => handleDragStart(e, item.id)}
                        onPointerMove={handleDragMove}
                        onPointerUp={handleDragEnd}
                        onPointerCancel={handleDragEnd}
                      >
                        <GripVertical size={16} />
                      </span>
                    )}
                    <img src={item.thumbnail_url} alt="" />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.singer_name}</span>
                    </div>
                    {item.status === 'playing' && <span className="badge-live">Live</span>}
                    {item.session_id === sessionId && item.status !== 'playing' && (
                      <button
                        className="gm-delete-btn"
                        onClick={() => onRemoveReservation(item)}
                        title="Remove your reservation"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {navTab === 'favorites' && (
          <div className="gm-list-section">
            <h3>Your favorites</h3>
            {favorites.length === 0 ? (
              <p className="muted small">Tap the heart on a song to save it here.</p>
            ) : (
              favorites.map((song) => (
                <GuestResultRow key={song.videoId} song={song} onAdd={handleAddWithToast} />
              ))
            )}
          </div>
        )}

        {navTab === 'history' && (
          <div className="gm-list-section">
            <h3>Already sung ({history.length})</h3>
            {history.length === 0 ? (
              <p className="muted small">Nothing's been performed yet.</p>
            ) : (
              history.map((item) => (
                <div key={item.id} className="gm-simple-row">
                  <img src={item.thumbnail_url} alt="" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.singer_name}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {navTab === 'mic' && (
          <div className="gm-list-section">
            <h3>Your songs ({mySongs.length})</h3>
            {mySongs.length === 0 ? (
              <p className="muted small">Songs you add will show up here.</p>
            ) : (
                            mySongs.map((item) => (
                <div key={item.id} className="gm-simple-row">
                  <img src={item.thumbnail_url} alt="" />
                  <div>
                    <strong>{item.title}</strong>
                    <span className={`gm-status-tag status-${item.status}`}>{item.status}</span>
                  </div>
                  {item.status === 'waiting' && (
                    <button
                      className="gm-delete-btn"
                      onClick={() => onRemoveReservation(item)}
                      title="Remove your reservation"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

            {toast && (
        <div className="gm-toast">✓ Added "{toast}" to the queue</div>
      )}

      <div className="gm-bottom-nav">
        <button className={navTab === 'search' ? 'active' : ''} onClick={() => setNavTab('search')}>
          <Search size={18} />
          <span>Search</span>
        </button>
        <button className={navTab === 'queue' ? 'active' : ''} onClick={() => setNavTab('queue')}>
          <ListMusic size={18} />
          <span>Queue</span>
        </button>
        <button className={navTab === 'favorites' ? 'active' : ''} onClick={() => setNavTab('favorites')}>
          <Heart size={18} />
          <span>Favorites</span>
        </button>
        <button className={navTab === 'history' ? 'active' : ''} onClick={() => setNavTab('history')}>
          <History size={18} />
          <span>History</span>
        </button>
        <button className={navTab === 'mic' ? 'active' : ''} onClick={() => setNavTab('mic')}>
          <Mic size={18} />
          <span>Mic</span>
        </button>
      </div>
    </div>
  );
}
