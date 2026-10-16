"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTemplate } from "./actions";

export function TemplateActions({ id, name, canEdit }: { id: string; name: string; canEdit: boolean }) {
  const [pending, start] = useTransition();
  if (!canEdit) return null;
  return (
    <div className="flex w-full items-center gap-2">
      <Button asChild size="sm" className="flex-1">
        <Link href={`/apply?template=${id}`}>Använd på kund</Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Radera mallen ${name}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (!confirm(`Radera mallen "${name}"?`)) return;
            const res = await deleteTemplate(id);
            if (res.ok) toast.success(res.message);
            else toast.error(res.error);
          })
        }
      >
        <Trash2 />
      </Button>
    </div>
  );
}
