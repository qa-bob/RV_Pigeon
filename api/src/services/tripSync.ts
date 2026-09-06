import type { AgentSyncTripInput } from "@rv-pigeon/shared";
import { Listing } from "../models/listing";
import { Trip } from "../models/trip";
import { MessageTemplate } from "../models/messageTemplate";
import { ScheduledMessage } from "../models/scheduledMessage";
import { computeSendAt } from "./triggerTime";

export interface SyncTripsResult {
  created: number;
  updated: number;
}

async function scheduleMessagesForNewTrip(
  hostId: string,
  listingId: string,
  trip: { _id: string; bookedAt: Date; startAt: Date; endAt: Date },
): Promise<void> {
  const templates = await MessageTemplate.find({
    hostId,
    active: true,
    $or: [{ "applicability.allListings": true }, { "applicability.listingIds": listingId }],
  });

  for (const template of templates) {
    const sendAt = computeSendAt(
      { bookedAt: trip.bookedAt, startAt: trip.startAt, endAt: trip.endAt },
      {
        triggerEvent: template.triggerEvent as any,
        offsetAmount: template.offsetAmount,
        offsetUnit: template.offsetUnit as any,
        offsetDirection: template.offsetDirection as any,
      },
    );
    // Unique (tripId, templateId) index makes this safe to call more than
    // once for the same trip (e.g. a retried sync) without duplicating rows.
    await ScheduledMessage.updateOne(
      { tripId: trip._id, templateId: template._id },
      { $setOnInsert: { tripId: trip._id, templateId: template._id, listingId, sendAt, status: "scheduled" } },
      { upsert: true },
    );
  }
}

async function updateExistingTrip(
  tripId: string,
  bookedAt: Date,
  previousStatus: string,
  previousStartAt: Date,
  previousEndAt: Date,
  input: AgentSyncTripInput,
): Promise<void> {
  const newStartAt = new Date(input.startAt);
  const newEndAt = new Date(input.endAt);
  const datesChanged =
    previousStartAt.getTime() !== newStartAt.getTime() || previousEndAt.getTime() !== newEndAt.getTime();
  const becameCancelled = input.status === "cancelled" && previousStatus !== "cancelled";

  await Trip.updateOne(
    { _id: tripId },
    {
      $set: {
        guestFirstName: input.guestFirstName,
        guestLastName: input.guestLastName,
        startAt: newStartAt,
        endAt: newEndAt,
        status: input.status,
        lastSyncedAt: new Date(),
      },
    },
  );

  if (becameCancelled) {
    // Already-sent messages are untouched — they can't be un-sent, and
    // status is a one-way terminal transition (see data-model.md).
    await ScheduledMessage.updateMany(
      { tripId, status: "scheduled" },
      { $set: { status: "skipped", skipReason: "trip_cancelled" } },
    );
    return;
  }

  if (datesChanged) {
    const pending = await ScheduledMessage.find({ tripId, status: "scheduled" }).populate("templateId");
    for (const sm of pending) {
      const template = sm.templateId as any;
      sm.sendAt = computeSendAt(
        { bookedAt, startAt: newStartAt, endAt: newEndAt },
        {
          triggerEvent: template.triggerEvent,
          offsetAmount: template.offsetAmount,
          offsetUnit: template.offsetUnit,
          offsetDirection: template.offsetDirection,
        },
      );
      await sm.save();
    }
  }
}

/**
 * Create path (T033/US1) plus the update path (T045/US2): recomputes sendAt
 * on still-scheduled messages when a trip's dates change, and skips them
 * when a trip becomes cancelled.
 */
export async function syncTrips(
  hostId: string,
  listingExternalId: string,
  trips: AgentSyncTripInput[],
): Promise<SyncTripsResult> {
  const listing = await Listing.findOne({ hostId, externalListingId: listingExternalId });
  if (!listing) {
    throw new Error(`No listing found for hostId=${hostId} externalListingId=${listingExternalId}`);
  }

  let created = 0;
  let updated = 0;

  for (const input of trips) {
    const existing = await Trip.findOne({ listingId: listing._id, externalTripId: input.externalTripId });
    if (existing) {
      await updateExistingTrip(
        existing._id.toString(),
        existing.bookedAt,
        existing.status,
        existing.startAt,
        existing.endAt,
        input,
      );
      updated += 1;
      continue;
    }

    // Outdoorsy exposes no booking-creation timestamp anywhere in its host
    // UI (confirmed 2026-09-05 — see research.md "Trip booked timestamp
    // source"), so "trip booked" is defined as the moment RV_Pigeon itself
    // first discovers the trip, not something scraped.
    const trip = await Trip.create({
      listingId: listing._id,
      externalTripId: input.externalTripId,
      guestFirstName: input.guestFirstName,
      guestLastName: input.guestLastName,
      bookedAt: new Date(),
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      status: input.status,
      lastSyncedAt: new Date(),
    });
    created += 1;

    await scheduleMessagesForNewTrip(hostId, listing._id.toString(), {
      _id: trip._id.toString(),
      bookedAt: trip.bookedAt,
      startAt: trip.startAt,
      endAt: trip.endAt,
    });
  }

  return { created, updated };
}
