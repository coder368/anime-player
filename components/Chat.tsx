import React, { useState, useEffect, useRef } from 'react';
import { Message, User } from '../types';
import { db } from '../services/firebase';
import firebase from 'firebase/app';
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
    const q = db.collection('rooms').doc(roomId).collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(50);

    const unsubscribe = q.onSnapshot((snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
      console.error("Error sending message:", err);
    }
  };

  const handleAiSuggest = async () => {
    if (!currentVideoTitle) return;
    setIsAiLoading(true);
    
    // Add a local optimistic "Thinking..." message (optional, but good UX)
    // For now, we just rely on button state
    
    const suggestion = await getAnimeSuggestions(currentVideoTitle);
    
    try {
        await db.collection('rooms').doc(roomId).collection('messages').add({
            userId: 'ai-bot',
            username: 'Anime AI 🤖',
            text: suggestion,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'system',
            avatarId: 0
          });
    } catch (err) {
        console.error("Failed to send AI message", err);
    } finally {
        setIsAiLoading(false);
    }
  };

  const getAvatarColor = (id: number) => {
    const colors = ['bg-gray-500', 'bg-blue-500', 'bg-pink-500', 'bg-emerald-500', 'bg-amber-500'];
    return colors[id % colors.length] || colors[0];
  };

  return (
    <div className="flex flex-col h-full bg-dark-surface/90 rounded-xl border border-primary/20 shadow-xl overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-primary/20 bg-dark/50 flex justify-between items-center">
        <h3 className="font-semibold text-primary-light flex items-center gap-2">
          <i className="fas fa-comments"></i> Chat
        </h3>
        {currentVideoTitle && (
            <button 
                onClick={handleAiSuggest}
                disabled={isAiLoading}
                className="text-xs bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-1 rounded-full hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1"
            >
                {isAiLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
                AI Suggest
            </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-10">
                <i className="fas fa-comment-dots text-4xl mb-2 opacity-50"></i>
                <p>No messages yet.</p>
            </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.userId === currentUser.uid;
          const isSystem = msg.type === 'system';
          
          if (isSystem) {
              return (
                  <div key={msg.id} className="flex justify-center my-2">
                      <div className="bg-primary/10 border border-primary/30 text-gray-300 text-xs py-1 px-3 rounded-full flex items-center gap-2">
                          {msg.username === 'Anime AI 🤖' ? <i className="fas fa-robot text-purple-400"></i> : <i className="fas fa-info-circle text-blue-400"></i>}
                          {msg.text}
                      </div>
                  </div>
              )
          }

          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs text-white shadow-lg ${getAvatarColor(msg.avatarId || 1)}`}>
                {msg.username.charAt(0).toUpperCase()}
              </div>
              <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-gray-400 mb-0.5 px-1">{msg.username}</span>
                <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  isMe 
                    ? 'bg-primary text-white rounded-tr-sm' 
                    : 'bg-slate-700 text-gray-100 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-dark/50 border-t border-primary/10">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="w-full bg-dark-surface border border-gray-700 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm transition-all"
          />
          <button 
            type="submit"
            disabled={!input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white hover:bg-primary-light disabled:opacity-50 disabled:hover:bg-primary transition-colors"
          >
            <i className="fas fa-paper-plane text-xs"></i>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;