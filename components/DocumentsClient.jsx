'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Trash2, FileText, Image as ImageIcon, File, X, Download, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(mime) {
  if (mime?.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  return File;
}

export default function DocumentsClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerDoc, setViewerDoc] = useState(null);
  const fileInputRef = useRef(null);

  const load = async () => {
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('documents-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const path = `${userData.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file);
      if (uploadErr) throw uploadErr;
      await supabase.from('documents').insert({
        name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        created_by: userData.user.id,
      });
      load();
    } catch (err) {
      alert('No se pudo subir el archivo: ' + (err.message || 'error desconocido'));
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openViewer = async (doc) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 600);
    if (data?.signedUrl) {
      setViewerUrl(data.signedUrl);
      setViewerDoc(doc);
    }
  };

  const download = async (doc) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 60, { download: doc.name });
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const remove = async (doc) => {
    await supabase.storage.from('documents').remove([doc.storage_path]);
    await supabase.from('documents').delete().eq('id', doc.id);
    load();
  };

  const canPreview = (mime) => mime === 'application/pdf' || mime?.startsWith('image/');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-ink text-[22px] tracking-wide">DOCUMENTOS</h2>
          <div className="text-muted text-xs">Sube PDFs u otros archivos y visualízalos directamente desde la web, sin descargarlos.</div>
        </div>
        <div>
          <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" id="doc-upload" />
          <label
            htmlFor="doc-upload"
            className="rounded-lg px-3 py-2 flex items-center gap-1 font-semibold text-sm bg-cyan text-[#00161C] cursor-pointer w-fit"
          >
            <Upload size={16} /> {uploading ? 'Subiendo…' : 'Subir archivo'}
          </label>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {loading && <Card className="text-center py-8 text-muted col-span-2">Cargando…</Card>}
        {!loading && docs.length === 0 && (
          <Card className="text-center py-8 text-muted col-span-2">Todavía no hay archivos. Sube el primero arriba.</Card>
        )}
        {docs.map((doc) => {
          const Icon = iconFor(doc.mime_type);
          return (
            <Card key={doc.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <Icon size={18} className="text-cyan shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-ink font-medium text-sm truncate">{doc.name}</div>
                  <div className="text-muted text-[11px]">{formatSize(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString('es-ES')}</div>
                </div>
                <AuthorBadge profile={profiles?.[doc.created_by]} />
              </div>
              <div className="flex items-center gap-2">
                {canPreview(doc.mime_type) && (
                  <button
                    onClick={() => openViewer(doc)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 bg-cyan/15 text-cyan"
                  >
                    <Eye size={13} /> Ver
                  </button>
                )}
                <button
                  onClick={() => download(doc)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 text-muted border border-border"
                >
                  <Download size={13} /> Descargar
                </button>
                <button onClick={() => remove(doc)} className="p-1.5 rounded-lg text-red ml-auto">
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {viewerUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewerUrl(null)}>
          <div className="bg-surface rounded-xl w-full max-w-4xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-border">
              <div className="text-ink text-sm font-semibold truncate">{viewerDoc?.name}</div>
              <button onClick={() => setViewerUrl(null)} className="text-muted shrink-0"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-hidden rounded-b-xl bg-white">
              {viewerDoc?.mime_type?.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewerUrl} alt={viewerDoc?.name} className="w-full h-full object-contain" />
              ) : (
                <iframe src={viewerUrl} title={viewerDoc?.name} className="w-full h-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
