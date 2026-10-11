import { useState, type ReactNode } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, type OrderStatus } from "@shared/types";
import { Button, ButtonLink, Field, Input, Select, StatusBadge, Textarea, Toggle, confirmDialog, toast, toastError } from "@/components/ui";
import { trpc, type Out } from "@/lib/trpc";
import { Card, onMist, LoadError, Loading, NotFound, PageHeader, Thumb, errorCode, fmtDateTime, useMoneyFor } from "./common";

type OrderData = Out["admin"]["orders"]["get"];
type Order = OrderData["order"];

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; done: string }>> = {
  pendiente: { to: "pagado", label: "Confirmar pago", done: "Pago confirmado" },
  pagado: { to: "preparando", label: "Marcar en preparación", done: "Pedido marcado en preparación" },
  preparando: { to: "enviado", label: "Marcar como enviado", done: "Pedido marcado como enviado" },
  enviado: { to: "entregado", label: "Marcar como entregado", done: "Pedido marcado como entregado" },
};

const asStatus = (v: string): OrderStatus =>
  (ORDER_STATUSES as readonly string[]).includes(v) ? (v as OrderStatus) : "pendiente";

export default function OrderDetail({ id }: { id: number }) {
  // Siempre al día: el cliente puede subir el comprobante en cualquier momento.
  const q = trpc.admin.orders.get.useQuery({ id }, { retry: false, staleTime: 0, refetchOnWindowFocus: true });

  if (q.isPending) return <Loading />;
  if (q.isError) {
    return errorCode(q.error) === "NOT_FOUND" ? (
      <NotFound
        title="Ese pedido no existe"
        text="Puede que el enlace esté incompleto. Búscalo en la lista de pedidos."
        href="/admin/pedidos"
        action="Ver los pedidos"
      />
    ) : (
      <LoadError error={q.error} retry={() => q.refetch()} />
    );
  }

  const { order, items, events } = q.data;
  return (
    <>
      <PageHeader
        back={{ href: "/admin/pedidos", label: "Pedidos" }}
        title={`Pedido ${order.number}`}
        actions={
          <ButtonLink href={`/pedido/${order.token}`} variant="ghost" size="sm" external className={onMist}>
            Ver como cliente
            <ExternalLink className="size-4" aria-hidden />
          </ButtonLink>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-ink-2">
          <StatusBadge status={order.status} />
          <span>{fmtDateTime(order.createdAt)}</span>
        </div>
      </PageHeader>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <StatusCard order={order} />
          <PaymentCard order={order} />
          <ItemsCard order={order} items={items} />
          <HistoryCard events={events} />
        </div>
        <div className="min-w-0 space-y-4">
          <CustomerCard order={order} />
          <TrackingCard order={order} />
        </div>
      </div>
    </>
  );
}

/* ───────────── Estado ───────────── */

function StatusCard({ order }: { order: Order }) {
  const utils = trpc.useUtils();
  const status = asStatus(order.status);
  const next = NEXT[status];
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [manual, setManual] = useState<OrderStatus>(status);
  const [busy, setBusy] = useState<"next" | "manual" | "cancel" | null>(null);

  const setStatus = trpc.admin.orders.setStatus.useMutation({
    onError: toastError,
    onSettled: () => setBusy(null),
  });

  const change = async (to: OrderStatus, done: string, source: "next" | "manual" | "cancel") => {
    if (to === "cancelado") {
      const ok = await confirmDialog({
        title: `¿Cancelar el pedido ${order.number}?`,
        text: notify
          ? "Las unidades vuelven al inventario y el cliente recibe un correo con el aviso."
          : "Las unidades vuelven al inventario. El cliente no recibe correo.",
        action: "Cancelar pedido",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(source);
    setStatus.mutate(
      { id: order.id, status: to, note: note.trim(), notify },
      {
        onSuccess: (res) => {
          toast(res.changed ? done : "El pedido ya estaba en ese estado");
          setNote("");
          setManual(to);
          void utils.admin.orders.invalidate();
          void utils.admin.dashboard.invalidate();
          void utils.admin.customers.invalidate();
          // Cancelar o reactivar mueve unidades del inventario.
          void utils.admin.products.invalidate();
        },
      },
    );
  };

  const pending = setStatus.isPending;

  return (
    <Card title="Estado del pedido">
      {next ? (
        <p className="mb-4 text-[15px] text-ink-2">
          {status === "pendiente" &&
            (order.paymentRequiresProof
              ? order.paymentProofUrl
                ? "El cliente ya subió el comprobante. Revísalo abajo y confirma el pago cuando lo veas en tu cuenta."
                : "Esperando el comprobante del cliente. Confirma el pago cuando lo veas en tu cuenta."
              : "Confirma el pago cuando lo recibas.")}
          {status === "pagado" && "El pago está confirmado. Avisa cuando empieces a alistar el pedido."}
          {status === "preparando" &&
            "Cuando lo entregues a la transportadora, guarda el número de guía y márcalo como enviado: la guía sale en el correo."}
          {status === "enviado" && "El pedido va en camino. Márcalo como entregado cuando llegue."}
        </p>
      ) : (
        <p className="mb-4 text-[15px] text-ink-2">
          {status === "entregado"
            ? "Este pedido ya fue entregado. No queda nada por hacer."
            : "Este pedido está cancelado y sus unidades volvieron al inventario."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nota para el historial" optional hint="El cliente también la ve en el seguimiento de su pedido.">
          <Input value={note} maxLength={400} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Pago recibido por transferencia" />
        </Field>
        <div className="sm:pt-8">
          <Toggle checked={notify} onChange={setNotify} label="Avisar al cliente por correo" hint="Se envía un correo con el nuevo estado." />
        </div>
      </div>

      {next && (
        <Button
          size="lg"
          className="mt-5 w-full sm:w-auto"
          loading={busy === "next"}
          disabled={pending}
          onClick={() => change(next.to, next.done, "next")}
        >
          {next.label}
        </Button>
      )}

      <div className="mt-6 border-t border-mist-2 pt-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Cambiar el estado a mano" className="min-w-[220px] flex-1">
            <Select value={manual} onChange={(e) => setManual(asStatus(e.target.value))}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            variant="secondary"
            className="h-12!"
            loading={busy === "manual"}
            disabled={pending || manual === status}
            onClick={() => change(manual, manual === "cancelado" ? "Pedido cancelado" : "Estado cambiado", "manual")}
          >
            Cambiar estado
          </Button>
        </div>
        {status === "cancelado" && (
          <p className="mt-3 text-[13px] leading-snug text-ink-2">
            Si reactivas este pedido, sus unidades se descuentan otra vez del inventario.
          </p>
        )}
        {status !== "cancelado" && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[46ch] text-[13px] leading-snug text-ink-2">
              Al cancelar, las unidades del pedido vuelven al inventario.
            </p>
            <Button variant="danger" size="sm" loading={busy === "cancel"} disabled={pending} onClick={() => change("cancelado", "Pedido cancelado", "cancel")}>
              Cancelar pedido
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ───────────── Pago ───────────── */

function PaymentCard({ order }: { order: Order }) {
  const proof = order.paymentProofUrl;
  const isPdf = /\.pdf(\?|#|$)/i.test(proof);
  return (
    <Card title="Pago">
      <Info label="Método">{order.paymentMethod || "Sin método"}</Info>
      <div className="mt-4">
        {proof ? (
          isPdf ? (
            <ButtonLink href={proof} variant="secondary" external>
              <FileText className="size-4" aria-hidden />
              Abrir comprobante (PDF)
            </ButtonLink>
          ) : (
            <>
              <p className="mb-2 text-[13px] text-ink-2">Comprobante de pago. Tócalo para verlo completo.</p>
              <a
                href={proof}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-[20px] bg-mist"
                aria-label="Abrir el comprobante en otra pestaña"
              >
                <img src={proof} alt="Comprobante de pago" className="mx-auto max-h-[440px] w-auto max-w-full object-contain" />
              </a>
            </>
          )
        ) : order.paymentRequiresProof ? (
          <p className="rounded-2xl bg-mist px-4 py-3 text-[14px] text-ink-2">El cliente aún no sube el comprobante.</p>
        ) : (
          <p className="text-[14px] text-ink-2">Este método de pago no pide comprobante.</p>
        )}
      </div>
    </Card>
  );
}

/* ───────────── Artículos ───────────── */

function ItemsCard({ order, items }: { order: Order; items: OrderData["items"] }) {
  const fmt = useMoneyFor();
  const money = (cents: number) => fmt(cents, order.currency);
  const units = items.reduce((n, i) => n + i.quantity, 0);
  return (
    <Card title="Artículos" description={`${units} ${units === 1 ? "unidad" : "unidades"}`}>
      <ul>
        {items.map((i) => {
          const variant = [i.color, i.size].filter(Boolean).join(" / ");
          return (
            <li key={i.id} className="flex items-center gap-4 border-t border-mist-2 py-3.5 first:border-t-0 first:pt-0">
              <Thumb src={i.imageUrl} className="h-[70px] w-14" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{i.name}</p>
                {variant && <p className="text-[14px] text-ink-2">{variant}</p>}
                <p className="text-[14px] tabular-nums text-ink-2">
                  {i.quantity} × {money(i.price)}
                </p>
              </div>
              <p className="shrink-0 font-medium tabular-nums">{money(i.price * i.quantity)}</p>
            </li>
          );
        })}
      </ul>
      <dl className="mt-2 space-y-2 border-t border-mist-2 pt-4 text-[15px]">
        <Total label="Subtotal" value={money(order.subtotal)} />
        {order.discount > 0 && (
          <Total label={order.couponCode ? `Descuento (${order.couponCode})` : "Descuento"} value={`−${money(order.discount)}`} />
        )}
        <Total label="Envío" value={order.shippingCost === 0 ? "Gratis" : money(order.shippingCost)} />
        <div className="flex items-baseline justify-between gap-4 pt-2 text-[17px] font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(order.total)}</dd>
        </div>
      </dl>
    </Card>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-2">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/* ───────────── Cliente y entrega ───────────── */

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[13px] text-ink-2">{label}</p>
      <div className="mt-0.5 break-words text-[15px]">{children}</div>
    </div>
  );
}

function CustomerCard({ order }: { order: Order }) {
  const place = [order.city, order.region, order.postalCode].filter(Boolean).join(", ");
  const link = "underline decoration-line underline-offset-4 hover:decoration-ink";
  return (
    <Card title="Cliente y entrega">
      <div className="space-y-4">
        <Info label="Nombre">{order.customerName}</Info>
        <Info label="Correo">
          <a href={`mailto:${order.customerEmail}`} className={link}>
            {order.customerEmail}
          </a>
        </Info>
        {order.customerPhone && (
          <Info label="Teléfono">
            <a href={`tel:${order.customerPhone.replace(/[^\d+]/g, "")}`} className={link}>
              {order.customerPhone}
            </a>
          </Info>
        )}
        {order.customerDocument && <Info label="Documento">{order.customerDocument}</Info>}
        <Info label="Dirección de entrega">
          <p>{order.address}</p>
          {order.addressExtra && <p>{order.addressExtra}</p>}
          {place && <p>{place}</p>}
          {order.country && <p>{order.country}</p>}
        </Info>
        <Info label="Envío">
          <p>{order.shippingMethod || "Sin método"}</p>
          {order.shippingEta && <p className="text-[14px] text-ink-2">{order.shippingEta}</p>}
        </Info>
        {order.notes && (
          <Info label="Notas del cliente">
            <p className="whitespace-pre-line">{order.notes}</p>
          </Info>
        )}
      </div>
    </Card>
  );
}

/* ───────────── Envío y notas internas ───────────── */

function TrackingCard({ order }: { order: Order }) {
  const utils = trpc.useUtils();
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber);
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl);
  const [adminNotes, setAdminNotes] = useState(order.adminNotes);

  const update = trpc.admin.orders.update.useMutation({
    onSuccess: () => {
      toast("Envío y notas guardados");
      void utils.admin.orders.get.invalidate({ id: order.id });
    },
    onError: toastError,
  });

  return (
    <Card title="Envío y notas internas">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ id: order.id, trackingNumber, trackingUrl, adminNotes });
        }}
      >
        <Field label="Número de guía" optional hint="El cliente lo ve en su seguimiento.">
          <Input value={trackingNumber} maxLength={120} onChange={(e) => setTrackingNumber(e.target.value)} />
        </Field>
        <Field label="Enlace de rastreo" optional>
          <Input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={trackingUrl}
            maxLength={400}
            onChange={(e) => setTrackingUrl(e.target.value)}
          />
        </Field>
        <Field label="Notas internas" optional hint="Solo las ve tu equipo.">
          <Textarea value={adminNotes} maxLength={5000} rows={3} onChange={(e) => setAdminNotes(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" loading={update.isPending}>
          Guardar
        </Button>
      </form>
    </Card>
  );
}

/* ───────────── Historial ───────────── */

function HistoryCard({ events }: { events: OrderData["events"] }) {
  return (
    <Card title="Historial">
      <ol>
        {[...events].reverse().map((e, i, list) => (
          <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
            {i < list.length - 1 && <span className="absolute bottom-0 left-[4.5px] top-3 w-px bg-mist-2" aria-hidden />}
            <span className={`relative mt-[7px] size-2.5 shrink-0 rounded-full ${i === 0 ? "bg-ink" : "bg-line"}`} aria-hidden />
            <div className="min-w-0">
              <p className="font-medium leading-snug">{ORDER_STATUS_LABEL[asStatus(e.status)]}</p>
              {e.note && <p className="break-words text-[14px] text-ink-2">{e.note}</p>}
              <p className="text-[13px] text-ink-3">{fmtDateTime(e.createdAt)}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
