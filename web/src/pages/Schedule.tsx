import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  listScheduledMessages,
  sendNow,
  skip,
  skipAllRemaining,
  ScheduledMessageWithTemplate,
} from "../services/trips";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Schedule() {
  const { tripId } = useParams<{ tripId: string }>();
  const [messages, setMessages] = useState<ScheduledMessageWithTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!tripId) return;
    const m = await listScheduledMessages(tripId);
    setMessages(m);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function handleSendNow(id: string) {
    await sendNow(id);
    await refresh();
  }

  async function handleSkip(id: string) {
    await skip(id);
    await refresh();
  }

  async function handleSkipAllRemaining() {
    if (!tripId) return;
    await skipAllRemaining(tripId);
    await refresh();
  }

  if (loading) return <p>Loading…</p>;

  const hasPending = messages.some((m) => m.status === "scheduled");

  return (
    <div>
      <p>
        <Link to="/trips">← Back to trips</Link>
      </p>
      <h2>Schedule</h2>
      <button onClick={handleSkipAllRemaining} disabled={!hasPending}>
        Skip all remaining
      </button>
      <table style={{ width: "100%", marginTop: "1rem", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Message</th>
            <th style={{ textAlign: "left" }}>Scheduled for</th>
            <th style={{ textAlign: "left" }}>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {messages.map((m) => (
            <tr key={m.id}>
              <td>{m.templateId.name}</td>
              <td>{formatDate(m.sendAt)}</td>
              <td>
                {m.status}
                {m.status === "skipped" && m.skipReason ? ` (${m.skipReason})` : ""}
              </td>
              <td>
                {m.status === "scheduled" && (
                  <>
                    <button onClick={() => handleSendNow(m.id)}>Send now</button>{" "}
                    <button onClick={() => handleSkip(m.id)}>Skip</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {messages.length === 0 && <p>No scheduled messages for this trip.</p>}
    </div>
  );
}
