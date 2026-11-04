import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ImagePlus, Plus } from 'lucide-react';
import { api } from '../../api/client.js';
import { useApi } from '../../hooks/useApi.js';
import { AuthImage, Button, Card, EmptyState, ErrorNote, FullSpinner, Input, PageHeader, Select, Textarea, useToast } from '../../components/ui.jsx';
import PostCard from '../../components/PostCard.jsx';
import { formatBytes } from '../../lib/format.js';

export function PostsList() {
  const nav = useNavigate();
  const [posts, setPosts] = useState(null);
  useEffect(() => { api.get('/posts?limit=50').then(setPosts).catch(() => setPosts([])); }, []);
  const update = (np) => setPosts((l) => l.map((p) => (p.id === np.id ? np : p)));
  return (
    <div className="max-w-[1112px]">
      <PageHeader eyebrow="Administración / Publicaciones" title="Publicaciones" subtitle="Comparte una idea, una noticia o algo que merezca celebrarse."
        action={<Button icon={Plus} onClick={() => nav('/admin/publicaciones/nueva')}>Crear publicación</Button>} />
      <Card className="p-5 sm:p-[23px]">
        <h2 className="mb-5 text-[20px] font-semibold text-ink">Contenido</h2>
        {posts === null ? <FullSpinner /> : posts.length === 0 ? (
          <EmptyState title="Aún no hay publicaciones">Crea la primera con “Crear publicación”.</EmptyState>
        ) : (
          <div className="space-y-8">
            {posts.map((p) => <PostCard key={p.id} post={p} admin onChange={update} onDeleted={(x) => setPosts((l) => l.filter((q) => q.id !== x.id))} onEdit={() => nav(`/admin/publicaciones/${p.id}/editar`)} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

export function PostForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const editing = !!id;
  const { data: areas } = useApi('/areas');
  const [loaded, setLoaded] = useState(!editing);
  const [f, setF] = useState({ title: '', cover_alt: '', body: '', audience_area_id: '', cover_file_id: '' });
  const [cover, setCover] = useState(null); // { name, size, preview }
  const [errs, setErrs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const input = useRef(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  useEffect(() => {
    if (!editing) return;
    api.get('/posts?limit=50').then((all) => {
      const p = all.find((x) => String(x.id) === id);
      if (!p) { toast.error('La publicación no existe'); return nav('/admin/publicaciones', { replace: true }); }
      setF({ title: p.title, cover_alt: p.cover_alt || '', body: p.body, audience_area_id: p.audience_area_id ?? '', cover_file_id: p.cover_file_id });
      setLoaded(true);
    }).catch(() => nav('/admin/publicaciones', { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function pickCover(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setErrs((e) => ({ ...e, cover: 'La imagen puede pesar máximo 10 MB' }));
    setUploading(true); setErrs((e) => ({ ...e, cover: '' }));
    try {
      const fd = new FormData(); fd.append('context', 'post'); fd.append('files', file);
      const [saved] = await api.upload('/files', fd);
      setF((s) => ({ ...s, cover_file_id: saved.id }));
      setCover({ name: file.name, size: file.size, preview: URL.createObjectURL(file) });
    } catch (err) { setErrs((e) => ({ ...e, cover: err.message })); } finally { setUploading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!f.title.trim()) er.title = 'Escribe un título';
    if (!f.cover_file_id) er.cover = 'Agrega una imagen de portada';
    if (!f.body.trim()) er.body = 'Escribe la descripción';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true); setError('');
    try {
      const body = { ...f, audience_area_id: f.audience_area_id === '' ? null : Number(f.audience_area_id) };
      if (editing) await api.put(`/posts/${id}`, body); else await api.post('/posts', body);
      toast.success(editing ? 'Publicación actualizada' : 'Publicación creada');
      nav('/admin/publicaciones');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (!loaded) return <FullSpinner />;
  return (
    <div className="max-w-[1112px]">
      <PageHeader eyebrow={`Administración / Publicaciones / ${editing ? 'Editar' : 'Nueva'}`} title={editing ? 'Editar publicación' : 'Crear publicación'} subtitle="Comparte una idea, una noticia o algo que merezca celebrarse." />
      <Card className="p-5 sm:p-[23px]">
        <form onSubmit={submit} noValidate className="space-y-[18px]">
          <h2 className="text-[20px] font-semibold text-ink">Contenido</h2>
          <Input label="Título" required value={f.title} onChange={set('title')} maxLength={200} error={errs.title} placeholder="Ej. Así mejoramos juntos nuestros procesos" />
          <div>
            <p className="mb-3 text-[13px] font-semibold text-ink">Imagen de portada *</p>
            {f.cover_file_id ? (
              cover ? <img src={cover.preview} alt="" className="h-[200px] w-full rounded-xl object-cover sm:h-[270px]" />
                : <AuthImage fileId={f.cover_file_id} className="h-[200px] w-full rounded-xl sm:h-[270px]" />
            ) : (
              <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-line bg-page text-[13px] text-muted sm:h-[270px]">Aún no hay imagen de portada</div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Button variant="secondary" icon={ImagePlus} loading={uploading} onClick={() => input.current?.click()}>{f.cover_file_id ? 'Cambiar imagen' : 'Agregar imagen'}</Button>
              {cover && <span className="text-[11px] text-muted">{cover.name} · {formatBytes(cover.size)}</span>}
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            <p className="mt-3 text-[11px] text-muted">JPG o PNG · Máximo 10 MB · Recomendado: 1600 × 900 px</p>
            {errs.cover && <p className="mt-1 text-[11px] text-danger">{errs.cover}</p>}
          </div>
          <Input label="Descripción de la imagen" value={f.cover_alt} onChange={set('cover_alt')} maxLength={240} hint="Ayuda a que la publicación sea accesible para todos." placeholder="Ej. Equipo compartiendo ideas en la oficina" />
          <Textarea label="Descripción de la publicación" required rows={4} value={f.body} onChange={set('body')} error={errs.body} placeholder="Cuenta la novedad…" />
          <Select label="Audiencia" required value={f.audience_area_id} onChange={set('audience_area_id')}>
            <option value="">Toda la empresa</option>
            {(areas || []).map((a) => <option key={a.id} value={a.id}>Solo {a.name}</option>)}
          </Select>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button variant="secondary" onClick={() => nav('/admin/publicaciones')} disabled={busy} className="px-7 py-3.5">Cancelar</Button>
            <Button type="submit" loading={busy} disabled={uploading} className="px-7 py-3.5">Guardar</Button>
          </div>
          <p className="text-[11px] text-muted">* Campos obligatorios</p>
        </form>
      </Card>
    </div>
  );
}
