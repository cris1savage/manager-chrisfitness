'use client';

import { X } from 'lucide-react';

export default function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full sm:max-w-2xl sm:rounded-xl border border-border min-h-screen sm:min-h-0 sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-surface sm:rounded-t-xl">
          <div className="text-ink font-semibold text-sm">{title}</div>
          <button onClick={onClose} className="text-muted p-1"><X size={20} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
