'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const CategoriesContext = createContext({ list: [], map: {} });

export function CategoriesProvider({ initialCategories, children }) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState(initialCategories || []);

  const load = async () => {
    const { data } = await supabase.from('content_categories').select('*').order('sort_order', { ascending: true });
    setList(data || []);
  };

  useEffect(() => {
    const channel = supabase
      .channel('content-categories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_categories' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const map = useMemo(() => {
    const m = {};
    list.forEach((c) => (m[c.id] = c));
    return m;
  }, [list]);

  return <CategoriesContext.Provider value={{ list, map }}>{children}</CategoriesContext.Provider>;
}

export function useCategories() {
  return useContext(CategoriesContext);
}
