import { Schema, model, Types, InferSchemaType } from "mongoose";

const TRIP_STATUSES = ["booked", "active", "completed", "cancelled"] as const;

const tripSchema = new Schema(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    externalTripId: { type: String, required: true },
    guestFirstName: { type: String, required: true, trim: true },
    guestLastName: { type: String, default: "", trim: true },
    bookedAt: { type: Date, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: TRIP_STATUSES, required: true, default: "booked" },
    lastSyncedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true },
);

tripSchema.index({ listingId: 1, externalTripId: 1 }, { unique: true });

export type TripDoc = InferSchemaType<typeof tripSchema> & { _id: Types.ObjectId };
export const Trip = model("Trip", tripSchema);
export { TRIP_STATUSES };
