import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Eye, FileText, Trash2, Upload } from 'lucide-react';
import { api } from '../api/client.js';
import { can, useAuth } from '../context/AuthContext.jsx';
import { useApi, useDebounced } from '../hooks/useApi.js';
import { Button, Card, ConfirmModal, EmptyState, FullSpinner, Input, PageHeader, Select, cx, useToast } from '../components/ui.jsx';
import { downloadFile } from '../components/FileBox.jsx';
import { formatBytes, formatDate } from '../lib/format.js';

const FORMATS = { '': 'Todos los formatos', pdf: 'PDF', word: 'Word', excel: 'Excel', image: 'Imágenes', other: 'Otros' };
const PREVIEWABLE = /\.(pdf|png|jpe?g|gif|webp)$/i;
const keyOf = (n) => `${n.kind}:${n.id ?? 0}`;

function findPath(node, key, trail = []) {
  const here = [...trail, node];
  if (keyOf(node) === key) return here;
  for (const c of node.children || []) { const r = findPath(c, key, here); if (r) return r; }
  return null;
}
function filterTree(node, q) {
  if (!q) return node;
  const kids = (node.children || []).map((c) => filterTree(c, q)).filter(Boolean);
  return node.name.toLowerCase().includes(q) || kids.length ? { ...node, children: kids } : null;
}

