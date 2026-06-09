"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WorkdayCurrentPayload, WorkdayEventType } from "./workday-utils";
import { getDisplayTimerSeconds } from "./workday-utils";

export function useWorkdayStatus() {
  const [current, setCurrent] = useState<WorkdayCurrentPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<WorkdayEventType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadCurrent = useCallback(async () => {
    const response = await fetch("/api/team-status/current", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load current status.");
    setCurrent(await response.json());
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        await loadCurrent();
        if (mounted) setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Unable to load status.");
      }
    }
    load();
    const refresh = window.setInterval(load, 5000);
    return () => {
      mounted = false;
      window.clearInterval(refresh);
    };
  }, [loadCurrent]);

  const displayTimerSeconds = useMemo(
    () => getDisplayTimerSeconds(current, tick),
    [current, tick],
  );

  const dayAction = current?.available_actions.dayAction;
  const breakAction = current?.available_actions.breakAction;

  async function submitAction() {
    if (!pendingAction) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/team-status/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: pendingAction }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Unable to submit status." }));
        throw new Error(payload.error ?? "Unable to submit status.");
      }
      setPendingAction(null);
      await loadCurrent();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit status.");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    current,
    error,
    pendingAction,
    setPendingAction,
    submitting,
    displayTimerSeconds,
    dayAction,
    breakAction,
    submitAction,
  };
}
