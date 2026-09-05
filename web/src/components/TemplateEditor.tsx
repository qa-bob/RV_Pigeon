import { FormEvent, useState } from "react";
import type { Listing, MessageTemplate, OffsetDirection, OffsetUnit, TriggerEvent } from "@rv-pigeon/shared";
import type { TemplateInput } from "../services/templates";

const TRIGGER_EVENTS: { value: TriggerEvent; label: string }[] = [
  { value: "trip_booked", label: "Trip booked" },
  { value: "trip_start", label: "Trip start" },
  { value: "trip_three_quarter", label: "Trip 3/4 time" },
  { value: "trip_finish", label: "Trip finish" },
];
const OFFSET_UNITS: OffsetUnit[] = ["minutes", "hours", "days"];
const OFFSET_DIRECTIONS: OffsetDirection[] = ["before", "after"];
const BODY_MAX_LENGTH = 2000;

interface Props {
  template?: MessageTemplate;
  listings: Listing[];
  onSave: (input: TemplateInput) => Promise<void>;
  onCancel: () => void;
}

export function TemplateEditor({ template, listings, onSave, onCancel }: Props) {
  const [name, setName] = useState(template?.name ?? "");
  const [triggerEvent, setTriggerEvent] = useState<TriggerEvent>(
    template?.triggerEvent ?? "trip_booked",
  );
  const [offsetAmount, setOffsetAmount] = useState(template?.offsetAmount ?? 1);
  const [offsetUnit, setOffsetUnit] = useState<OffsetUnit>(template?.offsetUnit ?? "hours");
  const [offsetDirection, setOffsetDirection] = useState<OffsetDirection>(
    template?.offsetDirection ?? "after",
  );
  const [body, setBody] = useState(template?.body ?? "");
  const [allListings, setAllListings] = useState(template?.applicability.allListings ?? true);
  const [listingIds, setListingIds] = useState<string[]>(template?.applicability.listingIds ?? []);
  const [active, setActive] = useState(template?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleListing(id: string) {
    setListingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allListings && listingIds.length === 0) {
      setError("Select at least one listing, or apply to all listings.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name,
        triggerEvent,
        offsetAmount,
        offsetUnit,
        offsetDirection,
        body,
        applicability: { allListings, listingIds },
        active,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: 480 }}>
      <label>
        Template name (internal only)
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <fieldset style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <legend>Schedule</legend>
        <select value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value as TriggerEvent)}>
          {TRIGGER_EVENTS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={offsetAmount}
          onChange={(e) => setOffsetAmount(Number(e.target.value))}
          style={{ width: "5rem" }}
        />
        <select value={offsetUnit} onChange={(e) => setOffsetUnit(e.target.value as OffsetUnit)}>
          {OFFSET_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select
          value={offsetDirection}
          onChange={(e) => setOffsetDirection(e.target.value as OffsetDirection)}
        >
          {OFFSET_DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </fieldset>

      <label>
        Message ({body.length}/{BODY_MAX_LENGTH})
        <textarea
          value={body}
          maxLength={BODY_MAX_LENGTH}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          required
        />
      </label>
      <small>
        Variables: {"{{GUEST_FIRST_NAME}}"}, {"{{GUEST_LAST_NAME}}"}, {"{{HOST_FIRST_NAME}}"},{" "}
        {"{{HOST_PHONE_NUMBER}}"}
      </small>

      <fieldset>
        <legend>Listings</legend>
        <label>
          <input
            type="checkbox"
            checked={allListings}
            onChange={(e) => setAllListings(e.target.checked)}
          />
          Apply to all listings
        </label>
        {!allListings &&
          listings.map((listing) => (
            <label key={listing.id} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={listingIds.includes(listing.id)}
                onChange={() => toggleListing(listing.id)}
              />
              {listing.label}
            </label>
          ))}
      </fieldset>

      <label>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>

      {error && <p role="alert">{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
