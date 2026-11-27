import { createContext, type ReactNode, useContext } from 'react';

import { type AdminApi } from './api';
import { type AdminSocket } from './socket';

export interface AdminClient {
  api: AdminApi;
  socket: AdminSocket;
  // Where a 401 or a sign-out sends the operator; the app decides how to navigate.
  toLogin: () => void;
}

const AdminContext = createContext<AdminClient | null>(null);

export function AdminProvider({ client, children }: { client: AdminClient; children: ReactNode }) {
  return <AdminContext value={client}>{children}</AdminContext>;
}

export function useAdmin(): AdminClient {
  const client = useContext(AdminContext);
  if (!client) throw new Error('useAdmin must be used inside <AdminProvider>');
  return client;
}
