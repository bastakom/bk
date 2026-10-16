import "server-only";
import { z } from "zod";
import { PermissionError } from "./dal";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

/** Gemensam felhantering för server actions: valideringsfel och behörighet blir läsbara meddelanden. */
export async function runAction<T>(fn: () => Promise<T | ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const res = await fn();
    if (res && typeof res === "object" && "ok" in res) return res as ActionResult<T>;
    return { ok: true, data: res as T };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, error: err.issues.map((i) => i.message).join(", ") };
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    if (err && typeof err === "object" && "digest" in err) throw err; // redirect() m.fl.
    console.error(err);
    return { ok: false, error: "Något gick fel. Försök igen." };
  }
}
