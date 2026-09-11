import { initDb, seedAdminIfMissing } from '../db';
import { app, MASTER_ADMIN } from '../server';

// Vercel functions are stateless per cold start — cache the readiness
// promise so table creation and admin seeding run at most once per instance.
let readyPromise: Promise<void> | null = null;
function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = initDb().then(() => seedAdminIfMissing(MASTER_ADMIN));
  }
  return readyPromise;
}

export default async function handler(req: any, res: any) {
  await ensureReady();
  return (app as any)(req, res);
}
