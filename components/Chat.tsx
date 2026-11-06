import React, { useState, useEffect, useRef } from 'react';
import { Message, User } from '../types';
import { db } from '../services/firebase';
import firebase from 'firebase/compat/app';
import { getAnimeSuggestions } from '../services/geminiService';

interface ChatProps {
  roomId: string;
  currentUser: User;
  currentVideoTitle?: string;
}

const Chat: React.FC<ChatProps> = ({ roomId, currentUser, currentVideoTitle }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = db.collection('rooms').doc(roomId).collection('messages').orderBy('timestamp', 'asc').limit(50);
    const unsubscribe = query.onSnapshot((snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Message)));
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!input.trim()) return;
    try {
      await db.collection('rooms').doc(roomId).collection('messages').add({
        userId: currentUser.uid,
        username: currentUser.displayName,
        text: input.trim(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: 'user',
        avatarId: currentUser.avatarId || 1
      });
      setInput('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleAiSuggest = async () => {
    if (!currentVideoTitle) return;
    setIsAiLoading(true);
    try {
      const suggestion = await getAnimeSuggestions(currentVideoTitle);
      await db.collection('rooms').doc(roomId).collection('messages').add({
        userId: 'ai-bot',
        username: 'Anime AI',
        text: suggestion,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: 'system',
        avatarId: 0
      });
    } catch (err) {
      console.error('Failed to send AI message', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <section className="chat-panel" aria-label="Room chat">
      <header className="chat-header">
        <h2 className="chat-title"><i className="far fa-comment-dots" /> Room chat</h2>
        {currentVideoTitle && <button className="ai-button" onClick={handleAiSuggest} disabled={isAiLoading} title="Ask for anime suggestions"><i className={isAiLoading ? 'fas fa-spinner fa-spin' : 'fas fa-wand-magic-sparkles'} /> {isAiLoading ? 'Thinking' : 'Suggest'}</button>}
      </header>
      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && <div className="chat-empty"><i className="far fa-message" /><p>No messages yet. Say hi to your watch party.</p></div>}
        {messages.map((message) => {
          const isMe = message.userId === currentUser.uid;
          if (message.type === 'system') return <div key={message.id} className="chat-system"><i className="fas fa-wand-magic-sparkles" /> {message.text}</div>;
          const avatarClass = `chat-avatar avatar-${(message.avatarId || 0) % 5}`;
          return (
            <div key={message.id} className={`chat-message ${isMe ? 'is-mine' : ''}`}>
              <span className={avatarClass}>{message.username.charAt(0).toUpperCase()}</span>
              <div className="chat-message-body"><span className="chat-username">{isMe ? 'You' : message.username}</span><div className="chat-bubble">{message.text}</div></div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="chat-form">
        <div className="chat-input-row">
          <input className="chat-input" type="text" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Message your room" aria-label="Message your room" />
          <button className="chat-send" type="submit" disabled={!input.trim()} aria-label="Send message"><i className="fas fa-arrow-up" /></button>
        </div>
      </form>
    </section>
  );
};

export default Chat;
