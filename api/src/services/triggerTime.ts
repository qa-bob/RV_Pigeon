import type { OffsetDirection, OffsetUnit, TriggerEvent } from "@rv-pigeon/shared";

export interface TripTimestamps {
  bookedAt: Date;
  startAt: Date;
  endAt: Date;
}

export interface TriggerSpec {
  triggerEvent: TriggerEvent;
  offsetAmount: number;
  offsetUnit: OffsetUnit;
  offsetDirection: OffsetDirection;
}

const UNIT_MS: Record<OffsetUnit, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

function baseTimeFor(event: TriggerEvent, trip: TripTimestamps): Date {
  switch (event) {
    case "trip_booked":
      return trip.bookedAt;
    case "trip_start":
      return trip.startAt;
    case "trip_finish":
      return trip.endAt;
    case "trip_three_quarter": {
      const durationMs = trip.endAt.getTime() - trip.startAt.getTime();
      return new Date(trip.startAt.getTime() + durationMs * 0.75);
    }
  }
}

/**
 * Pure function: given a trip's timestamps and a template's trigger, compute
 * the concrete datetime a ScheduledMessage should fire. Does not consider the
 * current time — a result in the past is valid and simply means the agent
 * should treat it as due on its next poll (see spec.md Edge Cases).
 */
export function computeSendAt(trip: TripTimestamps, trigger: TriggerSpec): Date {
  const base = baseTimeFor(trigger.triggerEvent, trip);
  const offsetMs = trigger.offsetAmount * UNIT_MS[trigger.offsetUnit];
  const signedOffsetMs = trigger.offsetDirection === "before" ? -offsetMs : offsetMs;
  return new Date(base.getTime() + signedOffsetMs);
}
