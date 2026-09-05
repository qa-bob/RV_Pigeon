import "dotenv/config";
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "../src/db";
import { Host } from "../src/models/host";

const ENTER_CODES = [10, 13]; // \n, \r
const CTRL_C_CODE = 3;
const BACKSPACE_CODES = [8, 127]; // BS, DEL

async function prompt(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  if (!hidden) {
    const answer = await rl.question(question);
    rl.close();
    return answer.trim();
  }
  // Minimal masked input for the password prompt.
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode?.(true);
    let value = "";
    const onData = (buf: Buffer) => {
      const code = buf[0];
      if (ENTER_CODES.includes(code)) {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        rl.close();
        resolve(value);
        return;
      }
      if (code === CTRL_C_CODE) {
        stdin.setRawMode?.(false);
        process.exit(1);
      }
      if (BACKSPACE_CODES.includes(code)) {
        value = value.slice(0, -1);
        return;
      }
      value += buf.toString("utf8");
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const email = process.env.SEED_HOST_EMAIL ?? (await prompt("Host email: "));
  const password = process.env.SEED_HOST_PASSWORD ?? (await prompt("Host password: ", true));

  if (!email || !password) {
    console.error("Email and password are both required.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  await connectDb();

  const existing = await Host.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    console.error(`A host with email ${email} already exists.`);
    await disconnectDb();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await Host.create({ email: email.toLowerCase().trim(), passwordHash });

  console.log(`Host account created for ${email}.`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
