import { Schema, model, Types, InferSchemaType } from "mongoose";

const TRIGGER_EVENTS = [
  "trip_booked",
  "trip_start",
  "trip_three_quarter",
  "trip_finish",
] as const;
const OFFSET_UNITS = ["minutes", "hours", "days"] as const;
const OFFSET_DIRECTIONS = ["before", "after"] as const;

const messageTemplateSchema = new Schema(
  {
    hostId: { type: Schema.Types.ObjectId, ref: "Host", required: true },
    name: { type: String, required: true, trim: true },
    triggerEvent: { type: String, enum: TRIGGER_EVENTS, required: true },
    offsetAmount: { type: Number, required: true, min: 0 },
    offsetUnit: { type: String, enum: OFFSET_UNITS, required: true },
    offsetDirection: { type: String, enum: OFFSET_DIRECTIONS, required: true },
    body: { type: String, required: true, maxlength: 2000 },
    applicability: {
      allListings: { type: Boolean, required: true, default: true },
      listingIds: { type: [Schema.Types.ObjectId], ref: "Listing", default: [] },
    },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

messageTemplateSchema.pre("validate", function (next) {
  const allListings = this.applicability?.allListings ?? true;
  const listingIds = this.applicability?.listingIds ?? [];
  if (!allListings && listingIds.length === 0) {
    next(new Error("applicability.listingIds must be non-empty when allListings is false"));
    return;
  }
  next();
});

export type MessageTemplateDoc = InferSchemaType<typeof messageTemplateSchema> & {
  _id: Types.ObjectId;
};
export const MessageTemplate = model("MessageTemplate", messageTemplateSchema);
export { TRIGGER_EVENTS, OFFSET_UNITS, OFFSET_DIRECTIONS };
