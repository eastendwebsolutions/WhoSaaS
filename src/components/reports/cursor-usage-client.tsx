"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Connection = {
  id: string;
  accountLabel: string;
  lastSyncSuccessAt: string | null;
  lastSyncError: string | null;
};

type SummaryCard = { key: string; label: string; value: number | null; tooltip: string };

type UserRow = {
  connectionId: string;
  accountLabel: string;
  userId: string | null;
  cursorExternalUserId: string;
  displayName: string;
  email: string;
  mapped: boolean;
  spendDollars: number | null;
  poolSharePercent: number | null;
  topDrivers: Array<{ key: string; label: string; value: number; sharePercent: number }>;
  suggestionCount: number;
};

type Suggestion = {
  id: string;
  userId: string | null;
  category: string;
  severity: string;
  title: string;
  explanation: string;
  recommendedAction: string;
  evidenceJson: Record<string, unknown>;
  thresholdJson: Record<string, unknown>;
  ruleVersion: string;
};

function buildQuery(filters: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) p.set(k, v);
  }
  return p.toString();
}

type Props = {
  isAdmin: boolean;
};

export function CursorUsageClient({ isAdmin }: Props) {
  const [connectionId, setConnectionId] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 90);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const filterKey = useMemo(
    () => buildQuery({ connectionId: connectionId || undefined, startDate, endDate }),
    [connectionId, startDate, endDate],
  );

  const connectionsQuery = useQuery({
    queryKey: ["cursor-connections"],
    queryFn: async () => {
      const res = await fetch("/api/reports/cursor-usage/connections");
      if (!res.ok) throw new Error("Failed to load connections");
      return (await res.json()) as { connections: Connection[] };
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["cursor-summary", filterKey],
    queryFn: async () => {
      const res = await fetch(`/api/reports/cursor-usage/summary?${filterKey}`);
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json() as Promise<{
        cards: SummaryCard[];
        lastSyncAt: string | null;
        workspace: { companyName: string; asanaWorkspaceId: string | null };
        connections: Connection[];
      }>;
    },
  });

  const usersQuery = useQuery({
    queryKey: ["cursor-users", filterKey],
    queryFn: async () => {
      const res = await fetch(`/api/reports/cursor-usage/users?${filterKey}`);
      if (!res.ok) throw new Error("Failed to load users");
      return (await res.json()) as { users: UserRow[] };
    },
  });

  const trendsQuery = useQuery({
    queryKey: ["cursor-trends", filterKey],
    queryFn: async () => {
      const res = await fetch(`/api/reports/cursor-usage/trends?${filterKey}`);
      if (!res.ok) throw new Error("Failed to load trends");
      return res.json() as Promise<{
        usage: Array<{ date: string; totalRequests: number; acceptedCompletions: number; aiLinesAdded: number }>;
        features: Array<{ date: string; agentCount: number; tabCount: number; planCount: number }>;
      }>;
    },
  });

  const suggestionsQuery = useQuery({
    queryKey: ["cursor-suggestions", filterKey, selectedUserId],
    queryFn: async () => {
      const p = new URLSearchParams(filterKey);
      if (selectedUserId) p.set("userId", selectedUserId);
      const res = await fetch(`/api/reports/cursor-usage/suggestions?${p.toString()}`);
      if (!res.ok) throw new Error("Failed to load suggestions");
      return (await res.json()) as { suggestions: Suggestion[] };
    },
  });

  const userDetailQuery = useQuery({
    queryKey: ["cursor-user-detail", selectedUserId, filterKey],
    enabled: Boolean(selectedUserId),
    queryFn: async () => {
      const res = await fetch(`/api/reports/cursor-usage/user/${selectedUserId}?${filterKey}`);
      if (!res.ok) throw new Error("Failed to load user detail");
      return res.json();
    },
  });

  const saveConnection = useCallback(async () => {
    if (!accountLabel.trim() || !apiKey.trim()) return;
    const res = await fetch("/api/reports/cursor-usage/connections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountLabel, apiKey }),
    });
    if (!res.ok) {
      setSyncMessage("Could not save connection.");
      return;
    }
    setApiKey("");
    setSyncMessage("Connection saved.");
    await connectionsQuery.refetch();
    await summaryQuery.refetch();
  }, [accountLabel, apiKey, connectionsQuery, summaryQuery]);

  const runSync = useCallback(async () => {
    const res = await fetch("/api/reports/cursor-usage/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: connectionId || undefined }),
    });
    if (!res.ok) {
      setSyncMessage("Sync failed.");
      return;
    }
    setSyncMessage("Sync completed.");
    await Promise.all([summaryQuery.refetch(), usersQuery.refetch(), trendsQuery.refetch(), suggestionsQuery.refetch()]);
  }, [connectionId, summaryQuery, usersQuery, trendsQuery, suggestionsQuery]);

  const cards = summaryQuery.data?.cards ?? [];
  const users = usersQuery.data?.users ?? [];
  const poolUsed = cards.find((c) => c.key === "pool_used_percent")?.value ?? null;
  const connections = connectionsQuery.data?.connections ?? summaryQuery.data?.connections ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-100">Cursor Usage and Best Practices</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Shared team learning for Cursor adoption, pool usage, and practical workflow improvements.
          {summaryQuery.data?.workspace.asanaWorkspaceId
            ? ` Workspace context: ${summaryQuery.data.workspace.asanaWorkspaceId}.`
            : null}
        </p>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-zinc-300">
            Last sync:{" "}
            <span className="text-zinc-100">
              {summaryQuery.data?.lastSyncAt
                ? new Date(summaryQuery.data.lastSyncAt).toLocaleString()
                : "Not synced yet"}
            </span>
            {connections.some((c) => c.lastSyncError) ? (
              <span className="ml-2 text-amber-400">Some accounts have sync errors.</span>
            ) : null}
          </div>
          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => void runSync()}>
                Sync now
              </Button>
            </div>
          ) : null}
        </div>
        {isAdmin ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              placeholder="Account label"
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
            />
            <input
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              placeholder="Cursor Admin API key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button type="button" onClick={() => void saveConnection()}>
              Add connection
            </Button>
          </div>
        ) : null}
        {syncMessage ? <p className="mt-2 text-xs text-zinc-400">{syncMessage}</p> : null}
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.key} className="border-zinc-800 bg-zinc-900/50 p-4" title={card.tooltip}>
            <p className="text-xs text-zinc-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-50">
              {card.value == null ? "—" : card.key.includes("percent") ? `${card.value}%` : card.value}
            </p>
          </Card>
        ))}
      </div>

      {poolUsed != null ? (
        <Card className="border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm text-zinc-300">Team pool consumption</p>
          <div className="mt-2 h-3 overflow-hidden rounded bg-zinc-800">
            <div className="h-full bg-indigo-500" style={{ width: `${Math.min(poolUsed, 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">{poolUsed}% of the shared Cursor pool used this billing cycle.</p>
        </Card>
      ) : null}

      <Card className="border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-wrap gap-3">
          {connections.length > 1 ? (
            <select
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
            >
              <option value="">All accounts</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.accountLabel}
                </option>
              ))}
            </select>
          ) : null}
          <input
            type="date"
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <a href={`/api/reports/cursor-usage/export?${filterKey}`}>
            <Button type="button" variant="secondary">
              Export CSV
            </Button>
          </a>
        </div>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-lg font-medium text-zinc-100">Usage trends</h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendsQuery.data?.usage ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis dataKey="date" stroke="#a1a1aa" tick={{ fontSize: 11 }} />
              <YAxis stroke="#a1a1aa" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="totalRequests" stroke="#818cf8" name="Requests" dot={false} />
              <Line type="monotone" dataKey="aiLinesAdded" stroke="#34d399" name="AI lines added" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-lg font-medium text-zinc-100">Best-practice suggestions</h2>
        <div className="mt-4 space-y-3">
          {(suggestionsQuery.data?.suggestions ?? []).slice(0, 8).map((s) => (
            <div key={s.id} className="rounded border border-zinc-800 p-3">
              <p className="font-medium text-zinc-100">{s.title}</p>
              <p className="mt-1 text-sm text-zinc-400">{s.explanation}</p>
              <p className="mt-2 text-sm text-indigo-300">{s.recommendedAction}</p>
              <p className="mt-2 text-xs text-zinc-500">
                Rule {s.ruleVersion} · {s.category} · evidence: {JSON.stringify(s.evidenceJson)}
              </p>
            </div>
          ))}
          {(suggestionsQuery.data?.suggestions ?? []).length === 0 ? (
            <p className="text-sm text-zinc-500">No suggestions yet. Connect Cursor and run a sync.</p>
          ) : null}
        </div>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-lg font-medium text-zinc-100">Team usage</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="px-2 py-2">Account</th>
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">Pool share</th>
                <th className="px-2 py-2">Spend</th>
                <th className="px-2 py-2">Top drivers</th>
                <th className="px-2 py-2">Suggestions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr
                  key={`${row.connectionId}:${row.cursorExternalUserId}`}
                  className="cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/60"
                  onClick={() => {
                    if (row.userId) setSelectedUserId(row.userId);
                  }}
                >
                  <td className="px-2 py-2 text-zinc-300">{row.accountLabel}</td>
                  <td className="px-2 py-2">
                    <div className="text-zinc-100">{row.displayName}</div>
                    <div className="text-xs text-zinc-500">
                      {row.email}
                      {!row.mapped ? " · unmapped" : ""}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-zinc-300">
                    {row.poolSharePercent != null ? `${row.poolSharePercent}%` : "—"}
                  </td>
                  <td className="px-2 py-2 text-zinc-300">
                    {row.spendDollars != null ? `$${row.spendDollars.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-zinc-400">
                    {(row.topDrivers ?? [])
                      .slice(0, 2)
                      .map((d) => `${d.label} (${d.sharePercent}%)`)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-2 py-2 text-zinc-300">{row.suggestionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedUserId ? (
        <Card className="border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-medium text-zinc-100">Individual detail</h3>
            <Button type="button" variant="secondary" onClick={() => setSelectedUserId(null)}>
              Close
            </Button>
          </div>
          {userDetailQuery.data ? (
            <div className="mt-4 space-y-2 text-sm text-zinc-300">
              <p>
                Requests: {userDetailQuery.data.usage.totalRequests} · Days active:{" "}
                {userDetailQuery.data.usage.daysWithUsage}
              </p>
              {userDetailQuery.data.spend ? (
                <p>
                  Pool share: {userDetailQuery.data.spend.poolSharePercent ?? "—"}% · Spend: $
                  {userDetailQuery.data.spend.spendDollars?.toFixed(2) ?? "—"}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">Loading detail…</p>
          )}
        </Card>
      ) : null}

      <p className="text-sm text-zinc-500">
        Want delivery correlation too?{" "}
        <Link href="/reports/developer-effectiveness" className="text-indigo-400 hover:underline">
          Open AI Developer Effectiveness
        </Link>
      </p>
    </section>
  );
}
