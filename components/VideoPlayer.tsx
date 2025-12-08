import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PlayerState } from '../types';
import { db } from '../services/firebase';

interface VideoPlayerProps {
  roomId: string;
  playerState: PlayerState;
  isHost: boolean; // Not strictly needed for p2p sync, but good for permissions if needed later
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ roomId, playerState }) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  
  // Ref to track if the last update came from us or the DB to prevent loops
  const isRemoteUpdate = useRef(false);
  const syncIntervalRef = useRef<number | null>(null);

  // Initialize YouTube API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = loadPlayer;
    } else {
      loadPlayer();
    }

    return () => {
        if(syncIntervalRef.current) window.clearInterval(syncIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlayer = () => {
    if (playerRef.current) return; // Already loaded

    playerRef.current = new window.YT.Player('yt-player-iframe', {
      height: '100%',
      width: '100%',
      videoId: playerState.videoId || 'dQw4w9WgXcQ', // Default fallback
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        disablekb: 0,
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onError: (e: any) => console.error("Player Error:", e)
      },
    });
  };

  const onPlayerReady = () => {
    setIsReady(true);
  };

  const updateDbState = useCallback(async (newState: Partial<PlayerState>) => {
    if (isRemoteUpdate.current) return; // Don't echo back remote changes
    
    try {
      const roomRef = db.collection('rooms').doc(roomId);
      await roomRef.update({
        [`playerState.lastUpdated`]: Date.now(),
        ...Object.keys(newState).reduce((acc, key) => ({
            ...acc,
            [`playerState.${key}`]: (newState as any)[key]
        }), {})
      });
    } catch (err) {
      console.error("Error updating room state:", err);
    }
  }, [roomId]);

  const onPlayerStateChange = (event: any) => {
    if (isRemoteUpdate.current) return;

    const player = event.target;
    const state = player.getPlayerState();
    const time = player.getCurrentTime();

    if (state === window.YT.PlayerState.PLAYING) {
      updateDbState({ isPlaying: true, currentTime: time });
    } else if (state === window.YT.PlayerState.PAUSED) {
      updateDbState({ isPlaying: false, currentTime: time });
    } else if (state === window.YT.PlayerState.BUFFERING) {
        // Optional: Sync buffering state? Usually better to let clients buffer independently
    }
  };

  // Sync Effect: Listen to props (DB changes) and control Player
  useEffect(() => {
    if (!isReady || !playerRef.current || !playerState) return;

    const player = playerRef.current;
    
    // 1. Check Video ID
    try {
        const currentId = player.getVideoData()?.video_id;
        if (playerState.videoId && currentId !== playerState.videoId) {
        console.log("Sync: Loading new video", playerState.videoId);
        isRemoteUpdate.current = true;
        player.loadVideoById(playerState.videoId);
        isRemoteUpdate.current = false;
        // Return early because loadVideo resets state
        return;
        }
    } catch (e) {
        console.warn("Error checking video data", e);
    }

    // 2. Calculate ideal time
    // If playing, add elapsed time since last update
    const now = Date.now();
    const timeSinceUpdate = (now - playerState.lastUpdated) / 1000;
    const idealTime = playerState.isPlaying 
      ? playerState.currentTime + timeSinceUpdate 
      : playerState.currentTime;

    const localTime = player.getCurrentTime();
    const timeDiff = Math.abs(localTime - idealTime);

    isRemoteUpdate.current = true;

    // 3. Sync Play/Pause
    const playerStateCode = player.getPlayerState();
    const isLocalPlaying = playerStateCode === window.YT.PlayerState.PLAYING;

    if (playerState.isPlaying && !isLocalPlaying) {
      player.playVideo();
    } else if (!playerState.isPlaying && isLocalPlaying) {
      player.pauseVideo();
    }

    // 4. Sync Time (Seek) if drift is too large (> 2 seconds)
    if (timeDiff > 2) {
      console.log(`Sync: Seeking (Drift: ${timeDiff.toFixed(2)}s)`);
      player.seekTo(idealTime, true);
    }

    // Reset lock after a short delay to allow events to settle
    setTimeout(() => {
      isRemoteUpdate.current = false;
    }, 500);

  }, [playerState, isReady]);

  // Periodic Sync Check (Safety Net)
  // Sometimes events are missed. This checks every 5 seconds if we are wildly out of sync
  useEffect(() => {
    if(!isReady) return;

    syncIntervalRef.current = window.setInterval(() => {
        if(!playerRef.current) return;
        const player = playerRef.current;
        const state = player.getPlayerState();
        
        // If we are playing, update DB with current time periodically so new users join at right spot
        // Only if WE are playing
        if (state === window.YT.PlayerState.PLAYING && !isRemoteUpdate.current) {
             // Only update timestamp, don't trigger a full state change unless necessary
             // Actually, limiting writes is better. Let's rely on event listeners for now.
             // But if we are the "host" or generic user, we might want to update the heartbeat.
        }
    }, 5000);

    return () => {
        if(syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    }
  }, [isReady]);

  return (
    <div className="relative w-full pb-[56.25%] bg-black rounded-xl overflow-hidden shadow-2xl border border-primary/30 group">
      <div id="yt-player-iframe" className="absolute top-0 left-0 w-full h-full" />
      
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-surface z-10">
           <i className="fas fa-spinner fa-spin text-4xl text-primary"></i>
        </div>
      )}
      
      {/* Overlay for "No Video" state */}
      {!playerState.videoId && isReady && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-surface z-10 text-center p-6">
            <i className="fas fa-film text-6xl text-gray-600 mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-400">No video playing</h3>
            <p className="text-gray-500">Search or paste a URL to start watching</p>
         </div>
      )}
    </div>
  );
};

export default VideoPlayer;