import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Listing } from "@rv-pigeon/shared";
import { createListing, listListings } from "../services/listings";

export default function Listings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [label, setLabel] = useState("");
  const [externalListingId, setExternalListingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const l = await listListings();
    setListings(l);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createListing({ label, externalListingId });
      setLabel("");
      setExternalListingId("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h2>Listings</h2>
      <ul>
        {listings.map((listing) => (
          <li key={listing.id}>
            {listing.label} — <Link to={`/listings/${listing.id}`}>Edit content</Link>
          </li>
        ))}
      </ul>
      {listings.length === 0 && <p>No listings yet.</p>}

      <h3>Add a listing</h3>
      <form onSubmit={handleCreate} style={{ display: "grid", gap: "0.5rem", maxWidth: 400 }}>
        <label>
          Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </label>
        <label>
          External listing id (your own identifier, e.g. "eclipse-milan" — must match this
          listing's OUTDOORSY_LISTING_ID in agent/.env)
          <input
            value={externalListingId}
            onChange={(e) => setExternalListingId(e.target.value)}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Add listing</button>
      </form>
    </div>
  );
}
