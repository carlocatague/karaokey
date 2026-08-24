import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ListMusic, Tv, Search } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { searchKaraoke } from '../lib/youtube';
import { getSessionId, getDisplayName } from '../lib/session';
import { getTvMode, setTvMode } from '../lib/tvMode';
import { useYouTubePlayer, formatTime } from '../hooks/useYouTubePlayer';
import { useTvNavigation } from '../hooks/useTvNavigation';
import SearchResultCard from '../components/SearchResultCard';
import TrendingRow from '../components/TrendingRow';
import TVSupportModal from '../components/TVSupportModal';
import GuestMobileStage from '../components/GuestMobileStage';

export default function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const sessionId = getSessionId();
  const displayName = getDisplayName();
  const videoWrapRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [queue, setQueue] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [trending, setTrending] = useState([]);
  const [tab, setTab] = useState('queue');
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [volume, setVolumeState] = useState(80);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tvModeEnabled, setTvModeEnabled] = useState(() => getTvMode() === true);
  const [showTvModal, setShowTvModal] = useState(
    () => Boolean(location.state?.justCreated) && getTvMode() === null
  );
  const hideTimerRef = useRef(null);
  const [scoreOverlay, setScoreOverlay] = useState(null); // { animating, value }
  const scoreTimersRef = useRef([]);
  const [isMobile, setIsMobile] = useState(
  () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
);

