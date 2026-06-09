"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { addCalendarDaysInNy, getNowInNy } from "@/lib/services/team-status";
import type { WorkdayEventType } from "@/components/team-status/workday-utils";

type FeedPayload = {
  events: Array<{
    id: string;
    userId: string;
    userDisplayName: string;
    userInitials: string;
    eventType: WorkdayEventType;
    message: string;
    eventTimestampLocalLabel: string;
    eventLocalDate: string;
  }>;
  users: Array<{ id: string; displayName: string; email: string }>;
  companies: Array<{ id: string; name: string }>;
  requiresCompanyFilter: boolean;
};

export function TeamStatusPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [feed, setFeed] = useState<FeedPayload | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedUsersKey = selectedUsers.join(",");

  const loadFeed = useCallback(async () => {
    const query = new URLSearchParams();
    if (isSuperAdmin && selectedCompanyId) query.set("company_id", selectedCompanyId);
    if (selectedUsers.length) query.set("user_ids", selectedUsers.join(","));
    const response = await fetch(`/api/team-status/feed?${query.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load team feed.");
    setFeed(await response.json());
  }, [isSuperAdmin, selectedCompanyId, selectedUsers]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        await loadFeed();
        if (mounted) setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Unable to load team status.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const refresh = window.setInterval(load, 5000);
    return () => {
      mounted = false;
      window.clearInterval(refresh);
    };
  }, [loadFeed, selectedUsersKey]);

  const groupedFeedEvents = useMemo(() => {
    const groups = new Map<string, FeedPayload["events"]>();
    for (const event of feed?.events ?? []) {
      const list = groups.get(event.eventLocalDate) ?? [];
      list.push(event);
      groups.set(event.eventLocalDate, list);
    }
    return Array.from(groups.entries()).sort(([left], [right]) => right.localeCompare(left));
  }, [feed?.events]);

  function dayHeading(dateKey: string) {
    const todayKey = getNowInNy().dateKey;
    const yesterdayKey = addCalendarDaysInNy(todayKey, -1);
    if (dateKey === todayKey) return "Today";
    if (dateKey === yesterdayKey) return "Yesterday";
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-100">Team Status</h2>
          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin ? (
              <select
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                value={selectedCompanyId}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
              >
                <option value="">Select company</option>
                {(feed?.companies ?? []).map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            ) : null}
            <select
              className="min-w-52 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              multiple
              value={selectedUsers}
              onChange={(event) =>
                setSelectedUsers(Array.from(event.target.selectedOptions).map((option) => option.value))
              }
            >
              {(feed?.users ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading ? <p className="text-sm text-zinc-400">Loading feed...</p> : null}
        {feed?.requiresCompanyFilter ? (
          <p className="text-sm text-zinc-400">Select a company to view team status events.</p>
        ) : (
          <div className="space-y-4">
            {groupedFeedEvents.map(([dateKey, events]) => (
              <section key={dateKey} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{dayHeading(dateKey)}</h3>
                {events.map((event) => (
                  <div key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-100">
                        {event.userInitials}
                      </div>
                      <div>
                        <p className="text-sm text-zinc-100">{event.message}</p>
                        <p className="text-xs text-zinc-400">{event.eventTimestampLocalLabel}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            ))}
            {!feed?.events.length ? <p className="text-sm text-zinc-500">No team status events for today or yesterday.</p> : null}
          </div>
        )}
      </Card>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
