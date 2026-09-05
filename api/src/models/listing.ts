import { Schema, model, Types, InferSchemaType } from "mongoose";

const faqSchema = new Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const listingSchema = new Schema(
  {
    hostId: { type: Schema.Types.ObjectId, ref: "Host", required: true },
    label: { type: String, required: true, trim: true },
    externalListingId: { type: String, required: true },
    guestInstructions: {
      pickupReturnInstructions: { type: String, default: "", maxlength: 5000 },
      welcomeMessage: { type: String, default: "", maxlength: 170 },
    },
    carGuide: {
      tips: { type: String, default: "", maxlength: 5000 },
      faqs: { type: [faqSchema], default: [] },
    },
  },
  { timestamps: true },
);

listingSchema.index({ hostId: 1, externalListingId: 1 }, { unique: true });

export type ListingDoc = InferSchemaType<typeof listingSchema> & { _id: Types.ObjectId };
export const Listing = model("Listing", listingSchema);
