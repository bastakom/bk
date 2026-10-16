"use client";

import { toast } from "sonner";
import { restoreWidgets } from "./actions";

/** Senaste borttagningen i den här fliken, så att ⌘Z/Ctrl+Z kan ångra även efter att aviseringen försvunnit. */
let last: unknown[] | null = null;

export async function undoDelete(snaps: unknown[] | null = last) {
  if (!snaps?.length) return false;
  last = null;
  const res = await restoreWidgets(snaps);
  if (res.ok) toast.success(res.message);
  else toast.error(res.error);
  return true;
}

/** Visar "Borttagen – Ångra" och kommer ihåg ögonblicksbilden för ⌘Z. */
export function toastDeleted(message: string, snaps: unknown[] | undefined) {
  last = snaps?.length ? snaps : null;
  toast.success(message, snaps?.length ? { duration: 8000, action: { label: "Ångra", onClick: () => void undoDelete(snaps) } } : undefined);
}

export const hasUndo = () => !!last?.length;
