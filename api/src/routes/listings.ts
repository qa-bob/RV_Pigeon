import { Router } from "express";
import { Error as MongooseError } from "mongoose";
import { Listing } from "../models/listing";
import type { DashboardAuthedRequest } from "../middleware/dashboardAuth";

export const listingsRouter = Router();

listingsRouter.get("/", async (req: DashboardAuthedRequest, res) => {
  const listings = await Listing.find({ hostId: req.hostId }).sort({ createdAt: 1 });
  res.json(listings);
});

listingsRouter.post("/", async (req: DashboardAuthedRequest, res) => {
  try {
    const listing = await Listing.create({ ...req.body, hostId: req.hostId });
    res.status(201).json(listing);
  } catch (err) {
    if (err instanceof MongooseError.ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

listingsRouter.patch("/:id", async (req: DashboardAuthedRequest, res) => {
  const listing = await Listing.findOne({ _id: req.params.id, hostId: req.hostId });
  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  try {
    listing.set(req.body);
    await listing.save();
    res.json(listing);
  } catch (err) {
    if (err instanceof MongooseError.ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});
