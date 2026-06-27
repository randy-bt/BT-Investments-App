"use client";

import { useEffect, useState } from "react";
import { listJvEvents } from "@/actions/jv-deals";
import type { JvDealEvent } from "@/lib/types";

type EventRow = JvDealEvent & {
  actor_name: string | null;
  deal_address: string | null;
};

export function JvActivityLog() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listJvEvents()
      .then((result) => {
        if (result.success) {
          setEvents(result.data);
        } else {
          setError(result.error);
        }
      })
      .catch(() => setError("Failed to load JV activity."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Loading...
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        No activity yet.
      </p>
    );
  }

  return (
    <ul className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700">
      {events.map((event) => (
        <li
          key={event.id}
          className="py-1.5 text-xs text-neutral-700 dark:text-neutral-300 font-mono"
        >
          {new Date(event.created_at).toLocaleString()} &middot;{" "}
          {event.event_type} &middot;{" "}
          {event.deal_address ?? "—"} &middot;{" "}
          {event.actor_name ?? "system"}
        </li>
      ))}
    </ul>
  );
}
