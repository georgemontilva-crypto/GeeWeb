import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button, Field, Input } from "@/components/ui";

export default function Track() {
  const [, navigate] = useLocation();
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const find = trpc.store.findOrder.useMutation({
    onSuccess: ({ token }) => navigate(`/pedido/${token}`),
    onError: (err) => {
      let msg = err.message;
      if (msg.trim().startsWith("[")) msg = "Revisa el número de pedido y el correo.";
      setError(msg);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!number.trim() || !email.trim()) {
      setError("Escribe tu número de pedido y tu correo.");
      return;
    }
    find.mutate({ number, email: email.trim() });
  };

  return (
    <div className="wrap pt-[124px]">
      <div className="mx-auto max-w-[520px]">
        <h1 className="headline text-[clamp(2.4rem,6vw,4rem)]">Sigue tu pedido.</h1>
        <p className="mt-4 text-[19px] text-ink-2">
          Escribe el número que te enviamos por correo y el correo con el que compraste.
        </p>
        <form onSubmit={submit} noValidate className="mt-9 space-y-4">
          <Field label="Número de pedido">
            <Input placeholder="GE-10001" value={number} onChange={(e) => setNumber(e.target.value)} autoCapitalize="characters" />
          </Field>
          <Field label="Correo">
            <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && (
            <p role="alert" className="text-[15px] text-bad">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={find.isPending}>
            Buscar mi pedido
          </Button>
        </form>
      </div>
    </div>
  );
}