useEffect(() => {
  const mq = window.matchMedia('(max-width: 900px)');
  const handler = (e) => setIsMobile(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}, []);

  useTvNavigation(tvModeEnabled);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!displayName) {
      navigate('/');
      return;
    }
    loadRoom();
    loadQueue();
    loadMembers();
    loadTrending();

    const queueChannel = supabase
      .channel(`room-${id}-queue`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_items', filter: `room_id=eq.${id}` },
        () => loadQueue()
      )
      .subscribe();

    const memberChannel = supabase
      .channel(`room-${id}-members`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${id}` },
        () => loadMembers()
      )
      .subscribe();

    const roomChannel = supabase
      .channel(`room-${id}-room`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${id}` },
        () => loadRoom()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(memberChannel);
      supabase.removeChannel(roomChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Debounced live YouTube search as the person types a title/artist
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(runSearch, 600);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const runSearch = useCallback(async () => {
    setSearching(true);
    setSearchError('');
    try {
      const items = await searchKaraoke(query);
      setResults(items);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  }, [query]);

  async function loadRoom() {
    const { data } = await supabase.from('rooms').select('*').eq('id', id).single();
    setRoom(data);
    setLoading(false);
  }

  async function loadQueue() {
    const { data } = await supabase
      .from('queue_items')
      .select('*')
      .eq('room_id', id)
      .order('position', { ascending: true });
    setQueue(data ?? []);
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', id)
      .order('joined_at', { ascending: true });
    setMembers(data ?? []);
  }

  async function loadTrending() {
    const { data } = await supabase
      .from('song_plays')
      .select('*')
      .order('play_count', { ascending: false })
      .limit(10);
    setTrending(data ?? []);
  }

   async function handleAddToQueue(result) {
    if (!isHost && room?.queue_limit != null) {
      const mine = queue.filter(
        (i) => i.session_id === sessionId && i.status !== 'done'
      ).length;
      if (mine >= room.queue_limit) {
        setSearchError(
          `You've hit this room's limit of ${room.queue_limit} queued song${room.queue_limit === 1 ? '' : 's'} per guest.`
        );
        return;
      }
    }
    const position = queue.length;
    const { data: inserted } = await supabase
      .from('queue_items')
      .insert({
        room_id: id,
        video_id: result.videoId,
        title: result.title,
        thumbnail_url: result.thumbnail,
        singer_name: displayName,
        session_id: sessionId,
        position,
      })
      .select()
      .single();

    // If nothing's on stage right now, auto-start whatever was just added --
    // works the same for a guest as it does for the host, so the first song
    // added to an empty queue always kicks things off on its own.
    if (inserted && !playingItem) {
      await markPlaying(inserted);
    }

    setQuery('');
    setResults([]);
    setTab('queue');
  }

  function handleAddTrending(song) {
    handleAddToQueue({
      videoId: song.video_id,
      title: song.title,
      thumbnail: song.thumbnail_url,
    });
  }

  async function markPlaying(item) {
  await supabase.from('queue_items').update({ status: 'playing' }).eq('id', item.id);
  updateRoomSetting({ is_paused: false });
    supabase
      .rpc('increment_song_play', {
        p_video_id: item.video_id,
        p_title: item.title,
        p_thumbnail: item.thumbnail_url,
      })
      .then(() => loadTrending());
  }

  async function markDone(item) {
    await supabase.from('queue_items').update({ status: 'done' }).eq('id', item.id);
  }

    async function handleRemoveReservation(item) {
    // Update the screen immediately rather than waiting on the realtime
    // round-trip -- that keeps working even if this tab doesn't get its
    // own delete event echoed back quickly.
    setQueue((prev) => prev.filter((q) => q.id !== item.id));

    // Guarded by session_id so a guest can only ever delete their own
    // reservation, never someone else's -- independent of guest_controls.
    const { error } = await supabase
      .from('queue_items')
      .delete()
      .eq('id', item.id)
      .eq('session_id', sessionId);

    if (error) {
      // The delete didn't actually go through server-side -- put the row
      // back rather than leaving the screen showing something that's
      // still really in the queue.
      loadQueue();
    }
  }

  function clearScoreTimers() {
    scoreTimersRef.current.forEach(clearTimeout);
    scoreTimersRef.current.forEach(clearInterval);
    scoreTimersRef.current = [];
  }

  function runScoreReveal() {
    return new Promise((resolve) => {
      setScoreOverlay({ animating: true, value: Math.floor(50 + Math.random() * 51) });
      const spin = setInterval(() => {
        setScoreOverlay({ animating: true, value: Math.floor(50 + Math.random() * 51) });
      }, 80);
      scoreTimersRef.current.push(spin);

      const settle = setTimeout(() => {
        clearInterval(spin);
        const finalScore = Math.floor(50 + Math.random() * 51);
        setScoreOverlay({ animating: false, value: finalScore });

        const hide = setTimeout(() => {
          setScoreOverlay(null);
          resolve();
        }, 3000);
        scoreTimersRef.current.push(hide);
      }, 1600);
      scoreTimersRef.current.push(settle);
    });
  }

async function finishPerformance(item, next) {
  player.pause();
  if (room?.scoring_enabled) {
    clearScoreTimers();
    await runScoreReveal();
  }
  await markDone(item);
  if (next) await markPlaying(next);
}

  useEffect(() => clearScoreTimers, []);

  async function reorderQueue(sourceId, targetId) {
    if (sourceId === targetId) return;
    const waitingItems = queue.filter((i) => i.status === 'waiting');
    const sourceIdx = waitingItems.findIndex((i) => i.id === sourceId);
    const targetIdx = waitingItems.findIndex((i) => i.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const reordered = [...waitingItems];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    const newOrder = [playingItem, ...reordered].filter(Boolean);
    const changed = newOrder
      .map((item, idx) => ({ id: item.id, position: idx, changed: item.position !== idx }))
      .filter((i) => i.changed);

    // Optimistic local update so the list reorders instantly
    setQueue((prev) => {
      const positionById = Object.fromEntries(newOrder.map((item, idx) => [item.id, idx]));
      return prev
        .map((item) => (positionById[item.id] !== undefined ? { ...item, position: positionById[item.id] } : item))
        .sort((a, b) => a.position - b.position);
    });

    await Promise.all(
      changed.map(({ id, position }) =>
        supabase.from('queue_items').update({ position }).eq('id', id)
      )
    );
  }

  async function copyCode() {
    if (!room?.code) return;
    navigator.clipboard?.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function endSession() {
    if (!room) return;
    if (!confirm('End this session? This clears the room, its members, and its queue for everyone.')) return;
    await supabase.from('rooms').delete().eq('id', room.id);
    navigate('/');
  }

  function handleEnableTvMode() {
    setTvMode(true);
    setTvModeEnabled(true);
    setShowTvModal(false);
  }

  function handleDismissTvModal() {
    setTvMode(false);
    setShowTvModal(false);
  }

  function toggleTvMode() {
    const next = !tvModeEnabled;
    setTvMode(next);
    setTvModeEnabled(next);
  }

  async function updateRoomSetting(patch) {
    setRoom((prev) => (prev ? { ...prev, ...patch } : prev));
    await supabase.from('rooms').update(patch).eq('id', id);
  }

  function setRoomPaused(paused) {
  updateRoomSetting({ is_paused: paused });
  }

  function toggleGuestControls() {
    updateRoomSetting({ guest_controls: !room?.guest_controls });
  }

  function toggleScoring() {
    updateRoomSetting({ scoring_enabled: !room?.scoring_enabled });
  }

  function adjustQueueLimit(delta) {
    const current = room?.queue_limit;
    if (current == null) {
      // Coming back from "unlimited" -- restart at a sensible default.
      updateRoomSetting({ queue_limit: 10 });
      return;
    }
    const next = Math.max(1, current + delta);
    updateRoomSetting({ queue_limit: next });
  }

  function setQueueLimitInfinite() {
    updateRoomSetting({ queue_limit: null });
  }

  const isHost = room?.host_session_id === sessionId;
  const canControl = isHost || Boolean(room?.guest_controls);
  const playingItem = queue.find((i) => i.status === 'playing');
  const nextUp = queue.find((i) => i.status === 'waiting');
  const upcoming = queue.filter((i) => i.status !== 'done');
  const joinUrl = room ? `${window.location.origin}/?code=${room.code}` : '';
  const hostMember = members.find((m) => m.session_id === room?.host_session_id);
  const hostName = hostMember?.display_name ?? 'the host';

  const player = useYouTubePlayer('yt-stage-player', playingItem?.video_id, {
    loop: loopEnabled,
    onEnded: () => {
      if (!playingItem) return;
      finishPerformance(playingItem, nextUp);
    },
  });

  useEffect(() => {
  if (!player.isReady) return;
  if (room?.is_paused && player.isPlaying) {
    player.pause();
  } else if (!room?.is_paused && !player.isPlaying && playingItem) {
    player.play();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [room?.is_paused, player.isReady]);

  function handleVolumeChange(e) {
    const v = Number(e.target.value);
    setVolumeState(v);
    player.setVolume(v);
  }

  function handleSeekBar(e) {
    player.seekTo(Number(e.target.value));
  }

  function handleFullscreen() {
    videoWrapRef.current?.requestFullscreen?.();
  }

  function revealControls() {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2000);
  }

  useEffect(() => {
    if (!playingItem) {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      return;
    }
    revealControls();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingItem?.id]);

  if (loading) return <div className="page-loading">Loading the room…</div>;
  if (!room) {
    return (
      <div className="page-loading">
        <p>This room has ended or doesn't exist.</p>
        <button className="btn-pill" onClick={() => navigate('/')}>Back to home</button>
      </div>
    );
  }

  if (!isHost && isMobile) {
  return (
          <GuestMobileStage
        room={room}
        playingItem={playingItem}
        queue={queue}
        canControl={canControl}
        hostName={hostName}
        sessionId={sessionId}
        query={query}
        setQuery={setQuery}
        results={results}
        searching={searching}
        searchError={searchError}
        trending={trending}
        onAdd={handleAddToQueue}
        onExit={() => navigate('/')}
        isPlayerPlaying={player.isPlaying}
        onPlay={() => setRoomPaused(false)}
        onPause={() => setRoomPaused(true)}
        onStop={() => finishPerformance(playingItem, null)}
        onSkip={() => finishPerformance(playingItem, nextUp)}
        onRemoveReservation={handleRemoveReservation}
        onReorder={reorderQueue}
      />
  );
}
  
  return (
    <div className="stage-app">
      <div className="stage-main">
        {/* ---- Video stage ---- */}
        <div
          className="stage-video-wrap"
          ref={videoWrapRef}
          onMouseMove={revealControls}
          onMouseEnter={revealControls}
        >
          <div className="stage-topbar-overlay">
            <div className="topbar-left">
              <span className="stage-room-name">{room.name}</span>
              <span className="member-badge">👤 {members.length}</span>
            </div>
            <div className="topbar-right">
              {isHost && (
                <button className="topbar-link" onClick={endSession}>End Session</button>
              )}
              <button
                className="topbar-expand-btn"
                onClick={() => setSidebarCollapsed((v) => !v)}
                title={sidebarCollapsed ? 'Show sidebar' : 'Expand video'}
              >
                {sidebarCollapsed ? '⟨' : '⟩'}
              </button>
            </div>
          </div>

          {/* The inner div gets replaced by YouTube's own <iframe> outside React's
              control, so toggling classes directly on it never actually reaches
              the visible element. Hide/show the stable outer wrapper instead. */}
          <div className={`stage-video-container ${playingItem ? '' : 'stage-video-hidden'}`}>
            <div id="yt-stage-player" className="stage-video" />
          </div>

          {scoreOverlay && (
            <div className="score-overlay">
              <p className="score-overlay-label">
                {scoreOverlay.animating ? 'Scoring…' : 'Performance Score'}
              </p>
              <span className={`score-overlay-value ${scoreOverlay.animating ? 'spinning' : 'landed'}`}>
                {scoreOverlay.value}
              </span>
            </div>
          )}

          {playingItem ? (
            <>
              {player.isReady && !player.isPlaying && (
                <button className="stage-center-overlay" onClick={player.play}>
                  <span className="center-play-ring">▶</span>
                  <span className="center-status">Paused</span>
                  <h3>Song Paused</h3>
                  <p>Press play to continue</p>
                </button>
              )}

              <div className={`stage-bottombar ${controlsVisible ? '' : 'bottombar-hidden'}`}>
                <div className="np-block">
                  <div className="np-info">
                    <p className="np-label">♪ Now playing</p>
                    <h4>{playingItem.title}</h4>
                    <p className="np-requested">Requested by {playingItem.singer_name}</p>
                  </div>

                  <input
                    className="progress-bar"
                    type="range"
                    min="0"
                    max={player.duration || 0}
                    value={Math.min(player.currentTime, player.duration || 0)}
                    onChange={handleSeekBar}
                  />
                  <div className="np-times">
                    <span>{formatTime(player.currentTime)}</span>
                    <span>{formatTime(player.duration)}</span>
                  </div>
                </div>

                <div className="transport-controls">
                  <div className="transport-left">
                    <button className="transport-btn" onClick={() => player.seekRelative(-10)} title="Back 10s">-10</button>
                    <button className="transport-btn primary" onClick={() => setRoomPaused(player.isPlaying)} title={player.isPlaying ? 'Pause' : 'Play'}>
  {player.isPlaying ? '⏸' : '▶'}
</button>
                    {canControl && (
                      <button
                        className="transport-btn"
                        onClick={() => finishPerformance(playingItem, nextUp)}
                        title="End performance"
                      >
                        ■
                      </button>
                    )}
                    <button className="transport-btn" onClick={() => player.seekRelative(10)} title="Forward 10s">+10</button>
                    <span className="transport-time">
                      {formatTime(player.currentTime)} / {formatTime(player.duration)}
                    </span>
                  </div>
                  <div className="transport-right">
                    <span className="transport-icon">🔊</span>
                    <input
                      className="volume-slider"
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={handleVolumeChange}
                    />
                    <button
                      className={`transport-icon-btn ${loopEnabled ? 'active' : ''}`}
                      onClick={() => setLoopEnabled((v) => !v)}
                      title="Loop"
                    >
                      ⟲
                    </button>
                    <button className="transport-icon-btn" onClick={handleFullscreen} title="Fullscreen">⛶</button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="stage-empty-full">
              {nextUp ? (
                <>
                  <img src={nextUp.thumbnail_url} alt="" className="stage-empty-thumb" />
                  <div className="stage-empty-overlay">
                    <p className="eyebrow">Up next · requested by {nextUp.singer_name}</p>
                    <h3>{nextUp.title}</h3>
                    {canControl && (
                      <button className="btn-pill" onClick={() => markPlaying(nextUp)}>
                        ▶ Play on stage
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="stage-waiting">
                  <div className="waiting-qr">
                    <QRCodeSVG value={joinUrl} size={172} bgColor="#ffffff" fgColor="#05040a" />
                  </div>
                  <p className="muted">Scan the QR code or enter the room code</p>
                  <p className="waiting-code">{room.code}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- Sidebar ---- */}
        <aside className={`stage-sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <div className="sidebar-tabs">
            <button className={tab === 'queue' ? 'active' : ''} onClick={() => setTab('queue')}>
              ☰ Queue ({upcoming.length})
            </button>
            <button className={tab === 'add' ? 'active' : ''} onClick={() => setTab('add')}>
              🔍 Add Song
            </button>
            <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
              ⚙ Settings
            </button>
          </div>

          <div className="sidebar-content">
            {tab === 'queue' && (
              upcoming.length === 0 ? (
                <div className="sidebar-empty">
                  <div className="sidebar-empty-icon">
                    <ListMusic size={22} />
                  </div>
                  <p className="sidebar-empty-title">Queue is empty</p>
                  <p className="muted small">Add some songs to get started</p>
                </div>
              ) : (
                <ul className="sidebar-queue-list">
                  {upcoming.map((item) => (
                    <li
                      key={item.id}
                      className={`sidebar-queue-row ${item.status === 'playing' ? 'is-playing' : ''} ${dragOverId === item.id ? 'drag-over' : ''}`}
                      draggable={isHost && item.status === 'waiting'}
                      onDragStart={() => setDragId(item.id)}
                      onDragEnter={() => item.status === 'waiting' && setDragOverId(item.id)}
                      onDragOver={(e) => item.status === 'waiting' && e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragId) reorderQueue(dragId, item.id);
                        setDragId(null);
                        setDragOverId(null);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOverId(null);
                      }}
                    >
                      {isHost && item.status === 'waiting' && (
                        <span className="drag-handle" title="Drag to reorder">⠿</span>
                      )}
                      <img src={item.thumbnail_url} alt="" />
                      <div className="sidebar-queue-info">
                        <strong title={item.title}>{item.title}</strong>
                        <span className="sidebar-requester">
                          <span className="requester-avatar">{item.singer_name?.[0]?.toUpperCase() ?? '?'}</span>
                          {item.singer_name}
                        </span>
                      </div>
                      {item.status === 'playing' && <span className="badge-live">Live</span>}
                    </li>
                  ))}
                </ul>
              )
            )}

            {tab === 'add' && (
              <div className="sidebar-search">
                <div className="search-bar-wrap">
                  <Search size={16} className="search-bar-icon" />
                  <input
                    className="search-bar with-icon"
                    placeholder="Search for karaoke songs…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                {searching && <p className="muted small">Searching YouTube…</p>}
                {searchError && <div className="form-error">{searchError}</div>}
                {results.length > 0 && (
                  <div className="sidebar-result-list">
                    {results.map((r) => (
                      <SearchResultCard key={r.videoId} result={r} onAdd={handleAddToQueue} />
                    ))}
                  </div>
                )}
                {query.trim().length < 2 && trending.length > 0 && (
                  <div className="trending-section">
                    <p className="trending-heading">🔥 Trending on Kara<span className="brand-okey">OKEY!</span></p>
                    <div className="sidebar-result-list">
                      {trending.map((song, i) => (
                        <TrendingRow key={song.video_id} rank={i + 1} song={song} onAdd={handleAddTrending} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'settings' && (
              <div className="sidebar-settings">
                <h3>{room.name}</h3>
                <div className="room-qr">
                  <QRCodeSVG value={joinUrl} size={128} bgColor="transparent" fgColor="#f5f1ff" />
                </div>
                <button className="room-code-btn" onClick={copyCode}>
                  <span className="room-code-label">Room code</span>
                  <span className="room-code-value">{room.code} {copied ? '✓' : '⧉'}</span>
                </button>

                <div className="panel-divider" />
                <span className="panel-heading">In the room</span>
                <div className="member-chips">
                  {members.map((m) => (
                    <span key={m.id} className="member-chip">{m.display_name}</span>
                  ))}
                </div>

                <div className="panel-divider" />
                <div className="tv-toggle-row">
                  <div>
                    <span className="panel-heading" style={{ marginBottom: 2 }}>TV Remote Mode</span>
                    <p className="muted small" style={{ margin: 0 }}>
                      Navigate this room with a TV remote's D-pad.
                    </p>
                  </div>
                  <button
                    className={`tv-toggle ${tvModeEnabled ? 'on' : ''}`}
                    onClick={toggleTvMode}
                    role="switch"
                    aria-checked={tvModeEnabled}
                    title={tvModeEnabled ? 'Disable TV remote mode' : 'Enable TV remote mode'}
                  >
                    <span className="tv-toggle-knob" />
                  </button>
                </div>
                <button
                  className="tv-recheck-link"
                  onClick={() => setShowTvModal(true)}
                >
                  Show the "Is this a TV?" prompt again
                </button>

                <div className="panel-divider" />
                <div className="tv-toggle-row">
                  <div>
                    <span className="panel-heading" style={{ marginBottom: 2 }}>Guest Controls</span>
                    <p className="muted small" style={{ margin: 0 }}>
                      Allow guests to control their own song playback
                    </p>
                  </div>
                  <button
                    className={`tv-toggle ${room.guest_controls ? 'on' : ''}`}
                    onClick={isHost ? toggleGuestControls : undefined}
                    disabled={!isHost}
                    role="switch"
                    aria-checked={Boolean(room.guest_controls)}
                    title={isHost ? 'Toggle guest controls' : 'Only the host can change this'}
                  >
                    <span className="tv-toggle-knob" />
                  </button>
                </div>

                <div className="panel-divider" />
                <div className="tv-toggle-row">
                  <div>
                    <span className="panel-heading" style={{ marginBottom: 2 }}>Queue Limit / Guest</span>
                    <p className="muted small" style={{ margin: 0 }}>
                      Max songs one guest can have queued
                    </p>
                  </div>
                  <div className="stepper">
                    <button
                      className="stepper-btn"
                      onClick={() => adjustQueueLimit(-1)}
                      disabled={!isHost || room.queue_limit == null}
                      title="Decrease"
                    >
                      −
                    </button>
                    <span className="stepper-value">
                      {room.queue_limit == null ? '∞' : room.queue_limit}
                    </span>
                    <button
                      className="stepper-btn"
                      onClick={() => adjustQueueLimit(1)}
                      disabled={!isHost || room.queue_limit == null}
                      title="Increase"
                    >
                      +
                    </button>
                    <button
                      className={`stepper-btn stepper-infinite ${room.queue_limit == null ? 'active' : ''}`}
                      onClick={setQueueLimitInfinite}
                      disabled={!isHost}
                      title="No limit"
                    >
                      ∞
                    </button>
                  </div>
                </div>

                <div className="panel-divider" />
                <div className="tv-toggle-row">
                  <div>
                    <span className="panel-heading" style={{ marginBottom: 2 }}>Enable Karaoke Scoring</span>
                    <p className="muted small" style={{ margin: 0 }}>
                      Score each singer's mic performance and show results after their song ends
                    </p>
                  </div>
                  <button
                    className={`tv-toggle ${room.scoring_enabled ? 'on' : ''}`}
                    onClick={isHost ? toggleScoring : undefined}
                    disabled={!isHost}
                    role="switch"
                    aria-checked={Boolean(room.scoring_enabled)}
                    title={isHost ? 'Toggle karaoke scoring' : 'Only the host can change this'}
                  >
                    <span className="tv-toggle-knob" />
                  </button>
                </div>

                {isHost && (
                  <>
                    <div className="panel-divider" />
                    <button className="btn-ghost full" onClick={endSession}>End session</button>
                  </>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {showTvModal && (
        <TVSupportModal onEnable={handleEnableTvMode} onClose={handleDismissTvModal} />
      )}
    </div>
  );
}
