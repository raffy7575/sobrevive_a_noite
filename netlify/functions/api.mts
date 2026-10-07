import type { Context, Config } from "@netlify/functions";
import { getStore, getDeployStore } from "@netlify/blobs";
import { createHandler } from "../lib/http.mjs";

let handler: ((req: Request, ctx: Context) => Promise<Response>) | null = null;

// Em produção os dados ficam num store global; em pré-visualizações ficam isolados por deploy.
function build(context: Context) {
  const prod = context.deploy?.context === "production";
  const open = (name: string) =>
    prod ? getStore({ name, consistency: "strong" }) : getDeployStore({ name, consistency: "strong" });
  return createHandler({
    players: open("players"),
    lb: open("leaderboard"),
    runs: open("runs"),
    misc: open("misc"),
    adminKey: Netlify.env.get("ADMIN_KEY") || "",
  });
}

export default async (req: Request, context: Context) => {
  handler ||= build(context);
  return handler(req, context);
};

export const config: Config = {
  path: "/api/*",
};
