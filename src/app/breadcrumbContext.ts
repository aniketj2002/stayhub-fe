import { createContext, useContext } from 'react';

export interface HostBreadcrumbContextType {
  breadcrumbTrail: string[] | null;
  setBreadcrumbTrail: (trail: string[] | null) => void;
}

export const HostBreadcrumbContext = createContext<HostBreadcrumbContextType>({
  breadcrumbTrail: null,
  setBreadcrumbTrail: () => {},
});

export function useHostBreadcrumb() {
  return useContext(HostBreadcrumbContext);
}
