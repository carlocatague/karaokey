import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play, Users, Camera } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getSessionId, setDisplayName } from '../lib/session';
import { generateRoomCode } from '../lib/utils';
import QRScanner from '../components/QRScanner';

const SUBTITLE_PLAIN = 'No account. No app. Just a room code';
const SUBTITLE_REST = ' — start a room, share it, and search any song straight from YouTube.';
const FULL_SUBTITLE = SUBTITLE_PLAIN + SUBTITLE_REST;

export default function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codeFromLink = searchParams.get('code');
  const hostCardRef = useRef(null);
  const joinCardRef = useRef(null);

  const [typedLength, setTypedLength] = useState(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setTypedLength(FULL_SUBTITLE.length);
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setTypedLength(i);
      if (i >= FULL_SUBTITLE.length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, []);

  const typedText = FULL_SUBTITLE.slice(0, typedLength);
  const typedPlainLength = Math.min(typedLength, SUBTITLE_PLAIN.length);
  const typedRest = typedText.slice(typedPlainLength);

  const sparkles = useMemo(
    () =>
      Array.from({ length: 35 }).map((_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 2 + Math.random() * 3,
        delay: Math.random() * 5,
        duration: 2.5 + Math.random() * 3,
      })),
    []
  );

  const [hostName, setHostName] = useState('');
  const [hostBusy, setHostBusy] = useState(false);
  const [hostError, setHostError] = useState('');

  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState(codeFromLink ?? '');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (codeFromLink) setJoinCode(codeFromLink);
  }, [codeFromLink]);

  async function handleCreate(e) {
    e.preventDefault();
    setHostError('');
    if (!hostName.trim()) return;
    setHostBusy(true);
    setDisplayName(hostName.trim());
    const sessionId = getSessionId();
    const code = generateRoomCode();

    const { data: room, error: roomError } = await supabase
  .from('rooms')
  .insert({
    name: `${hostName.trim()}'s Karaoke Room`,
    code,
    host_session_id: sessionId,
    guest_controls: true,
  })
  .select()
  .single();

    if (roomError) {
      setHostBusy(false);
      setHostError(roomError.message);
      return;
    }

    await supabase
      .from('room_members')
      .insert({ room_id: room.id, session_id: sessionId, display_name: hostName.trim() });

    navigate(`/room/${room.id}`, { state: { justCreated: true } });
  }

  async function joinRoomByCode(name, code) {
    setJoinError('');
    if (!name.trim() || !code.trim()) return;
    setJoinBusy(true);
    setDisplayName(name.trim());
    const sessionId = getSessionId();

    const { data: room, error: findError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (findError || !room) {
      setJoinBusy(false);
      setJoinError('No live room found with that code.');
      return;
    }

    await supabase
      .from('room_members')
      .upsert(
        { room_id: room.id, session_id: sessionId, display_name: name.trim() },
        { onConflict: 'room_id,session_id' }
      );

    navigate(`/room/${room.id}`);
  }

  function handleJoin(e) {
    e.preventDefault();
    joinRoomByCode(joinName, joinCode);
  }

  function handleScan(text) {
    setScannerOpen(false);
    let code = text.trim();
    try {
      const url = new URL(text);
      code = url.searchParams.get('code') ?? code;
    } catch {
      // not a URL — treat the raw scanned text as the code
    }
    setJoinCode(code.toUpperCase());
  }

  function handleCardsKeyDown(e) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      joinCardRef.current?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      hostCardRef.current?.focus();
    }
  }

  return (
    <div className="landing">
      <div className="disco-bg" aria-hidden="true">
        {sparkles.map((s) => (
          <span
            key={s.id}
            className="sparkle"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
      </div>

      <section className="start-hero">
        <p className="brand-logo-tag">Okey!</p>
        <h1 className="start-title">
          Kara<span className="brand-okey">OKEY!</span>
        </h1>
        <p className="hero-sub typewriter">
          <strong className="hero-sub-strong">{FULL_SUBTITLE.slice(0, typedPlainLength)}</strong>
          {typedRest}
          {typedLength < FULL_SUBTITLE.length && <span className="typewriter-cursor" aria-hidden="true" />}
        </p>

        <div className="start-cards" onKeyDown={handleCardsKeyDown}>
            <form className="start-card start-card-host" ref={hostCardRef} tabIndex={0} onSubmit={handleCreate}>
            <div className="start-card-head">
              <Play size={16} className="start-card-icon" />
              <h3>Host a Room</h3>
            </div>
            <p className="start-card-desc">Start a new session on this screen and invite friends.</p>

            {hostError && <div className="form-error">{hostError}</div>}

            <input
              placeholder="Room Name (Host)"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              required
              maxLength={24}
            />

            <button className="btn-pill full large" type="submit" disabled={hostBusy}>
              {hostBusy ? 'Starting…' : 'Start Party'}
            </button>
          </form>

            <form className="start-card start-card-join" ref={joinCardRef} tabIndex={0} onSubmit={handleJoin}>
            <div className="start-card-head">
              <Users size={16} className="start-card-icon" />
              <h3>Join the Room</h3>
            </div>
            <p className="start-card-desc">Enter a room code to start queuing songs.</p>

            {joinError && <div className="form-error">{joinError}</div>}

            <input
              placeholder="Your Name (Singer)"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              required
              maxLength={24}
            />

            <div className="room-code-row">
              <input
                className="room-code-input"
                placeholder="ROOM CODE"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                maxLength={5}
                required
                style={{ textTransform: 'uppercase' }}
              />
              <button
                type="button"
                className="camera-btn"
                onClick={() => setScannerOpen(true)}
                title="Scan a room QR code"
              >
                <Camera size={18} />
              </button>
            </div>

            <button className="btn-dark full" type="submit" disabled={joinBusy}>
              {joinBusy ? 'Joining…' : 'Join Room'}
            </button>
          </form>
        </div>

        <p className="page-copyright">
          Kara<span className="brand-okey">OKEY!</span> by <span className="hero-sub-strong">Carlo Catague</span> — All Rights Reserved
        </p>
      </section>

      {scannerOpen && (
        <QRScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />
      )}
    </div>
  );
}
