import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import { ProfilesProvider } from '@/components/ProfilesProvider';
import { NAV } from '@/lib/config';

export default async function AppLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profileRows } = await supabase.from('profiles').select('*');
  const profiles = {};
  (profileRows || []).forEach((p) => (profiles[p.id] = p));

  return (
    <div className="min-h-screen flex">
      <Sidebar nav={NAV} profile={profiles[user.id]} />
      <ProfilesProvider profiles={profiles}>
        <main className="flex-1 p-4 md:p-6 mt-12 md:mt-0 max-w-6xl">{children}</main>
      </ProfilesProvider>
    </div>
  );
}
