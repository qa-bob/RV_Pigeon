import { computeSendAt } from "../../src/services/triggerTime";

const trip = {
  bookedAt: new Date("2026-09-01T12:00:00Z"),
  startAt: new Date("2026-09-10T16:00:00Z"),
  endAt: new Date("2026-09-14T16:00:00Z"), // 4-day trip
};

describe("computeSendAt", () => {
  it("computes trip_booked + after offset", () => {
    const result = computeSendAt(trip, {
      triggerEvent: "trip_booked",
      offsetAmount: 1,
      offsetUnit: "hours",
      offsetDirection: "after",
    });
    expect(result).toEqual(new Date("2026-09-01T13:00:00Z"));
  });

  it("computes trip_start - before offset", () => {
    const result = computeSendAt(trip, {
      triggerEvent: "trip_start",
      offsetAmount: 1,
      offsetUnit: "days",
      offsetDirection: "before",
    });
    expect(result).toEqual(new Date("2026-09-09T16:00:00Z"));
  });

  it("computes trip_finish - before offset (minutes)", () => {
    const result = computeSendAt(trip, {
      triggerEvent: "trip_finish",
      offsetAmount: 30,
      offsetUnit: "minutes",
      offsetDirection: "before",
    });
    expect(result).toEqual(new Date("2026-09-14T15:30:00Z"));
  });

  it("computes trip_finish + after offset", () => {
    const result = computeSendAt(trip, {
      triggerEvent: "trip_finish",
      offsetAmount: 1,
      offsetUnit: "hours",
      offsetDirection: "after",
    });
    expect(result).toEqual(new Date("2026-09-14T17:00:00Z"));
  });

  it("computes trip_three_quarter as 75% between start and end, with no offset", () => {
    const result = computeSendAt(trip, {
      triggerEvent: "trip_three_quarter",
      offsetAmount: 0,
      offsetUnit: "hours",
      offsetDirection: "after",
    });
    // 4-day trip: 75% of 96h = 72h after start
    expect(result).toEqual(new Date("2026-09-13T16:00:00Z"));
  });

  it("computes trip_three_quarter with a before offset applied on top", () => {
    const result = computeSendAt(trip, {
      triggerEvent: "trip_three_quarter",
      offsetAmount: 2,
      offsetUnit: "hours",
      offsetDirection: "before",
    });
    expect(result).toEqual(new Date("2026-09-13T14:00:00Z"));
  });

  it("returns a past datetime without error when the computed time has already elapsed", () => {
    // Trip booked long ago; the '1 hour after booked' send time is far in the past
    // by the time this is (re)computed. The function must not special-case "now" —
    // it's the caller's (agent's) job to still deliver it on the next poll.
    const oldTrip = {
      bookedAt: new Date("2020-01-01T00:00:00Z"),
      startAt: new Date("2020-01-05T00:00:00Z"),
      endAt: new Date("2020-01-08T00:00:00Z"),
    };
    const result = computeSendAt(oldTrip, {
      triggerEvent: "trip_booked",
      offsetAmount: 1,
      offsetUnit: "hours",
      offsetDirection: "after",
    });
    expect(result.getTime()).toBeLessThan(Date.now());
    expect(result).toEqual(new Date("2020-01-01T01:00:00Z"));
  });
});
