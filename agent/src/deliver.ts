import "dotenv/config";
import { loadCredentials } from "./credential-store";
import { outdoorsyAdapter } from "./adapters/outdoorsy";
import { getDueMessages, reportResult } from "./apiClient";

export async function runDeliver(): Promise<void> {
  const due = await getDueMessages();
  if (due.length === 0) {
    console.log("No due messages.");
    return;
  }

  const credentials = loadCredentials();
  const session = await outdoorsyAdapter.login(credentials);
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
  runDeliver().catch(() => process.exit(1));
}
