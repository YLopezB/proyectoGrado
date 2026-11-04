import { useCallback, useEffect, useRef, useState } from 'react';
import { ListChecks, Send, X } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { Avatar, Button, ErrorNote, Input, Modal, cx } from '../components/ui.jsx';
import { firstName, formatTime } from '../lib/format.js';
import { openCreateTask } from '../lib/events.js';

const dayKey = (iso) => new Date(iso).toDateString();
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const date = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  if (d.toDateString() === today.toDateString()) return `HOY · ${date}`;
  if (d.toDateString() === yesterday.toDateString()) return `AYER · ${date}`;
  return date;
}

export default function ChatModal() {
  const { user } = useAuth();
  const chat = useChat();
  const { peer } = chat;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scroller = useRef(null);
  const peerKey = peer ? String(peer.id) : null;

  // Carga el historial al abrir la conversación
  useEffect(() => {
    if (!peerKey) return undefined;
    let alive = true;
    setMessages([]); setText(''); setError(''); setLoading(true);
    api.get(`/chat/messages?with=${peerKey}`)
      .then((m) => { if (alive) { setMessages(m); chat.markRead(peerKey); } })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerKey]);

  // Mensajes nuevos en tiempo real
  useEffect(() => {
    if (!peerKey) return undefined;
    return chat.subscribe((msg) => {
      const mine = msg.sender_key === user.id.toString() && msg.recipient_key === peerKey;
      const theirs = msg.sender_key === peerKey && msg.recipient_key === user.id.toString();
      if (!mine && !theirs) return;
      setMessages((l) => (l.some((m) => m.id === msg.id) ? l : [...l, msg]));
      if (theirs) chat.markRead(peerKey);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerKey, user.id]);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [messages, peerKey]);

  const submit = useCallback(async (e) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true); setError('');
    try { await chat.send(peerKey, content); setText(''); } catch (err) { setError(err.message); } finally { setSending(false); }
  }, [text, sending, chat, peerKey]);

  if (!peer) return null;
  const online = chat.isOnline(peer.id);
  const first = firstName(peer.name);
  let lastDay = null;

  return (
    <Modal open onClose={chat.closeChat} title={`Chat con ${peer.name}`} width={404} panel>
      <div className="flex items-center gap-3 px-6 pb-4 pt-6">
        <Avatar fileId={peer.photo_file_id} name={peer.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-[1.35] text-ink">{peer.name}</p>
          <p className="truncate text-[12px] leading-[1.4] text-muted">{[peer.position_name, online ? 'En línea' : 'Sin conexión'].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" onClick={chat.closeChat} aria-label="Cerrar chat" className="rounded-lg p-1.5 text-brand hover:bg-tint"><X className="h-5 w-5" strokeWidth={1.5} /></button>
      </div>
      <div className="mx-6 border-t border-line" />

      <div ref={scroller} className="min-h-[200px] flex-1 overflow-y-auto px-6 py-4">
        {loading && <p className="py-6 text-center text-[12px] text-muted">Cargando conversación…</p>}
        {!loading && messages.length === 0 && <p className="py-8 text-center text-[13px] text-muted">Aún no hay mensajes. Escribe el primero a {first}.</p>}
        {messages.map((m) => {
          const mine = m.sender_key === String(user.id);
          const sep = dayKey(m.created_at) !== lastDay;
          lastDay = dayKey(m.created_at);
          return (
            <div key={m.id}>
              {sep && <p className="my-3 text-center text-[11px] tracking-wide text-muted">{dayLabel(m.created_at)}</p>}
              <div className={cx('mb-4 flex items-start gap-2.5', mine && 'flex-row-reverse')}>
                <Avatar fileId={mine ? user.photoFileId : peer.photo_file_id} name={mine ? user.name : peer.name} size={32} />
                <div className={cx('max-w-[82%] rounded-[18px] px-4 py-3', mine ? 'bg-tint' : 'bg-page')}>
                  <p className="text-[11px] font-semibold leading-[1.4] text-brand">{mine ? `${user.name} · Tú` : m.sender_name}</p>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-[1.5] text-ink">{m.content}</p>
                  <p className="mt-1 text-right text-[10px] text-muted">{formatTime(m.created_at)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-6">
        <div className="flex flex-wrap gap-2.5 pb-4">
          <Button variant="secondary" size="sm" icon={ListChecks} onClick={() => openCreateTask(peer)}>Crear tarea</Button>
        </div>
        <div className="border-t border-line" />
      </div>
      <form onSubmit={submit} className="px-6 pb-6 pt-4">
        {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}
        <Input label="Nuevo mensaje" placeholder="Escribe un mensaje…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} autoFocus autoComplete="off" />
        <Button type="submit" icon={Send} loading={sending} disabled={!text.trim()} className="mt-4 px-6 py-3.5 text-[15px]">Enviar mensaje</Button>
        <p className="mt-4 text-[11px] text-muted">Solo tú y {first} pueden ver esta conversación.</p>
      </form>
    </Modal>
  );
}
