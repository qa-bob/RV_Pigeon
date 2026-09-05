import "dotenv/config";
import { outdoorsyAdapter } from "./adapters/outdoorsy";
import { getDueMessages, reportResult } from "./apiClient";

export async function runDeliver(): Promise<void> {
  const due = await getDueMessages();
  if (due.length === 0) {
    console.log("No due messages.");
    return;
  }

  // login() used to be outside any try/catch here, which meant a session
  // failure propagated uncaught all the way to the bottom of this file with
  // no console output at all.
  let session: Awaited<ReturnType<typeof outdoorsyAdapter.login>>;
  try {
    session = await outdoorsyAdapter.login();
  } catch (err) {
    console.error("Could not log in to deliver messages:", (err as Error).message);
    throw err;
  }

  try {
    for (const message of due) {
      try {
        await outdoorsyAdapter.postMessage(session, message.tripExternalId, message.renderedBody);
        await reportResult({ scheduledMessageId: message.scheduledMessageId, outcome: "sent" });
        console.log(`Sent message for trip ${message.tripExternalId}.`);
      } catch (err) {
        const detail = (err as Error).message;
        console.error(`Failed to deliver message for trip ${message.tripExternalId}:`, detail);
        await reportResult({
          scheduledMessageId: message.scheduledMessageId,
          outcome: "failed",
          detail,
        }).catch((reportErr) => {
          console.error("Additionally failed to report the delivery failure to the API:", reportErr);
        });
      }
    }
  } finally {
    await outdoorsyAdapter.close(session);
  }
}

if (require.main === module) {
  runDeliver().catch((err) => {
    console.error("Fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
