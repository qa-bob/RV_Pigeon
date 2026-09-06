import { FormEvent, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Faq, Listing } from "@rv-pigeon/shared";
import { listListings, updateListing } from "../services/listings";
import { FaqListEditor } from "../components/FaqListEditor";

const WELCOME_MAX = 170;
const LONG_TEXT_MAX = 5000;

export default function ListingContent() {
  const { listingId } = useParams<{ listingId: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [pickupReturnInstructions, setPickupReturnInstructions] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [tips, setTips] = useState("");
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    listListings().then((listings) => {
      const found = listings.find((l) => l.id === listingId) ?? null;
      setListing(found);
      if (found) {
        setPickupReturnInstructions(found.guestInstructions.pickupReturnInstructions);
        setWelcomeMessage(found.guestInstructions.welcomeMessage);
        setTips(found.carGuide.tips);
        setFaqs(found.carGuide.faqs);
      }
    });
  }, [listingId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!listingId) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateListing(listingId, {
        guestInstructions: { pickupReturnInstructions, welcomeMessage },
        carGuide: { tips, faqs },
      });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!listing) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/listings">← Back to listings</Link>
      </p>
      <h2>{listing.label}</h2>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem", maxWidth: 560 }}>
        <label>
          Pickup &amp; return instructions ({pickupReturnInstructions.length}/{LONG_TEXT_MAX})
          <textarea
            value={pickupReturnInstructions}
            maxLength={LONG_TEXT_MAX}
            onChange={(e) => setPickupReturnInstructions(e.target.value)}
            rows={6}
          />
        </label>

        <label>
          Welcome message ({welcomeMessage.length}/{WELCOME_MAX})
          <textarea
            value={welcomeMessage}
            maxLength={WELCOME_MAX}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            rows={2}
          />
        </label>

        <label>
          Car guide tips ({tips.length}/{LONG_TEXT_MAX})
          <textarea value={tips} maxLength={LONG_TEXT_MAX} onChange={(e) => setTips(e.target.value)} rows={6} />
        </label>

        <div>
          <h3>FAQs</h3>
          <FaqListEditor faqs={faqs} onChange={setFaqs} />
        </div>

        {error && <p role="alert">{error}</p>}
        {saved && <p>Saved.</p>}

        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
