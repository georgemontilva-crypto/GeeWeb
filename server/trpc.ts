import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { readSession } from "./auth";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const uid = await readSession(req);
  let user: { id: number; email: string; name: string } | null = null;
  if (uid) {
    const [row] = await db
      .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, uid))
      .limit(1);
    user = row ?? null;
  }
  const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? req.ip ?? "").trim();
  return { req, res, user, ip };
}
export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Inicia sesión para continuar." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const fail = (message: string, code: TRPCError["code"] = "BAD_REQUEST") =>
  new TRPCError({ code, message });
