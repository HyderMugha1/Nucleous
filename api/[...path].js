import { app } from "../server/app.js";
import { connectDatabase } from "../server/db.js";
import { validateConfig } from "../server/config.js";

let bootstrapPromise = null;

async function ensureServerReady() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await validateConfig();
      await connectDatabase();
    })();
  }

  return bootstrapPromise;
}

export default async function handler(req, res) {
  await ensureServerReady();
  return app(req, res);
}
