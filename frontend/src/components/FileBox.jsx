import { Download } from 'lucide-react';
import { api, saveBlob } from '../api/client.js';
import { fileExt, formatBytes } from '../lib/format.js';
import { useToast } from './ui.jsx';

export async function downloadFile(id, name, toast) {
  try {
    const { blob } = await api.blob(`/files/${id}/download`);
    saveBlob(blob, name);
  } catch (e) { toast?.error(e.message); }
}

// Caja gris con nombre, tipo/peso y botón de descarga (adjuntos de tareas)
export default function FileBox({ id, name, size, extra }) {
  const toast = useToast();
  return (
    <div className="flex items-center gap-3 rounded-lg bg-page px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-[1.45] text-ink">{name}</p>
        <p className="text-[11px] leading-[1.45] text-muted">{fileExt(name)} · {formatBytes(size)}{extra ? ` · ${extra}` : ''}</p>
      </div>
      <button type="button" onClick={() => downloadFile(id, name, toast)} aria-label={`Descargar ${name}`} className="rounded-md p-1.5 text-brand hover:bg-tint">
        <Download className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>
    </div>
  );
}
