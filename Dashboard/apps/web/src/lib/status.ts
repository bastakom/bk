import type { AccountStatus } from "@rp/db";

export const STATUS_META: Record<AccountStatus, { label: string; tone: "success" | "warning" | "danger" | "muted"; rank: number }> = {
  OK: { label: "OK", tone: "success", rank: 0 },
  PENDING: { label: "Väntar på synk", tone: "muted", rank: 1 },
  SYNC_ERROR: { label: "Synkfel", tone: "danger", rank: 2 },
  AUTH_REQUIRED: { label: "Behörighet saknas", tone: "warning", rank: 3 },
};

/** Sämsta statusen bland en kunds konton – det är den som visas i översikten. */
export function worstStatus(statuses: AccountStatus[]): AccountStatus | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((a, b) => (STATUS_META[b].rank > STATUS_META[a].rank ? b : a));
}
