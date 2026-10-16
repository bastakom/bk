/**
 * Gör tekniska felmeddelanden (från plattformarnas API:er, databasen m.m.) begripliga:
 * vad hände och vad kan användaren göra. Den tekniska texten rensas från filsökvägar
 * och kodrader och kan visas separat som "Teknisk information".
 */
export interface FriendlyError {
  /** Kort förklaring på svenska med åtgärd. */
  text: string;
  /** Rensad teknisk text (utan sökvägar), eller undefined om den inte tillför något. */
  detail?: string;
}

const RULES: [RegExp, string][] = [
  // Google Ads: projektets åtkomstnivå (Test) räcker inte för riktiga konton. Omkoppling hjälper inte.
  [/DEVELOPER_TOKEN_NOT_APPROVED|CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION|bara godkänd för testkonton|only approved for use with test accounts/i, "Google Ads-åtkomsten är bara godkänd för testkonton. Riktiga konton kan synkas när åtkomstnivån Explorer är godkänd i Google Cloud Console."],
  [/(kod|code)[ :]*190\b|OAuthException|invalid_grant|token.*(ogiltig|återkallad|expired|invalid)|access token|Behörighet saknas|unauthori[sz]ed|\b401\b/i, "Inloggningen mot plattformen har gått ut eller återkallats. Koppla om källan under Databaser."],
  [/permission|forbidden|\b403\b|saknar (läs)?behörighet|not authorized/i, "Kontot saknar läsbehörighet hos plattformen. Kontrollera att kontot är delat med byrån och koppla om vid behov."],
  [/rate.?limit|too many|\b429\b|(kod|code)[ :]*(4|17|32|613)\b|quota/i, "Plattformen begränsade antalet anrop. Synken försöker igen automatiskt."],
  [/timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|fetch failed|socket hang up|\b50[0234]\b/i, "Plattformen svarade inte. Synken försöker igen automatiskt."],
  [/Unique constraint|Invalid `|prisma|createMany|violates|deadlock|database/i, "Ett internt fel uppstod när data skulle sparas. Synken försöker igen vid nästa körning."],
  [/RESEND|smtp|mail/i, "Mejlet kunde inte skickas. Kontrollera e-postinställningarna och försök igen."],
];

/** Tar bort filsökvägar, kodrader och radbrytningar ur ett tekniskt fel. */
export function sanitizeError(raw: string): string {
  // Prisma: "Invalid `x()` invocation in <fil>:<rad> <kodutdrag> <orsak>" → "x(): <orsak>"
  const prisma = /Invalid `([^`]+)` invocation[\s\S]*?((?:Unique|Foreign key|Null|Check) constraint[\s\S]*|Value too long[\s\S]*|Record to [\s\S]*|The column [\s\S]*)$/.exec(raw);
  if (prisma) raw = `${prisma[1]}: ${prisma[2]}`;
  return raw
    .replace(/(?:\/Users|\/home|\/var|\/private|\/tmp|\/app|[A-Z]:\\)[^\n]*?\.\w{1,4}(?::\d+){1,2}/g, "…")
    .replace(/(?:\/Users|\/home|\/var|\/private|\/tmp|\/app|[A-Z]:\\)[^\s'"`)]*/g, "…")
    .replace(/\s*→?\s*\d{2,5}\s+(?:let|const|for|await|return|if)\b[^\n]*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

const looksTechnical = (s: string) => /[`{};]|\bat \w|\.(ts|js|tsx)\b|Error:|Exception|invocation|\{|=>/.test(s);

export function friendlyError(raw: string | null | undefined): FriendlyError | null {
  if (!raw?.trim()) return null;
  const detail = sanitizeError(raw);
  for (const [re, text] of RULES) if (re.test(raw)) return { text, detail };
  // Korta, redan begripliga meddelanden (t.ex. våra egna svenska texter) visas som de är.
  if (raw.length <= 160 && !looksTechnical(raw)) return { text: raw.trim() };
  return { text: "Något gick fel. Försöket görs om automatiskt; hör av dig till support om felet kvarstår.", detail };
}
