import { Router } from "express";
import { Listing } from "../models/listing";
import { ScheduledMessage } from "../models/scheduledMessage";
import type { DashboardAuthedRequest } from "../middleware/dashboardAuth";

export const scheduledMessagesRouter = Router();

async function findOwnedScheduledMessage(hostId: string, scheduledMessageId: string) {
  const listings = await Listing.find({ hostId }).select("_id");
  const listingIds = listings.map((l) => l._id.toString());
  return ScheduledMessage.findOne({ _id: scheduledMessageId, listingId: { $in: listingIds } });
}

scheduledMessagesRouter.post("/:id/send-now", async (req: DashboardAuthedRequest, res) => {
  const message = await findOwnedScheduledMessage(req.hostId!, String(req.params.id));
  if (!message) {
    res.status(404).json({ error: "Scheduled message not found" });
    return;
  }
  if (message.status !== "scheduled") {
    res.status(400).json({ error: `Cannot send a message with status "${message.status}"` });
    return;
  }
  message.sendAt = new Date();
  await message.save();
  res.json(message);
});

scheduledMessagesRouter.post("/:id/skip", async (req: DashboardAuthedRequest, res) => {
  const message = await findOwnedScheduledMessage(req.hostId!, String(req.params.id));
  if (!message) {
    res.status(404).json({ error: "Scheduled message not found" });
    return;
  }
  if (message.status !== "scheduled") {
    res.status(400).json({ error: `Cannot skip a message with status "${message.status}"` });
    return;
  }
  message.status = "skipped";
  message.skipReason = "host_manual";
  await message.save();
  res.json(message);
});
