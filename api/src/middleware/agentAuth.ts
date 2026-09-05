import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function agentAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length);
  const expected = process.env.AGENT_SERVICE_TOKEN;
  if (!expected) {
    res.status(500).json({ error: "Server agent auth is not configured" });
    return;
  }
  if (!safeEqual(token, expected)) {
    res.status(401).json({ error: "Invalid service token" });
    return;
  }
  next();
}
