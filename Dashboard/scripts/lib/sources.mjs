/** Hjälpfunktioner för röktest: koppla inloggningar i Databaser och välja källor för kunder. */

/** Kopplar en inloggning via OAuth (simulerad samtyckessida) från Databaser. */
export async function connectOAuth(page, base, platformLabel) {
  await page.goto(`${base}/databases`);
  await page.getByRole("button", { name: "Koppla ny inloggning" }).first().click();
  await page.getByRole("dialog").getByRole("link", { name: `Koppla ${platformLabel}`, exact: true }).click();
  await page.getByRole("link", { name: "Tillåt" }).click();
  await page.waitForURL(/\/databases/, { timeout: 120_000 });
}

/** Väljer källor för en kund. sources: [{ name, login }] – login skiljer t.ex. riktiga konton från demodata. */
export async function pickSources(page, base, clientSlug, sources) {
  await page.goto(`${base}/clients/${clientSlug}`);
  await page.getByRole("button", { name: "Välj källor" }).first().click();
  const dialog = page.getByRole("dialog");
  for (const s of sources) {
    await dialog.getByLabel("Sök källor").fill(s.name);
    const row = dialog.getByRole("listitem").filter({ hasText: s.name }).filter({ hasText: s.login });
    await row.getByRole("checkbox").check();
  }
  await dialog.getByRole("button", { name: `Lägg till ${sources.length}` }).click();
  await dialog.waitFor({ state: "detached", timeout: 30_000 });
}

/** Väntar tills källorna har synkats minst en gång (första synken körs i bakgrunden). */
export async function waitForSync(q, accountIds, timeoutMs = 180_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const rows = await q(`SELECT count(*)::int AS n FROM connected_accounts WHERE id = ANY($1) AND "lastSyncAttemptAt" IS NOT NULL AND "syncLockedAt" IS NULL`, [accountIds]);
    const runs = await q(`SELECT count(DISTINCT "accountId")::int AS n FROM sync_runs WHERE "accountId" = ANY($1) AND status <> 'RUNNING'`, [accountIds]);
    if (rows[0].n === accountIds.length && runs[0].n === accountIds.length) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Synken blev inte klar inom ${timeoutMs / 1000} s`);
}
