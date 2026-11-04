import { useState } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth, can } from '../context/AuthContext.jsx';
import { AuthImage, Button, Card, ConfirmModal, Input, cx, useToast } from './ui.jsx';
import { formatDateTime, plural, timeAgo } from '../lib/format.js';

function Comment({ c, me, canModerate, onLike, onDelete, admin }) {
  const mine = c.author_key === me;
  return (
    <div className="rounded-xl bg-tint px-4 py-3.5">
      <p className="text-[13px] font-semibold leading-[1.4] text-ink">{c.author_name}</p>
      <p className="text-[11px] leading-[1.5] text-muted">{[c.author_area, timeAgo(c.created_at)].filter(Boolean).join(' · ')}</p>
      <p className="mt-2.5 whitespace-pre-wrap break-words text-[13px] leading-[1.5] text-ink">{c.body}</p>
      <div className="mt-2.5 flex items-center gap-4">
        {admin ? (
          <Button variant="secondary" size="sm" onClick={onDelete} className="mt-1 px-6 py-2.5">Borrar</Button>
        ) : (
          <>
            <button type="button" onClick={onLike} className={cx('text-[11px] text-brand hover:underline', c.liked && 'font-semibold')}>
              Me gusta{c.likes > 0 ? ` · ${c.likes}` : ''}
            </button>
            {(mine || canModerate) && <button type="button" onClick={onDelete} className="text-[11px] text-muted hover:text-danger hover:underline">Borrar</button>}
          </>
        )}
      </div>
    </div>
  );
}

// Publicación con portada, "Me gusta" y comentarios. admin=true muestra "Editar"/"Borrar" (pantalla Publicaciones)
export default function PostCard({ post, onChange, onDeleted, admin = false, onEdit }) {
  const { user } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(null); // comentario a borrar
  const [confirmPost, setConfirmPost] = useState(false);
  const canModerate = can(user, 'posts');
  const shown = showAll || post.comments.length <= 2 ? post.comments : post.comments.slice(-2);

  async function like() {
    try { const r = await api.post(`/posts/${post.id}/like`); onChange({ ...post, liked: r.liked, likes: r.likes }); } catch (e) { toast.error(e.message); }
  }
  async function likeComment(c) {
    try {
      const r = await api.post(`/posts/comments/${c.id}/like`);
      onChange({ ...post, comments: post.comments.map((x) => (x.id === c.id ? { ...x, liked: r.liked, likes: r.likes } : x)) });
    } catch (e) { toast.error(e.message); }
  }
  async function send(e) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const c = await api.post(`/posts/${post.id}/comments`, { body: text });
      onChange({ ...post, comments: [...post.comments, c] });
      setText('');
    } catch (err) { toast.error(err.message); } finally { setSending(false); }
  }
  async function removeComment() {
    const c = confirm;
    await api.del(`/posts/comments/${c.id}`);
    onChange({ ...post, comments: post.comments.filter((x) => x.id !== c.id) });
    setConfirm(null);
    toast.success('Comentario eliminado');
  }
  async function removePost() {
    await api.del(`/posts/${post.id}`);
    setConfirmPost(false);
    toast.success('Publicación eliminada');
    onDeleted?.(post);
  }

  return (
    <Card className="overflow-hidden">
      <AuthImage fileId={post.cover_file_id} alt={post.cover_alt} className="aspect-video w-full sm:aspect-auto sm:h-[300px]" />
      <div className="px-5 pb-6 pt-6 sm:px-6">
        {admin && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={onEdit} className="px-6 py-3">Editar</Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmPost(true)} className="px-6 py-3">Eliminar</Button>
            {post.audience_area_name && <span className="text-[12px] text-muted">Dirigida a: {post.audience_area_name}</span>}
          </div>
        )}
        <h2 className="text-[24px] font-semibold leading-[1.25] tracking-[-0.01em] text-ink sm:text-[26px]">{post.title}</h2>
        <p className="mt-4 whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">{post.body}</p>
        <p className="mt-5 text-[14px] font-semibold leading-[1.4] text-ink">{post.author_name}</p>
        <p className="text-[11px] leading-[1.6] text-muted">{[post.author_area, formatDateTime(post.created_at)].filter(Boolean).join(' · ')}</p>

        <div className="mt-4 flex items-center gap-5 border-t border-line pt-4 text-[12px]">
          <button type="button" onClick={like} aria-pressed={post.liked} className="flex items-center gap-2 font-semibold text-brand">
            <Heart className="h-[18px] w-[18px]" strokeWidth={1.5} fill={post.liked ? 'currentColor' : 'none'} />{post.likes} Me gusta
          </button>
          <span className="flex items-center gap-2 text-muted"><MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.5} />{plural(post.comments.length, 'comentario', 'comentarios')}</span>
        </div>

        {post.comments.length > 0 && (
          <div className="mt-4 space-y-3">
            {post.comments.length > 2 && !showAll && (
              <button type="button" onClick={() => setShowAll(true)} className="text-[12px] font-semibold text-brand hover:underline">Ver los {post.comments.length} comentarios</button>
            )}
            {shown.map((c) => (
              <Comment key={c.id} c={c} me={user.role === 'admin' ? 'admin' : String(user.id)} canModerate={canModerate} admin={admin}
                onLike={() => likeComment(c)} onDelete={() => setConfirm(c)} />
            ))}
          </div>
        )}
        {!admin && (
          <form onSubmit={send} className="mt-4">
            <Input label="Súmate a la conversación" placeholder="Escribe un comentario…" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} disabled={sending} />
          </form>
        )}
      </div>
      <ConfirmModal open={!!confirm} danger title="Eliminar comentario" message="El comentario se eliminará para todas las personas." confirmLabel="Eliminar" onConfirm={removeComment} onClose={() => setConfirm(null)} />
      <ConfirmModal open={confirmPost} danger title="Eliminar publicación" message="Se eliminará la publicación con sus comentarios y “Me gusta”. Esta acción no se puede deshacer." confirmLabel="Eliminar" onConfirm={removePost} onClose={() => setConfirmPost(false)} />
    </Card>
  );
}
