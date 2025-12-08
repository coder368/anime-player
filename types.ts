export interface User {
  uid: string;
  displayName: string;
  photoURL?: string;
  avatarId?: number;
  isOnline: boolean;
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number; // Client timestamp (Date.now())
  videoId: string;
  videoTitle?: string;
  videoThumbnail?: string;
}

export interface Room {
  id: string;
  createdBy: string;
  playerState: PlayerState;
  users: User[];
}

export interface Message {
  id?: string;
  userId: string;
  username: string;
  text: string;
  timestamp: any; // Firestore Timestamp
  type: 'user' | 'system';
  avatarId?: number;
}

export interface SearchResult {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      medium: { url: string };
    };
  };
}