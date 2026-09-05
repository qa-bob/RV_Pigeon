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

/**
 * Create path only (T033/US1). The update path — recomputing sendAt on date
 * changes and skipping on cancellation — is added in T045 (US2).
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
      updated += 1;
      continue;
    }

    const trip = await Trip.create({
      listingId: listing._id,
      externalTripId: input.externalTripId,
      guestFirstName: input.guestFirstName,
      guestLastName: input.guestLastName,
      bookedAt: new Date(input.bookedAt),
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
