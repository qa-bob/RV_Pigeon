import { Router } from "express";
import { Listing } from "../models/listing";
import { Trip } from "../models/trip";
import { ScheduledMessage } from "../models/scheduledMessage";
import type { DashboardAuthedRequest } from "../middleware/dashboardAuth";

export const tripsRouter = Router();

async function listingIdsForHost(hostId: string): Promise<string[]> {
  const listings = await Listing.find({ hostId }).select("_id");
  return listings.map((l) => l._id.toString());
}

tripsRouter.get("/", async (req: DashboardAuthedRequest, res) => {
  const listingIds = await listingIdsForHost(req.hostId!);
  const filter: Record<string, unknown> = { listingId: { $in: listingIds } };
  if (typeof req.query.status === "string") {
    filter.status = req.query.status;
  }
  if (typeof req.query.listingId === "string") {
    filter.listingId = req.query.listingId;
  }
  const trips = await Trip.find(filter).sort({ startAt: 1 });
  res.json(trips);
});

tripsRouter.get("/:id/scheduled-messages", async (req: DashboardAuthedRequest, res) => {
  const listingIds = await listingIdsForHost(req.hostId!);
  const trip = await Trip.findOne({ _id: req.params.id, listingId: { $in: listingIds } });
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  const messages = await ScheduledMessage.find({ tripId: trip._id })
    .sort({ sendAt: 1 })
    .populate("templateId", "name body");
  res.json(messages);
});

tripsRouter.post("/:id/scheduled-messages/skip-all-remaining", async (req: DashboardAuthedRequest, res) => {
  const listingIds = await listingIdsForHost(req.hostId!);
  const trip = await Trip.findOne({ _id: req.params.id, listingId: { $in: listingIds } });
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  const result = await ScheduledMessage.updateMany(
    { tripId: trip._id, status: "scheduled" },
    { $set: { status: "skipped", skipReason: "host_manual" } },
  );
  res.json({ skipped: result.modifiedCount });
});
