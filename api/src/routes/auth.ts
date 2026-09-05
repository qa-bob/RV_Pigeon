import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Host } from "../models/host";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const host = await Host.findOne({ email: email.toLowerCase().trim() });
  if (!host) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const matches = await bcrypt.compare(password, host.passwordHash);
  if (!matches) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server auth is not configured" });
    return;
  }

  const token = jwt.sign({ hostId: host._id.toString() }, secret, { expiresIn: "7d" });
  res.json({ token });
});
