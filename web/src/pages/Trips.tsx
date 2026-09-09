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
    <div className="page">
      <h2>Trips</h2>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Starts</th>
              <th>Ends</th>
              <th>Status</th>
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
                <td>
                  <span className="badge">{trip.status}</span>
                </td>
                <td>
                  <Link to={`/trips/${trip.id}`}>View schedule</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {trips.length === 0 && <p>No trips synced yet.</p>}
      </div>
    </div>
  );
}
