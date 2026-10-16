import type { WidgetViewProps } from "./types";

/** Fritext. Tomma rader blir styckesbrytningar, rader som börjar med "- " blir punktlistor. */
export function TextWidget({ config }: WidgetViewProps) {
  const blocks = (config.text ?? "").split(/\n{2,}/).filter((b) => b.trim());
  if (blocks.length === 0) return <p className="text-sm text-muted-foreground">Tom textruta.</p>;
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{l.trim().slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {b}
          </p>
        );
      })}
    </div>
  );
}
