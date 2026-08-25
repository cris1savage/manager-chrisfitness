import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import { ProfilesProvider } from '@/components/ProfilesProvider';
import { CategoriesProvider } from '@/components/CategoriesProvider';
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

  const { data: categoryRows } = await supabase.from('content_categories').select('*').order('sort_order', { ascending: true });

  const isOwner = !!profiles[user.id]?.is_owner;
  const nav = NAV.filter((item) => !item.ownerOnly || isOwner);

  return (
    <div className="min-h-screen flex">
      <Sidebar nav={nav} profile={profiles[user.id]} />
      <ProfilesProvider profiles={profiles}>
        <CategoriesProvider initialCategories={categoryRows || []}>
          <main className="flex-1 p-4 md:p-6 lg:p-8 mt-12 md:mt-0">
            <div className="max-w-6xl mx-auto">{children}</div>
          </main>
        </CategoriesProvider>
      </ProfilesProvider>
    </div>
  );
}
