import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Trip } from "@rv-pigeon/shared";
import { listTrips } from "../services/trips";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Trips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTrips().then((t) => {
      setTrips(t);
      setLoading(false);
    });
  }, []);

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h2>Trips</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Guest</th>
            <th style={{ textAlign: "left" }}>Starts</th>
            <th style={{ textAlign: "left" }}>Ends</th>
            <th style={{ textAlign: "left" }}>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => (
            <tr key={trip.id}>
              <td>
                {trip.guestFirstName} {trip.guestLastName}
              </td>
              <td>{formatDate(trip.startAt)}</td>
              <td>{formatDate(trip.endAt)}</td>
              <td>{trip.status}</td>
              <td>
                <Link to={`/trips/${trip.id}`}>View schedule</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {trips.length === 0 && <p>No trips synced yet.</p>}
    </div>
  );
}
