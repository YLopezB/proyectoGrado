import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, getToken } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext);

// Conexión en tiempo real (Socket.IO), presencia, mensajes sin leer y conversación abierta
export function ChatProvider({ children }) {
  const { user } = useAuth();
  const isPerson = user?.role === 'user';
  const [online, setOnline] = useState(() => new Set());
  const [conversations, setConversations] = useState([]);
  const [peer, setPeer] = useState(null); // persona con la que hay una conversación abierta
  const socketRef = useRef(null);
  const listeners = useRef(new Set());
  const peerRef = useRef(null);
  peerRef.current = peer;

  const loadConversations = useCallback(async () => {
    try { setConversations(await api.get('/chat/conversations')); } catch { /* se reintenta en el próximo evento */ }
  }, []);

  useEffect(() => {
    if (!isPerson) return undefined;
    loadConversations();
    const socket = io({ path: '/socket.io', auth: { token: getToken() }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('presence', (keys) => setOnline(new Set(keys)));
    socket.on('message:new', (msg) => {
      listeners.current.forEach((fn) => fn(msg));
      loadConversations();
    });
    return () => { socket.disconnect(); socketRef.current = null; setOnline(new Set()); setConversations([]); setPeer(null); };
  }, [isPerson, loadConversations]);

  const send = useCallback((to, content) => new Promise((resolve, reject) => {
    const s = socketRef.current;
    if (!s?.connected) return reject(new Error('Sin conexión con el chat. Intenta de nuevo en unos segundos.'));
    s.emit('message:send', { to: String(to), content }, (res) => (res?.ok ? resolve() : reject(new Error(res?.error || 'No se pudo enviar'))));
  }), []);

  const subscribe = useCallback((fn) => { listeners.current.add(fn); return () => listeners.current.delete(fn); }, []);

  const markRead = useCallback(async (key) => {
    try { await api.post('/chat/read', { with: String(key) }); } catch { /* no crítico */ }
    setConversations((c) => c.map((x) => (x.key === String(key) ? { ...x, unread: 0 } : x)));
  }, []);

  const unread = useMemo(
    () => conversations.reduce((n, c) => n + (peer && c.key === String(peer.id) ? 0 : c.unread), 0), [conversations, peer]);

  const value = useMemo(() => ({
    online, conversations, unread, peer, openChat: setPeer, closeChat: () => setPeer(null),
    send, subscribe, markRead, loadConversations, isOnline: (id) => online.has(String(id)),
  }), [online, conversations, unread, peer, send, subscribe, markRead, loadConversations]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
