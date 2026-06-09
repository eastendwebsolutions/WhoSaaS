"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { actionButtonLabel } from "./workday-utils";
import type { WorkdayEventType } from "./workday-utils";

type Props = {
  pendingAction: WorkdayEventType;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmActionModal({ pendingAction, submitting, onCancel, onConfirm }: Props) {
  const label = actionButtonLabel(pendingAction);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-sm p-5">
        <h3 className="text-lg font-semibold text-zinc-100">Confirm {label}?</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Timestamp: {new Date().toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" disabled={submitting} onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={submitting} onClick={onConfirm}>
            {submitting ? "Submitting..." : `Confirm ${label}`}
          </Button>
        </div>
      </Card>
    </div>
  );
}
