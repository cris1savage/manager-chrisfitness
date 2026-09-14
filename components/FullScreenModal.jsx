'use client';

import { X } from 'lucide-react';

export default function FullScreenModal({ title, subtitle, avatar, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-bg">
        <div className="flex items-center gap-3 min-w-0">
          {avatar}
          <div className="min-w-0">
            <div className="text-ink font-bold text-base truncate">{title}</div>
            {subtitle && <div className="text-muted text-xs truncate">{subtitle}</div>}
          </div>
        </div>
        <button onClick={onClose} className="text-muted p-2 shrink-0"><X size={22} /></button>
      </div>
      <div className="max-w-5xl mx-auto p-4 sm:p-6">{children}</div>
    </div>
  );
}
