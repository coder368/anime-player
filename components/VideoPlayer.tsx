import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PlayerState } from '../types';
import { db } from '../services/firebase';

interface VideoPlayerProps {
  roomId: string;
  playerState: PlayerState;
  isHost: boolean;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ roomId, playerState }) => {
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const isRemoteUpdate = useRef(false);
  const syncIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const loadPlayer = () => {
      if (playerRef.current || !window.YT?.Player) return;
      playerRef.current = new window.YT.Player('yt-player-iframe', {
        height: '100%',
        width: '100%',
        videoId: playerState.videoId || 'dQw4w9WgXcQ',
        playerVars: { autoplay: 0, controls: 1, rel: 0, modestbranding: 1, disablekb: 0 },
        events: { onReady: () => setIsReady(true), onStateChange: onPlayerStateChange, onError: (event: any) => console.error('Player Error:', event) }
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      window.onYouTubeIframeAPIReady = loadPlayer;
      document.head.appendChild(tag);
    } else {
      loadPlayer();
    }
    return () => { if (syncIntervalRef.current) window.clearInterval(syncIntervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDbState = useCallback(async (newState: Partial<PlayerState>) => {
    if (isRemoteUpdate.current) return;
    try {
      await db.collection('rooms').doc(roomId).update({
        'playerState.lastUpdated': Date.now(),
        ...Object.keys(newState).reduce((acc, key) => ({ ...acc, [`playerState.${key}`]: (newState as any)[key] }), {})
      });
    } catch (err) {
      console.error('Error updating room state:', err);
    }
  }, [roomId]);

  const onPlayerStateChange = (event: any) => {
    if (isRemoteUpdate.current) return;
    const player = event.target;
    const state = player.getPlayerState();
    const time = player.getCurrentTime();
    if (state === window.YT.PlayerState.PLAYING) updateDbState({ isPlaying: true, currentTime: time });
    else if (state === window.YT.PlayerState.PAUSED) updateDbState({ isPlaying: false, currentTime: time });
  };

  useEffect(() => {
    if (!isReady || !playerRef.current || !playerState) return;
    const player = playerRef.current;
    try {
      const currentId = player.getVideoData()?.video_id;
      if (playerState.videoId && currentId !== playerState.videoId) {
        isRemoteUpdate.current = true;
        player.loadVideoById(playerState.videoId);
        isRemoteUpdate.current = false;
        return;
      }
    } catch (err) {
      console.warn('Error checking video data', err);
    }

    const elapsed = (Date.now() - playerState.lastUpdated) / 1000;
    const idealTime = playerState.isPlaying ? playerState.currentTime + elapsed : playerState.currentTime;
    const localTime = player.getCurrentTime();
    isRemoteUpdate.current = true;
    const playerStateCode = player.getPlayerState();
    const isLocalPlaying = playerStateCode === window.YT.PlayerState.PLAYING;
    if (playerState.isPlaying && !isLocalPlaying) player.playVideo();
    else if (!playerState.isPlaying && isLocalPlaying) player.pauseVideo();
    if (Math.abs(localTime - idealTime) > 2) player.seekTo(idealTime, true);
    window.setTimeout(() => { isRemoteUpdate.current = false; }, 500);
  }, [playerState, isReady]);

  useEffect(() => {
    if (!isReady) return;
    syncIntervalRef.current = window.setInterval(() => {
      if (!playerRef.current) return;
      const player = playerRef.current;
      const state = player.getPlayerState();
      if (state === window.YT.PlayerState.PLAYING && !isRemoteUpdate.current) {
        // Keep the player's local timeline independent between room updates.
      }
    }, 5000);
    return () => { if (syncIntervalRef.current) window.clearInterval(syncIntervalRef.current); };
  }, [isReady]);

  return (
    <div className="video-frame">
      <div id="yt-player-iframe" />
      {!isReady && <div className="video-loading" aria-label="Loading video player"><i className="fas fa-spinner fa-spin" /></div>}
      {!playerState.videoId && isReady && <div className="video-empty"><span className="video-empty-icon"><i className="fas fa-film" /></span><h2>No video selected</h2><p>Search for a video to start watching together.</p></div>}
    </div>
  );
};

export default VideoPlayer;
