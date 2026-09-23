"use client";

import { createContext, useContext, type ReactNode } from "react";

const ProLockedContext = createContext(false);

export function ProLockedProvider({
  locked,
  children,
}: {
  locked: boolean;
  children: ReactNode;
}) {
  return (
    <ProLockedContext.Provider value={locked}>
      {children}
    </ProLockedContext.Provider>
  );
}

/** True when rendered inside a locked ProFeatureGate preview. */
export function useProLocked(): boolean {
  return useContext(ProLockedContext);
}
