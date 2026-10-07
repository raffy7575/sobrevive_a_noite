import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { cleanup } from "../lib/api.mjs";

// Corre todos os dias (só em produção): apaga semanas antigas, partidas abandonadas e contadores de limite.
export default async (_req: Request, _context: Context) => {
  const open = (name: string) => getStore({ name, consistency: "strong" });
  const out = await cleanup({ lb: open("leaderboard"), runs: open("runs"), misc: open("misc") });
  console.log("cleanup", JSON.stringify(out));
};

export const config: Config = {
  schedule: "@daily",
};
