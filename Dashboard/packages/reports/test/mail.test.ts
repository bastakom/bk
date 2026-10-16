import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

process.env.OUTBOX_DIR = mkdtempSync(join(tmpdir(), "outbox-"));
const { OutboxMailer, pdfFilename, reportEmail } = await import("../src");

describe("pdfFilename", () => {
  it("följer referensrapportens namnformat utan å/ä/ö", () => {
    expect(pdfFilename("Demo Finans", "Årsrapport", { start: "2025-01-01", end: "2025-12-31" })).toBe("Demo-Finans-Arsrapport-2025-01-01_2025-12-31.pdf");
    expect(pdfFilename("Demo Tandvård AB", "Leads & bokningar", { start: "2026-10-05", end: "2026-10-11" })).toBe("Demo-Tandvard-AB-Leads-bokningar-2026-10-05_2026-10-11.pdf");
  });
});

describe("reportEmail", () => {
  const base = { agency: "Byrån", brandColor: "#4F46E5", client: "Kund", dashboard: "Rapport", period: "1–7 okt", url: "https://app/x", filename: "r.pdf" };

  it("escapar användartext så att inget HTML kan injiceras", () => {
    const { html } = reportEmail({ ...base, message: '<script>alert(1)</script>"', client: "A&B" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&#60;script&#62;");
    expect(html).toContain("A&#38;B");
  });

  it("har en textversion med länk och bilaga", () => {
    const { text } = reportEmail({ ...base, message: "Hej!" });
    expect(text).toContain("Hej!");
    expect(text).toContain("https://app/x");
    expect(text).toContain("r.pdf");
  });

  it("skrivs på engelska för engelskspråkiga kunder", () => {
    const { html, text } = reportEmail({ ...base, lang: "en" });
    expect(html).toContain('lang="en"');
    expect(html).toContain("Open the live dashboard");
    expect(text).toContain("The report is attached as a PDF (r.pdf).");
    expect(html).not.toContain("Öppna");
  });
});

describe("OutboxMailer", () => {
  it("sparar mejl och bilaga i utkorgen", async () => {
    const sent = await new OutboxMailer().send({
      to: ["a@b.se"],
      subject: "Test",
      html: "<p>Hej</p>",
      text: "Hej",
      attachments: [{ filename: "r.pdf", content: Buffer.from("%PDF-1.7") }],
    });
    expect(sent.provider).toBe("outbox");
    expect(sent.pdfPath!.startsWith(process.env.OUTBOX_DIR!)).toBe(true);
    expect(readFileSync(sent.pdfPath!, "utf8")).toBe("%PDF-1.7");
    expect(readFileSync(sent.htmlPath!, "utf8")).toBe("<p>Hej</p>");
  });
});
