"use client";

import { Pause, Play } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setScheduleActive } from "../clients/[clientSlug]/dashboards/[dashboardId]/schedule-actions";

export function ScheduleToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setScheduleActive(id, !active);
          if (res.ok) toast.success(res.message);
          else toast.error(res.error);
        })
      }
    >
      {active ? <Pause /> : <Play />}
      {active ? "Pausa" : "Aktivera"}
    </Button>
  );
}
