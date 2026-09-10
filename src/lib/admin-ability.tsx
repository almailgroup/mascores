import { createContext, useContext, type ReactNode } from "react";

export type AdminAbility = {
  /** True only for the site owner account. */
  isOwner: boolean;
  /** True when this person's additions and removals must be looked at first. */
  needsApproval: boolean;
};

const Ctx = createContext<AdminAbility>({ isOwner: false, needsApproval: false });

export function AdminAbilityProvider({ value, children }: { value: AdminAbility; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAbility() {
  return useContext(Ctx);
}
