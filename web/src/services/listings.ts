import type { Listing } from "@rv-pigeon/shared";
import { apiFetch } from "./apiClient";

export type ListingInput = Omit<Listing, "id" | "hostId" | "createdAt" | "updatedAt">;

export function listListings(): Promise<Listing[]> {
  return apiFetch("/api/listings");
}

export function createListing(input: Partial<ListingInput>): Promise<Listing> {
  return apiFetch("/api/listings", { method: "POST", body: JSON.stringify(input) });
}

export function updateListing(id: string, input: Partial<ListingInput>): Promise<Listing> {
  return apiFetch(`/api/listings/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
