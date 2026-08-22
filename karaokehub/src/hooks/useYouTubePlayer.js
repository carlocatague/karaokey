import { useEffect, useRef, useState, useCallback } from 'react';

let apiPromise = null;
function loadYouTubeIframeAPI() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiPromise;
}

/**
 * Wraps the real YouTube IFrame Player API so the app gets genuine
 * play/pause state, current time, and duration instead of fire-and-forget
 * postMessage commands.
 */
export function useYouTubePlayer(containerId, videoId, { onEnded, loop } = {}) {
  const playerRef = useRef(null);
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
  let cancelled = false;

  if (!videoId) {
    // Nothing should be playing right now. If a player already exists on
    // this screen, stop it -- this runs on every connected client when the
    // queue updates, not just the browser that ended the song.
    playerRef.current?.pauseVideo?.();
    return;
  }

  loadYouTubeIframeAPI().then((YT) => {
    if (cancelled) return;

    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
      return;
    }

    playerRef.current = new YT.Player(containerId, {
        videoId,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            setIsReady(true);
            setDuration(playerRef.current.getDuration() || 0);
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setDuration(playerRef.current.getDuration() || 0);
            } else if (e.data === YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (e.data === YT.PlayerState.ENDED) {
              setIsPlaying(false);
              if (loopRef.current) {
                playerRef.current.seekTo(0, true);
                playerRef.current.playVideo();
              } else {
                onEndedRef.current?.();
              }
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    const poll = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime() || 0);
      }
    }, 500);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, []);

  const play = useCallback(() => {
  if (typeof playerRef.current?.playVideo === 'function') {
    playerRef.current.playVideo();
  }
}, []);
const pause = useCallback(() => {
  if (typeof playerRef.current?.pauseVideo === 'function') {
    playerRef.current.pauseVideo();
  }
}, []);
const seekTo = useCallback((sec) => {
  if (typeof playerRef.current?.seekTo === 'function') {
    playerRef.current.seekTo(sec, true);
  }
  setCurrentTime(sec);
}, []);
const seekRelative = useCallback((delta) => {
  const t = typeof playerRef.current?.getCurrentTime === 'function'
    ? playerRef.current.getCurrentTime()
    : 0;
  const next = Math.max(0, t + delta);
  if (typeof playerRef.current?.seekTo === 'function') {
    playerRef.current.seekTo(next, true);
  }
  setCurrentTime(next);
}, []);
const setVolume = useCallback((v) => {
  if (typeof playerRef.current?.setVolume === 'function') {
    playerRef.current.setVolume(v);
  }
}, []);

  return {
    isReady,
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    seekTo,
    seekRelative,
    setVolume,
  };
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
