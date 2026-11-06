import React, { useEffect, useState } from 'react';
import { auth, db, googleProvider } from './services/firebase';
import firebase from 'firebase/compat/app';
import { User, Room, PlayerState } from './types';
import VideoPlayer from './components/VideoPlayer';
import Chat from './components/Chat';
import SearchModal from './components/SearchModal';
import './App.css';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      if (authUser) {
        setUser({
          uid: authUser.uid,
          displayName: authUser.displayName || `Guest-${authUser.uid.substring(0, 4)}`,
          photoURL: authUser.photoURL || '',
          isOnline: true,
          avatarId: Math.floor(Math.random() * 5)
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!room?.id) return;
    const unsubscribe = db.collection('rooms').doc(room.id).onSnapshot((snapshot) => {
      if (snapshot.exists) {
        setRoom({ id: snapshot.id, ...snapshot.data() } as Room);
      } else {
        setError('This room has been closed.');
        setRoom(null);
      }
    });
    return () => unsubscribe();
  }, [room?.id]);

  const handleLogin = async (method: 'google' | 'anon') => {
    setError('');
    try {
      if (method === 'google') await auth.signInWithPopup(googleProvider);
      else await auth.signInAnonymously();
    } catch (e: any) {
      setError(e.message || 'Sign-in failed. Please try again.');
    }
  };

  const handleJoinCreateRoom = async (action: 'join' | 'create') => {
    if (!user) return;
    setError('');
    const roomId = action === 'create'
      ? Math.random().toString(36).substring(2, 8).toUpperCase()
      : roomIdInput.trim().toUpperCase();

    if (!roomId) {
      setError('Enter a room code to join.');
      return;
    }

    const roomRef = db.collection('rooms').doc(roomId);
    try {
      if (action === 'create') {
        const newRoom: Room = {
          id: roomId,
          createdBy: user.uid,
          playerState: {
            isPlaying: false,
            currentTime: 0,
            lastUpdated: Date.now(),
            videoId: '',
            videoTitle: ''
          },
          users: [user]
        };
        await roomRef.set(newRoom);
        setRoom(newRoom);
      } else {
        const snapshot = await roomRef.get();
        if (!snapshot.exists) {
          setError('No room found with that code.');
          return;
        }
        await roomRef.update({ users: firebase.firestore.FieldValue.arrayUnion(user) });
        setRoom({ id: snapshot.id, ...snapshot.data() } as Room);
      }
    } catch (e) {
      console.error(e);
      setError('Could not enter the room. Please try again.');
    }
  };

  const updateVideo = async (video: { id: string; title: string; thumbnail: string }) => {
    if (!room) return;
    try {
      await db.collection('rooms').doc(room.id).update({
        'playerState.videoId': video.id,
        'playerState.videoTitle': video.title,
        'playerState.videoThumbnail': video.thumbnail,
        'playerState.currentTime': 0,
        'playerState.isPlaying': false,
        'playerState.lastUpdated': Date.now()
      });
      setIsSearchOpen(false);
    } catch (e) {
      console.error(e);
      setError('Could not update the room video.');
    }
  };

  const copyRoomCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Could not copy the room code.');
    }
  };

  if (loading) {
    return <main className="app-loading" aria-label="Loading Anime Together"><span className="loading-mark"><i className="fas fa-play" /></span></main>;
  }

  if (!user) {
    return (
      <div className="app-shell auth-screen">
        <header className="topbar auth-topbar">
          <a className="brand" href="#top" aria-label="Anime Together home">
            <span className="brand-mark"><i className="fas fa-play" /></span>
            <span>Anime Together</span>
          </a>
          <span className="topbar-note">Shared anime watch rooms</span>
        </header>
        <main id="top" className="auth-content">
          <section className="auth-copy">
            <p className="eyebrow"><span className="status-dot" />Watch in sync</p>
            <h1>Anime is better<br />watched together.</h1>
            <p className="auth-lead">Create a room, pick a video, and keep playback and chat in one place.</p>
            <div className="auth-actions">
              <button className="button button-primary" onClick={() => handleLogin('google')}>
                <i className="fab fa-google google-mark" /> Continue with Google
              </button>
              <button className="button button-secondary" onClick={() => handleLogin('anon')}>
                <i className="fas fa-user-astronaut" /> Continue as guest
              </button>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <p className="quiet-note">Sign in or join as a guest. No account needed for guest access.</p>
          </section>
          <aside className="room-preview" aria-label="Anime Together room preview">
            <div className="preview-topline"><span className="preview-light" />Room preview <span className="preview-label">Shared playback</span></div>
            <div className="preview-screen">
              <div className="preview-orbit orbit-one" /><div className="preview-orbit orbit-two" />
              <span className="preview-play"><i className="fas fa-play" /></span>
              <span className="preview-screen-label">Your video, in sync</span>
              <div className="preview-progress"><span /></div>
            </div>
            <div className="preview-bottom">
              <div className="preview-feature"><span className="preview-icon"><i className="fas fa-users" /></span><span><strong>Watch together</strong><small>One room for your group</small></span></div>
              <div className="preview-feature"><span className="preview-icon"><i className="far fa-comment-dots" /></span><span><strong>Talk as you watch</strong><small>Room chat beside the video</small></span></div>
            </div>
          </aside>
        </main>
        <footer className="auth-footer"><span>Anime Together</span><span>Sync playback. Share the moment.</span></footer>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="app-shell lobby-screen">
        <header className="topbar lobby-topbar">
          <a className="brand" href="#top" aria-label="Anime Together home"><span className="brand-mark"><i className="fas fa-play" /></span><span>Anime Together</span></a>
          <div className="account-control"><span className="account-avatar">{user.displayName.charAt(0).toUpperCase()}</span><span className="account-name">{user.displayName}</span><button className="icon-button" onClick={() => auth.signOut()} aria-label="Sign out" title="Sign out"><i className="fas fa-arrow-right-from-bracket" /></button></div>
        </header>
        <main id="top" className="lobby-content">
          <section className="lobby-intro"><p className="eyebrow"><span className="status-dot" />Your watch room</p><h1>Where should we<br />watch tonight?</h1><p>Create a private room for your group or join with a room code.</p></section>
          <section className="room-actions" aria-label="Create or join a room">
            <article className="action-card create-card">
              <span className="action-icon"><i className="fas fa-plus" /></span>
              <h2>Create a room</h2><p>Start a shared watch room and invite your friends with its code.</p>
              <button className="button button-primary" onClick={() => handleJoinCreateRoom('create')}>Create room <i className="fas fa-arrow-right" /></button>
            </article>
            <article className="action-card join-card">
              <span className="action-icon"><i className="fas fa-door-open" /></span>
              <h2>Join a room</h2><p>Enter the code shared by your friend to join their video.</p>
              <form className="join-form" onSubmit={(event) => { event.preventDefault(); handleJoinCreateRoom('join'); }}>
                <label htmlFor="room-code">Room code</label>
                <div className="join-input-row"><input id="room-code" type="text" placeholder="Enter room code" value={roomIdInput} onChange={(event) => setRoomIdInput(event.target.value)} autoComplete="off" /><button className="button button-primary join-submit" type="submit" aria-label="Join room"><i className="fas fa-arrow-right" /></button></div>
              </form>
            </article>
            {error && <p className="form-error lobby-error" role="alert">{error}</p>}
          </section>
        </main>
        <footer className="auth-footer"><span>Anime Together</span><span>Room codes use uppercase letters and numbers.</span></footer>
      </div>
    );
  }

  const viewerCount = room.users?.length ?? 0;
  const isPlaying = room.playerState.isPlaying;
  return (
    <div className="app-shell room-screen">
      <header className="topbar room-topbar">
        <a className="brand" href="#top" aria-label="Anime Together home"><span className="brand-mark"><i className="fas fa-play" /></span><span>Anime Together</span></a>
        <div className="room-presence">
          <span className="presence-indicator" /><span className="room-code-label">ROOM</span><strong className="room-code">{room.id}</strong>
          <button className="copy-button" onClick={copyRoomCode}><i className={copied ? 'fas fa-check' : 'far fa-copy'} /> {copied ? 'Copied' : 'Copy code'}</button>
          <span className="presence-divider" />
          <span className="viewer-count"><i className="fas fa-user-group" /> {viewerCount} {viewerCount === 1 ? 'watching' : 'watching'}</span>
        </div>
        <button className="leave-button" onClick={() => setRoom(null)}><i className="fas fa-arrow-right-from-bracket" /><span>Leave room</span></button>
      </header>
      <main id="top" className="room-content">
        <section className="watch-column">
          <div className="watch-heading">
            <div><p className="eyebrow">Now watching</p><h1>{room.playerState.videoTitle || 'Choose an episode'}</h1></div>
            <button className="button button-primary change-video" onClick={() => setIsSearchOpen(true)}><i className="fas fa-magnifying-glass" /> Find a video</button>
          </div>
          <VideoPlayer roomId={room.id} playerState={room.playerState as PlayerState} isHost={room.createdBy === user.uid} />
          <div className="playback-bar"><span className={`playback-status ${isPlaying ? 'is-playing' : ''}`}><i className={isPlaying ? 'fas fa-play' : 'fas fa-pause'} />{isPlaying ? 'Playing' : 'Paused'}</span><span className="playback-note">Playback is shared with everyone in this room</span></div>
          {error && <p className="form-error room-error" role="alert">{error}</p>}
        </section>
        <aside className="chat-column"><Chat roomId={room.id} currentUser={user} currentVideoTitle={room.playerState.videoTitle} /></aside>
      </main>
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={updateVideo} />
    </div>
  );
};

export default App;