function TreeNode({ node, depth, selected, onSelect, collapsed, toggle, forceOpen }) {
  const key = keyOf(node);
  const has = node.children?.length > 0;
  const open = forceOpen || !collapsed.has(key);
  const active = selected === key;
  return (
    <li>
      <div className="flex items-center" style={{ paddingLeft: depth * 16 }}>
        {has ? (
          <button type="button" onClick={() => toggle(key)} aria-label={open ? 'Contraer' : 'Expandir'} aria-expanded={open} className="rounded p-0.5 text-muted hover:text-ink">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : <span className="w-[18px] text-center text-[11px] text-muted">{depth > 0 ? '↳' : ''}</span>}
        <button type="button" onClick={() => onSelect(key)} aria-current={active ? 'true' : undefined}
          className={cx('flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-[7px] text-left text-[13px] leading-[1.4]', active ? 'font-semibold text-brand' : 'text-muted hover:text-ink', depth === 0 && 'font-medium text-ink')}>
          <span className="truncate">{node.name} · {node.count}</span>
          {active && <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-brand" />}
        </button>
      </div>
      {has && open && (
        <ul>{node.children.map((c) => <TreeNode key={keyOf(c)} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} collapsed={collapsed} toggle={toggle} forceOpen={forceOpen} />)}</ul>
      )}
    </li>
  );
}

export default function Repository() {
  const { user } = useAuth();
  const toast = useToast();
  const { data: tree, loading: loadingTree, reload: reloadTree } = useApi('/files/folders');
  const [selected, setSelected] = useState('company:0');
  const [collapsed, setCollapsed] = useState(new Set());
  const [folderQ, setFolderQ] = useState('');
  const [q, setQ] = useState('');
  const [format, setFormat] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [uploading, setUploading] = useState(null);
  const input = useRef(null);
  const dq = useDebounced(q);

  const path = useMemo(() => {
    const [kind, id] = selected.split(':');
    const p = new URLSearchParams();
    if (kind !== 'company') { p.set('folderKind', kind); p.set('folderId', id); }
    if (dq.trim()) p.set('q', dq.trim());
    if (format) p.set('format', format);
    return `/files?${p}`;
  }, [selected, dq, format]);
  const { data: files, loading, reload } = useApi(path);

  const trail = useMemo(() => (tree ? findPath(tree, selected) || [tree] : []), [tree, selected]);
  const current = trail[trail.length - 1];
  const shownTree = useMemo(() => (tree ? filterTree(tree, folderQ.trim().toLowerCase()) : null), [tree, folderQ]);
  const toggle = useCallback((k) => setCollapsed((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; }), []);
  const canUpload = can(user, 'docs');

  useEffect(() => { if (tree && !findPath(tree, selected)) setSelected('company:0'); }, [tree, selected]);

  async function upload(list) {
    if (!list.length) return;
    const fd = new FormData();
    fd.append('context', 'repo');
    if (current.kind !== 'company') { fd.append('folderKind', current.kind); fd.append('folderId', current.id); }
    list.forEach((f) => fd.append('files', f));
    setUploading(0);
    try {
      await api.upload('/files', fd, setUploading);
      toast.success(list.length === 1 ? 'Documento subido' : `${list.length} documentos subidos`);
      reload(); reloadTree();
    } catch (e) { toast.error(e.message); } finally { setUploading(null); }
  }

  async function preview(f) {
    try {
      const { blob } = await api.blob(`/files/${f.id}/preview`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { toast.error(e.message); }
  }

  async function remove() {
    await api.del(`/files/${confirm.id}`);
    setConfirm(null); toast.success('Documento eliminado'); reload(); reloadTree();
  }

  const n = files?.length ?? 0;
  const where = trail.length > 1 ? current.name : 'toda la empresa';

  return (
    <div className="max-w-[1112px]">
      <PageHeader eyebrow="Tu espacio de trabajo" title="Repositorio" subtitle="Todos los documentos de la empresa, en un solo lugar."
        action={canUpload && (
          <>
            <Button icon={Upload} loading={uploading !== null} onClick={() => input.current?.click()}>{uploading !== null ? `Subiendo ${uploading}%` : 'Subir documento'}</Button>
            <input ref={input} type="file" multiple className="sr-only" onChange={(e) => { upload([...e.target.files]); e.target.value = ''; }} />
          </>
        )} />

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="p-[17px]">
          <h2 className="px-1 pb-4 pt-1 text-[20px] font-semibold text-ink">Carpetas</h2>
          <Input label="Buscar carpeta" placeholder="Nombre de carpeta…" value={folderQ} onChange={(e) => setFolderQ(e.target.value)} />
          <div className="mt-5 max-h-[560px] overflow-y-auto pb-2">
            {loadingTree && !tree ? <FullSpinner /> : shownTree ? (
              <ul><TreeNode node={shownTree} depth={0} selected={selected} onSelect={setSelected} collapsed={collapsed} toggle={toggle} forceOpen={!!folderQ.trim()} /></ul>
            ) : <p className="px-2 text-[12px] text-muted">No hay carpetas con ese nombre.</p>}
          </div>
        </Card>

        <div className="min-w-0">
          <p className="mb-3 text-[12px] leading-[1.5] text-brand">{trail.map((t) => t.name).join(' / ')}</p>
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
            <Input label="Buscar documento" placeholder="Nombre documento…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select label="Formato" value={format} onChange={(e) => setFormat(e.target.value)}>
              {Object.entries(FORMATS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>

          <Card className="mt-5 px-5 py-5 sm:px-[19px]">
            <div className="flex flex-wrap items-center gap-4 border-b border-line pb-5">
              <span className="rounded-full bg-tint px-2.5 py-[5px] text-[11px] font-semibold text-brand">{n} {n === 1 ? 'documento' : 'documentos'}{format ? ` ${FORMATS[format]}` : ''}</span>
              <span className="text-[11px] text-muted">Actualizados primero ↓</span>
            </div>
            {loading && !files ? <FullSpinner /> : n === 0 ? (
              <p className="py-12 text-center text-[13px] text-muted">{dq || format ? 'No hay documentos con estos filtros.' : `Aún no hay documentos en ${where}.`}{canUpload && !dq && !format ? ' Usa “Subir documento” para agregar el primero.' : ''}</p>
            ) : (
              <ul className={cx(loading && 'opacity-60')}>
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-4 border-b border-line py-[18px] last:border-b">
                    <FileText className="h-6 w-6 shrink-0 text-brand" strokeWidth={1.25} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold leading-[1.4] text-ink">{f.original_name}</p>
                      <p className="mt-0.5 truncate text-[12px] leading-[1.5] text-muted">{[formatBytes(f.size), f.uploader_name, formatDate(f.created_at.slice(0, 10))].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {PREVIEWABLE.test(f.original_name) && <button type="button" onClick={() => preview(f)} aria-label={`Ver ${f.original_name}`} className="rounded-md p-2 text-brand hover:bg-tint"><Eye className="h-[18px] w-[18px]" strokeWidth={1.5} /></button>}
                      <button type="button" onClick={() => downloadFile(f.id, f.original_name, toast)} aria-label={`Descargar ${f.original_name}`} className="rounded-md p-2 text-brand hover:bg-tint"><Download className="h-[18px] w-[18px]" strokeWidth={1.5} /></button>
                      {(f.owner_id === user.id || can(user, 'admin')) && <button type="button" onClick={() => setConfirm(f)} aria-label={`Eliminar ${f.original_name}`} className="rounded-md p-2 text-muted hover:bg-red-50 hover:text-danger"><Trash2 className="h-[18px] w-[18px]" strokeWidth={1.5} /></button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="pt-4 text-[11px] text-muted">{n} de {current?.count ?? 0} archivos{format || dq ? ` · Filtro${format ? ` ${FORMATS[format]}` : ''} aplicado` : ''}</p>
          </Card>

          <Card tint className="mt-5 px-5 py-5">
            <p className="text-[13px] font-semibold text-ink">{trail.length > 1 ? `Compartido con ${current.name}` : 'Compartido con toda la empresa'}</p>
            <p className="mt-3 text-[12px] leading-[1.5] text-muted">Puedes consultar y subir documentos en las carpetas de la empresa. Los archivos conservan quién los subió y cuándo.</p>
          </Card>
        </div>
      </div>
      <ConfirmModal open={!!confirm} danger title="Eliminar documento" message={`Se eliminará “${confirm?.original_name}” del repositorio. Esta acción no se puede deshacer.`} confirmLabel="Eliminar" onConfirm={remove} onClose={() => setConfirm(null)} />
    </div>
  );
}
