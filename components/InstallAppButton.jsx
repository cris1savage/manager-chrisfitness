'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export default function InstallAppButton() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!prompt || installed) return null;

  const install = async () => {
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  return (
    <button onClick={install}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0"
      style={{ background: 'var(--color-surfaceAlt)', color: 'var(--color-cyan)', border: '1px solid var(--color-cyan)' }}
      title="Instalar como app">
      <Download size={13} /> Instalar
    </button>
  );
}
