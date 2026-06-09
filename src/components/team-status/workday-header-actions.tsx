"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { ConfirmActionModal } from "./confirm-action-modal";
import { useWorkdayStatus } from "./use-workday-status";
import {
  actionButtonLabel,
  formatWorkdayClock,
  statusStyles,
  type WorkdayAction,
} from "./workday-utils";

function StatusPill({
  status,
  timerLabel,
  className,
}: {
  status: string;
  timerLabel: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-md border px-2.5 text-xs",
        statusStyles(status as Parameters<typeof statusStyles>[0]),
        className,
      )}
    >
      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden />
      <span className="whitespace-nowrap font-medium">{status}</span>
      <span className="font-mono text-[11px] opacity-90">· {timerLabel}</span>
    </div>
  );
}

function ActionButtons({
  dayAction,
  breakAction,
  showDayButton,
  showBreakButton,
  submitting,
  onSelectAction,
  layout,
}: {
  dayAction: WorkdayAction | undefined;
  breakAction: WorkdayAction | undefined;
  showDayButton: boolean;
  showBreakButton: boolean;
  submitting: boolean;
  onSelectAction: (eventType: WorkdayAction["eventType"]) => void;
  layout: "inline" | "stacked";
}) {
  return (
    <div className={cn("flex gap-2", layout === "stacked" ? "flex-col" : "items-center")}>
      {showDayButton && dayAction ? (
        <Button
          disabled={!dayAction.enabled || submitting}
          onClick={() => onSelectAction(dayAction.eventType)}
          className={cn("h-9 px-3 text-xs", layout === "stacked" && "w-full justify-center")}
          title={dayAction.reason}
        >
          {actionButtonLabel(dayAction.eventType)}
        </Button>
      ) : null}
      {showBreakButton && breakAction ? (
        <Button
          variant="secondary"
          disabled={!breakAction.enabled || submitting}
          onClick={() => onSelectAction(breakAction.eventType)}
          className={cn("h-9 px-3 text-xs", layout === "stacked" && "w-full justify-center")}
          title={breakAction.reason}
        >
          {actionButtonLabel(breakAction.eventType)}
        </Button>
      ) : null}
    </div>
  );
}

export function WorkdayHeaderActions() {
  const {
    current,
    error,
    pendingAction,
    setPendingAction,
    submitting,
    displayTimerSeconds,
    dayAction,
    breakAction,
    submitAction,
  } = useWorkdayStatus();

  const timerLabel = formatWorkdayClock(displayTimerSeconds);

  if (!current) {
    return (
      <div className="flex h-9 items-center rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 text-xs text-zinc-400">
        {error ?? "Loading…"}
      </div>
    );
  }

  const showDayButton = Boolean(dayAction && (dayAction.enabled || current.status === "On Break"));
  const showBreakButton = Boolean(breakAction?.enabled);
  const hasActions = showDayButton || showBreakButton;

  return (
    <>
      <div className="hidden items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1.5 md:flex">
        <StatusPill status={current.status} timerLabel={timerLabel} />
        {hasActions ? (
          <ActionButtons
            dayAction={dayAction}
            breakAction={breakAction}
            showDayButton={showDayButton}
            showBreakButton={showBreakButton}
            submitting={submitting}
            onSelectAction={setPendingAction}
            layout="inline"
          />
        ) : null}
      </div>

      <details className="group relative md:hidden">
        <summary
          className={cn(
            "flex h-9 cursor-pointer list-none items-center gap-2 rounded-full border px-2.5 text-xs transition",
            statusStyles(current.status),
            "hover:brightness-110",
            "[&::-webkit-details-marker]:hidden",
          )}
          title={current.last_event_time_local_label ?? "Workday status"}
        >
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden />
          <span className="max-w-[5rem] truncate font-medium">{current.status}</span>
          <span className="font-mono text-[11px] opacity-90">{timerLabel}</span>
        </summary>
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+0.35rem)] z-30 w-56 space-y-3 rounded-lg border p-3 shadow-xl",
            statusStyles(current.status),
          )}
        >
          <div className="space-y-1 text-xs">
            <p className="font-medium">{current.status}</p>
            <p className="text-zinc-400">
              {current.last_event_time_local_label
                ? `Last event: ${current.last_event_time_local_label}`
                : "No status event submitted today"}
            </p>
            <p className="font-mono text-zinc-200">{timerLabel}</p>
          </div>
          {hasActions ? (
            <ActionButtons
              dayAction={dayAction}
              breakAction={breakAction}
              showDayButton={showDayButton}
              showBreakButton={showBreakButton}
              submitting={submitting}
              onSelectAction={(eventType) => {
                setPendingAction(eventType);
              }}
              layout="stacked"
            />
          ) : null}
        </div>
      </details>

      {pendingAction ? (
        <ConfirmActionModal
          pendingAction={pendingAction}
          submitting={submitting}
          onCancel={() => setPendingAction(null)}
          onConfirm={submitAction}
        />
      ) : null}
    </>
  );
}
