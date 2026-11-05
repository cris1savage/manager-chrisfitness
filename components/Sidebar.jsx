'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Calendar, CalendarDays, Megaphone, Users, FileText, LogOut, Menu, X,
  CheckSquare, UserCheck, Gift, ShieldCheck, ScrollText, ClipboardCheck, DollarSign, MessageCircle, UsersRound, Clapperboard, MessagesSquare, FolderOpen, BarChart3, PiggyBank,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const ICONS = {
  dashboard: LayoutDashboard,
  contenido: CalendarDays,
  calendario: Calendar,
  guiones: ScrollText,
  videos: Clapperboard,
  plantillas: MessageCircle,
  canal: MessagesSquare,
  tareas: CheckSquare,
  equipo: UsersRound,
  resumen: ClipboardCheck,
  historial: BarChart3,
  anuncios: Megaphone,
  contactos: Users,
  clientes: UserCheck,
  ventas: DollarSign,
  facturacion: PiggyBank,
  referidos: Gift,
  notas: FileText,
  documentos: FolderOpen,
  seguridad: ShieldCheck,
};

const isActive = (pathname, href) => pathname === href || pathname.startsWith(href + '/');

function NavGroups({ groups, pathname, onClick }) {
  return groups.map((g) => (
    <div key={g.key} className="mb-2">
      <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[1.5px] text-muted opacity-70">
        {g.label}
      </div>
      {g.items.map((n) => {
        const Icon = ICONS[n.key] || LayoutDashboard;
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.key}
            href={n.href}
            onClick={onClick}
            className={`relative flex items-center gap-2.5 rounded-lg pl-4 pr-3 py-1.5 text-[13px] ${
              active ? 'bg-cyan/10 text-cyan font-bold' : 'text-muted font-medium hover:text-ink'
            }`}
          >
            {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-cyan" />}
            <Icon size={15} /> {n.label}
          </Link>
        );
      })}
    </div>
  ));
}

export default function Sidebar({ groups, profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border h-screen sticky top-0">
        <div className="p-4 pb-2">
          <div className="font-display text-ink text-[19px] tracking-wide">CHRIS FITNESS</div>
          <div className="text-cyan text-[10.5px] tracking-[2px]">PANEL DE CONTROL</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          <NavGroups groups={groups} pathname={pathname} />
        </nav>
        <div className="border-t border-border p-4 pt-3">
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
        <button onClick={() => setOpen(!open)} className="text-ink" aria-label="Menú">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden fixed top-12 left-0 right-0 bottom-0 z-10 p-3 overflow-y-auto bg-bg">
          <NavGroups groups={groups} pathname={pathname} onClick={() => setOpen(false)} />
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2.5 mt-2 text-sm text-muted border-t border-border">
            <LogOut size={15} /> Cerrar sesión ({profile?.display_name})
          </button>
        </div>
      )}
    </>
  );
}
