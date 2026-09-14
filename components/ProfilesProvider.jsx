'use client';

import { createContext, useContext } from 'react';

const ProfilesContext = createContext({});

export function ProfilesProvider({ profiles, children }) {
  return <ProfilesContext.Provider value={profiles}>{children}</ProfilesContext.Provider>;
}

export function useProfiles() {
  return useContext(ProfilesContext);
}
