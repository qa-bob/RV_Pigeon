import { Schema, model, Types, InferSchemaType } from "mongoose";

const SCHEDULED_MESSAGE_STATUSES = ["scheduled", "sent", "skipped"] as const;
const SKIP_REASONS = ["host_manual", "trip_cancelled"] as const;

const scheduledMessageSchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: "Trip", required: true },
    templateId: { type: Schema.Types.ObjectId, ref: "MessageTemplate", required: true },
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    sendAt: { type: Date, required: true },
    status: { type: String, enum: SCHEDULED_MESSAGE_STATUSES, required: true, default: "scheduled" },
    sentAt: { type: Date, default: null },
    skipReason: { type: String, enum: SKIP_REASONS, default: null },
  },
  { timestamps: true },
);

scheduledMessageSchema.index({ tripId: 1, templateId: 1 }, { unique: true });
scheduledMessageSchema.index({ status: 1, sendAt: 1 });

export type ScheduledMessageDoc = InferSchemaType<typeof scheduledMessageSchema> & {
  _id: Types.ObjectId;
};
export const ScheduledMessage = model("ScheduledMessage", scheduledMessageSchema);
export { SCHEDULED_MESSAGE_STATUSES, SKIP_REASONS };
