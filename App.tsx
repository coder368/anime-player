import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider } from './services/firebase';
import firebase from 'firebase/app';
import { User, Room, PlayerState } from './types';
import VideoPlayer from './components/VideoPlayer';
import Chat from './components/Chat';
import SearchModal from './components/SearchModal';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [error, setError] = useState('');

  // Auth Listener
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((authUser) => {
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
    return () => unsub();
  }, []);

  // Room Listener
  useEffect(() => {
    if (!room?.id) return;

    const unsub = db.collection('rooms').doc(room.id).onSnapshot((docSnap) => {
      if (docSnap.exists) {
        setRoom({ id: docSnap.id, ...docSnap.data() } as Room);
      } else {
        setError('Room was deleted or closed.');
        setRoom(null);
      }
    });

    return () => unsub();
  }, [room?.id]);

  const handleLogin = async (method: 'google' | 'anon') => {
    try {
      if (method === 'google') await auth.signInWithPopup(googleProvider);
      else await auth.signInAnonymously();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleJoinCreateRoom = async (action: 'join' | 'create') => {
    if (!user) return;
    setError('');
    
    const roomId = action === 'create' 
      ? Math.random().toString(36).substring(2, 8).toUpperCase() 
      : roomIdInput.trim().toUpperCase();

    if (!roomId) {
        setError("Please enter a Room ID");
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
        const snap = await roomRef.get();
        if (snap.exists) {
          await roomRef.update({
            users: firebase.firestore.FieldValue.arrayUnion(user)
          });
          setRoom({ id: snap.id, ...snap.data() } as Room);
        } else {
          setError('Room not found!');
        }
      }
    } catch (e: any) {
      console.error(e);
      setError('Failed to enter room.');
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
      // Send System Message
      // System message handling is done in Chat component or separate triggers in a real app.
      setIsSearchOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeave = () => {
      // In real app, remove user from array
      setRoom(null);
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-primary"><i className="fas fa-spinner fa-spin text-4xl"></i></div>;

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-dark to-dark-surface">
        <div className="bg-dark-surface p-8 rounded-2xl border border-primary/20 shadow-2xl max-w-md w-full backdrop-blur-lg">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
              Anime Sync
            </h1>
            <p className="text-gray-400">Watch together, in perfect harmony.</p>
          </div>
          
          <div className="space-y-4">
            <button 
              onClick={() => handleLogin('google')}
              className="w-full py-4 bg-white text-gray-800 rounded-xl font-semibold hover:bg-gray-100 transition-all flex items-center justify-center gap-3 shadow-lg"
            >
              <i className="fab fa-google text-red-500"></i> Continue with Google
            </button>
            <button 
              onClick={() => handleLogin('anon')}
              className="w-full py-4 bg-primary/10 border border-primary/30 text-primary-light rounded-xl font-semibold hover:bg-primary/20 transition-all flex items-center justify-center gap-3"
            >
              <i className="fas fa-user-secret"></i> Continue as Guest
            </button>
          </div>
          {error && <p className="mt-4 text-red-400 text-center text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  // Room Selection Screen
  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 right-4 flex items-center gap-3">
            <span className="text-gray-400">Hi, {user.displayName}</span>
            <button onClick={() => auth.signOut()} className="text-red-400 hover:text-red-300"><i className="fas fa-sign-out-alt"></i></button>
        </div>

        <div className="bg-dark-surface p-8 rounded-2xl border border-primary/20 shadow-2xl max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <i className="fas fa-door-open text-primary"></i> Join or Create
            </h2>
            
            <div className="space-y-6">
                <div>
                    <button 
                        onClick={() => handleJoinCreateRoom('create')}
                        className="w-full py-4 bg-gradient-to-r from-primary to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-primary/25 hover:-translate-y-1 transition-all"
                    >
                        Create New Room
                    </button>
                </div>
                
                <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-gray-700"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-500 text-sm">OR JOIN EXISTING</span>
                    <div className="flex-grow border-t border-gray-700"></div>
                </div>

                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="ENTER ROOM ID"
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.target.value)}
                        className="flex-1 bg-dark border border-gray-700 rounded-xl px-4 py-3 text-center tracking-widest uppercase focus:outline-none focus:border-primary text-white font-mono"
                    />
                    <button 
                        onClick={() => handleJoinCreateRoom('join')}
                        className="px-6 py-3 bg-gray-700 rounded-xl hover:bg-gray-600 transition-colors"
                    >
                        <i className="fas fa-arrow-right"></i>
                    </button>
                </div>
                {error && <p className="text-red-400 text-center text-sm">{error}</p>}
            </div>
        </div>
      </div>
    );
  }

  // Room View
  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 bg-dark-surface/80 p-4 rounded-xl border border-gray-800 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-4">
            <div className="bg-primary/20 p-2 rounded-lg">
                <i className="fas fa-film text-primary text-xl"></i>
            </div>
            <div>
                <h1 className="font-bold text-lg text-white leading-tight">Room: <span className="font-mono text-primary-light">{room.id}</span></h1>
                <p className="text-xs text-gray-400">{room.users.length} watching now</p>
            </div>
        </div>
        
        <div className="flex gap-3">
            <button 
                onClick={() => navigator.clipboard.writeText(room.id)}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
            >
                <i className="fas fa-copy"></i> Copy ID
            </button>
            <button 
                onClick={handleLeave}
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm hover:bg-red-500 hover:text-white transition-all"
            >
                <i className="fas fa-door-open mr-2"></i> Leave
            </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Video Player */}
        <div className="lg:col-span-2 flex flex-col gap-4">
            <VideoPlayer roomId={room.id} playerState={room.playerState} isHost={room.createdBy === user.uid} />
            
            {/* Controls */}
            <div className="bg-dark-surface p-4 rounded-xl border border-gray-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex-1 w-full sm:w-auto overflow-hidden">
                    <h2 className="text-white font-medium truncate">
                        {room.playerState.videoTitle || "No video selected"}
                    </h2>
                    <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${room.playerState.isPlaying ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                        {room.playerState.isPlaying ? 'Playing' : 'Paused'}
                    </p>
                </div>
                
                <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary-light text-white rounded-xl font-semibold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                    <i className="fas fa-search"></i> Change Video
                </button>
            </div>
        </div>

        {/* Right: Chat */}
        <div className="lg:h-[calc(100vh-140px)] h-[500px]">
            <Chat roomId={room.id} currentUser={user} currentVideoTitle={room.playerState.videoTitle} />
        </div>
      </div>

      <SearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onSelect={updateVideo}
      />
    </div>
  );
};

export default App;