import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Field, Input } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { useShop } from "@/lib/shop";
import { errorMessage } from "./common";

export default function Login() {
  const shop = useShop();
  const utils = trpc.useUtils();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Al llegar aquí ya no hay sesión: se descarta lo que quedó en memoria del panel.
  useEffect(() => {
    qc.removeQueries({
      predicate: (q) => Array.isArray(q.queryKey[0]) && q.queryKey[0][0] === "admin",
    });
  }, [qc]);

  const login = trpc.auth.login.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (login.isPending) return;
    login.mutate({ email: email.trim(), password });
  };

  const storeName = shop?.settings.storeName ?? "";

  return (
    <div className="grid min-h-dvh place-items-center bg-mist px-4 py-10">
      <main className="w-full max-w-[400px]">
        <div className="mb-6 flex min-h-8 items-center justify-center">
          {shop?.settings.logoUrl ? (
            <img src={shop.settings.logoUrl} alt={storeName} className="h-8 w-auto max-w-[200px] object-contain" />
          ) : (
            <span className="text-[21px] font-semibold tracking-[-0.03em]">{storeName}</span>
          )}
        </div>
        <form onSubmit={submit} className="rounded-[28px] bg-white p-6 sm:p-8" noValidate>
          <h1 className="text-[28px] font-semibold">Entrar al panel</h1>
          <p className="mt-2 text-[15px] text-ink-2">Administra los pedidos, el catálogo y el contenido de la tienda.</p>
          <div className="mt-6 space-y-4">
            <Field label="Correo">
              <Input
                type="email"
                name="email"
                autoComplete="username"
                autoFocus
                required
                maxLength={191}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Contraseña">
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          </div>
          {login.isError && (
            <p role="alert" className="mt-4 text-[14px] text-bad">
              {errorMessage(login.error)}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-6 w-full" loading={login.isPending} disabled={!email.trim() || !password}>
            Entrar
          </Button>
        </form>
        <p className="mt-6 text-center text-[14px]">
          <a href="/" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            Volver a la tienda
          </a>
        </p>
      </main>
    </div>
  );
}
