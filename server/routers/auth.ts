import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db";
import { clearSession, createSession, rateLimit } from "../auth";
import { adminProcedure, fail, publicProcedure, router } from "../trpc";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  login: publicProcedure
    .input(z.object({ email: z.string().trim().max(191), password: z.string().max(200) }))
    .mutation(async ({ input, ctx }) => {
      if (!rateLimit(`login:${ctx.ip}`, 10, 15 * 60_000)) {
        throw fail("Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.", "TOO_MANY_REQUESTS");
      }
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, input.email.toLowerCase()))
        .limit(1);
      const ok = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
      if (!user || !ok) throw fail("El correo o la contraseña no coinciden.", "UNAUTHORIZED");
      await createSession(ctx.res, user.id);
      return { id: user.id, email: user.email, name: user.name };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearSession(ctx.res);
    return { ok: true };
  }),

  changePassword: adminProcedure
    .input(
      z.object({
        current: z.string().max(200),
        next: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres.").max(200),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, ctx.user.id)).limit(1);
      if (!user || !(await bcrypt.compare(input.current, user.passwordHash))) {
        throw fail("La contraseña actual no coincide.");
      }
      await db
        .update(schema.users)
        .set({ passwordHash: await bcrypt.hash(input.next, 11) })
        .where(eq(schema.users.id, user.id));
      return { ok: true };
    }),

  updateProfile: adminProcedure
    .input(z.object({ name: z.string().trim().max(120), email: z.email("Escribe un correo válido.").max(191) }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase();
      const [taken] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
      if (taken && taken.id !== ctx.user.id) throw fail("Ese correo ya lo usa otro usuario.");
      await db.update(schema.users).set({ name: input.name, email }).where(eq(schema.users.id, ctx.user.id));
      return { ok: true };
    }),
});
