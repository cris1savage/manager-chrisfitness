'use client';

import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';

export default function ThemeToggle({ profile }) {
  const [theme, setTheme] = useState(profile?.theme === 'light' ? 'light' : 'dark');
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.classList.toggle('light', next === 'light');
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.from('profiles').update({ theme: next }).eq('id', user.id);
    setSaving(false);
  };

  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="rounded-lg p-2 shrink-0" style={{ background: theme === 'light' ? '#FBBF2422' : '#5ECCFA22' }}>
          {theme === 'light' ? <Sun size={18} color="var(--color-amber)" /> : <Moon size={18} color="var(--color-cyan)" />}
        </div>
        <div>
          <div className="text-ink text-sm font-semibold">Tema</div>
          <div className="text-muted text-xs">Es una preferencia tuya — la otra cuenta puede tener el suyo distinto.</div>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className="relative w-14 h-8 rounded-full shrink-0 transition-colors disabled:opacity-60"
        style={{ background: theme === 'light' ? 'var(--color-amber)' : 'var(--color-border)' }}
        aria-label="Cambiar tema"
      >
        <span
          className="absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all flex items-center justify-center"
          style={{ left: theme === 'light' ? 'calc(100% - 28px)' : '4px' }}
        >
          {theme === 'light' ? <Sun size={13} color="var(--color-amber)" /> : <Moon size={13} color="var(--color-bg)" />}
        </span>
      </button>
    </Card>
  );
}
