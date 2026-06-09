export type WorkdayEventType = "DAY_IN" | "DAY_OUT" | "BREAK_IN" | "BREAK_OUT";

export type WorkdayAction = { eventType: WorkdayEventType; enabled: boolean; reason?: string };

export type WorkdayStatus = "Not Started" | "Working" | "On Break" | "Ended Day" | "Needs Review";

export type WorkdayCurrentPayload = {
  status: WorkdayStatus;
  last_event_type: WorkdayEventType | null;
  last_event_time_utc: string | null;
  last_event_time_local_label: string | null;
  available_actions: { dayAction: WorkdayAction; breakAction: WorkdayAction };
  active_work_seconds: number;
};

export function formatWorkdayClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const h = String(Math.floor(safe / 3600)).padStart(2, "0");
  const m = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function actionButtonLabel(type: WorkdayEventType) {
  return type
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function statusStyles(status: WorkdayStatus) {
  if (status === "Working") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (status === "On Break") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  if (status === "Ended Day") return "border-sky-500/40 bg-sky-500/10 text-sky-200";
  if (status === "Needs Review") return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  return "border-zinc-600 bg-zinc-800/60 text-zinc-300";
}

export function getDisplayTimerSeconds(current: WorkdayCurrentPayload | null, tick: number) {
  if (!current) return 0;

  if (current.status === "Working") {
    return current.active_work_seconds + tick;
  }

  if (current.status === "On Break" && current.last_event_time_utc) {
    const breakStartedAt = new Date(current.last_event_time_utc).getTime();
    const elapsed = Math.floor((Date.now() - breakStartedAt) / 1000);
    return Math.max(0, elapsed);
  }

  return current.active_work_seconds;
}
