'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Calendar, Megaphone, Users, UserPlus, FileText, LogOut, Menu, X, Lightbulb,
  CheckSquare, UserCheck, Gift, ShieldCheck, ScrollText, ClipboardCheck, DollarSign, MessageCircle, UsersRound, Clapperboard, MessagesSquare,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const ICONS = {
  dashboard: LayoutDashboard,
  calendario: Calendar,
  guiones: ScrollText,
  videos: Clapperboard,
  ideas: Lightbulb,
  plantillas: MessageCircle,
  canal: MessagesSquare,
  tareas: CheckSquare,
  equipo: UsersRound,
  resumen: ClipboardCheck,
  anuncios: Megaphone,
  contactos: Users,
  clientes: UserCheck,
  ventas: DollarSign,
  referidos: Gift,
  notas: FileText,
  seguridad: ShieldCheck,
};

export default function Sidebar({ nav, profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const NavLinks = ({ onClick }) =>
    nav.map((n) => {
      const Icon = ICONS[n.key] || LayoutDashboard;
      const active = pathname === n.href;
      return (
        <Link
          key={n.key}
          href={n.href}
          onClick={onClick}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
            active ? 'bg-cyan/10 text-cyan font-bold' : 'text-muted font-medium'
          }`}
        >
          <Icon size={16} /> {n.label}
        </Link>
      );
    });

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 p-4 gap-1 border-r border-border h-screen sticky top-0">
        <div className="mb-4">
          <div className="font-display text-ink text-[19px] tracking-wide">CHRIS FITNESS</div>
          <div className="text-cyan text-[10.5px] tracking-[2px]">PANEL DE CONTROL</div>
        </div>
        <NavLinks />
        <div className="flex-1" />
        <div className="border-t border-border pt-3 mt-2">
          <div className="text-ink text-[13px] font-bold">{profile?.display_name}</div>
          <div className="text-muted text-[11px]">{profile?.role_title}</div>
          <button onClick={logout} className="flex items-center gap-1.5 mt-2 text-xs text-muted">
            <LogOut size={13} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-bg border-b border-border">
        <div className="font-display text-ink text-base">CHRIS FITNESS</div>
        <button onClick={() => setOpen(!open)} className="text-ink">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden fixed top-12 left-0 right-0 bottom-0 z-10 p-3 space-y-1 overflow-y-auto bg-bg">
          <NavLinks onClick={() => setOpen(false)} />
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted">
            <LogOut size={15} /> Cerrar sesión ({profile?.display_name})
          </button>
        </div>
      )}
    </>
  );
}
