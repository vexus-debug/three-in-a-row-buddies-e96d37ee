import { useMemo, useState } from "react";
import { ArrowRight, PauseCircle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLabCases } from "@/hooks/useLabCases";
import { useStaff } from "@/hooks/useStaff";
import { useAuth } from "@/hooks/useAuth";
import { useMoveCase, useHoldCase, clientOf, patientOf, isRush, isOverdue } from "@/hooks/useDentalLab";
import { stageLabel } from "@/config/dentalLab";
import { blockedReason, nextStage, HOLD_REASONS } from "@/lib/labWorkflow";
import { benchTasks } from "@/lib/labBench";
import { toast } from "@/hooks/use-toast";
import { PrintTravelerButton } from "@/components/dlab/PrintTravelerButton";

export default function DlabBenchPage() {
  const { data: cases = [] } = useLabCases();
  const { data: staff = [] } = useStaff();
  const { user } = useAuth() as any;
  const move = useMoveCase();
  const hold = useHoldCase();
  const me = staff.find((s: any) => s.user_id === user?.id);
  const [pick, setPick] = useState<string>("");
  const staffId = pick || me?.id || null;
  const tasks = useMemo(() => benchTasks(cases as any[], staffId), [cases, staffId]);
  const techs = staff.filter((s: any) => (s.status || "active") === "active");

  const advance = (c: any) => {
    const to = nextStage(c.status);
    if (!to) return;
    const why = blockedReason(c.status, to, c.qc_status);
    if (why) return toast({ title: "Can't move yet", description: why, variant: "destructive" });
    move.mutate({ id: c.id, status: to }, { onSuccess: () => toast({ title: `${c.case_number} → ${stageLabel(to)}` }) });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="My Bench" description="Your assigned cases for today. Tap to finish your step." />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={staffId || ""} onValueChange={setPick}>
          <SelectTrigger className="h-9 w-full sm:w-64"><SelectValue placeholder="Choose technician" /></SelectTrigger>
          <SelectContent>
            {techs.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.full_name}{s.id === me?.id ? " (me)" : ""}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary">{tasks.length} task{tasks.length === 1 ? "" : "s"}</Badge>
      </div>

      {!staffId && <p className="text-sm text-muted-foreground">Your account isn't linked to a staff profile. Pick a technician above.</p>}
      {staffId && tasks.length === 0 && <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nothing on your bench. Nice work.</CardContent></Card>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((c: any) => {
          const to = nextStage(c.status);
          const teeth: string[] = c.teeth || [];
          return (
            <Card key={c.id} className={isRush(c) ? "border-destructive/50" : ""}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.case_number}</p>
                    <p className="truncate text-xs text-muted-foreground">{clientOf(c)} · {patientOf(c)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {isRush(c) && <Badge variant="destructive" className="text-[10px]">Rush</Badge>}
                    {isOverdue(c) && <Badge variant="outline" className="border-destructive text-[10px] text-destructive">Overdue</Badge>}
                    {c.qc_status === "rework_needed" && <Badge variant="outline" className="text-[10px]">Rework</Badge>}
                  </div>
                </div>
                <p className="text-sm">
                  {teeth.length > 0 && <span className="font-medium">#{teeth.join(", #")} · </span>}
                  {c.work_type}{c.shade ? ` · ${c.shade}` : ""}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{stageLabel(c.status)}</span>
                  <span>{c.due_date ? `Due ${c.due_date}` : "No due date"}</span>
                </div>
                {c.instructions && <p className="line-clamp-2 text-xs text-muted-foreground">{c.instructions}</p>}
                <div className="flex gap-2">
                  <Button className="h-11 flex-1" disabled={!to || move.isPending} onClick={() => advance(c)}>
                    Done → {to ? stageLabel(to) : "—"} <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                  <Select onValueChange={(r) => hold.mutate({ id: c.id, reason: r })}>
                    <SelectTrigger className="h-11 w-11 justify-center px-0" aria-label="Put on hold"><PauseCircle className="h-4 w-4" /></SelectTrigger>
                    <SelectContent>
                      {HOLD_REASONS.map((r: any) => { const v = typeof r === "string" ? r : r.label; return <SelectItem key={v} value={v}>{v}</SelectItem>; })}
                    </SelectContent>
                  </Select>
                  <PrintTravelerButton c={c} technician={staff.find((s: any) => s.id === c.technician_id)?.full_name} compact />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
