import { Link } from "wouter";
import { Info, Paperclip } from "lucide-react";
import { ButtonLink, EmptyState, StatusBadge, cx } from "@/components/ui";
import { trpc, type Out } from "@/lib/trpc";
import { useMoney } from "@/lib/shop";
import { Card, LoadError, Loading, Notice, PageHeader, Tag, fmtDateTime, useMoneyFor } from "./common";

type Data = Out["admin"]["dashboard"];

export default function Dashboard() {
  // Siempre al día: los pedidos llegan mientras el panel está abierto.
  const q = trpc.admin.dashboard.useQuery(undefined, { staleTime: 0, refetchOnWindowFocus: true });
  const money = useMoney();

  if (q.isPending) return <Loading />;
  if (q.isError) return <LoadError error={q.error} retry={() => q.refetch()} />;
  const d = q.data;

  return (
    <>
      <PageHeader title="Inicio" />

      {(d.storage === "db" || !d.emailEnabled) && (
        <div className="mb-4 space-y-3">
          {d.storage === "db" && (
            <SetupNotice>
              Las imágenes se están guardando en la base de datos. Funciona, pero para producción conviene configurar
              Cloudflare R2 (variables R2_* en Railway).
            </SetupNotice>
          )}
          {!d.emailEnabled && (
            <SetupNotice>
              Los correos de pedido están desactivados. Configura RESEND_API_KEY y EMAIL_FROM en Railway para activarlos.
            </SetupNotice>
          )}
        </div>
      )}

      {d.activeProducts === 0 && (
        <div className="mb-4 rounded-[24px] bg-white">
          <EmptyState
            title="Tu tienda aún no tiene productos visibles"
            text="Crea el primero con sus fotos, colores y tallas para empezar a vender."
          >
            <ButtonLink href="/admin/productos/nuevo">Nuevo producto</ButtonLink>
          </EmptyState>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ventas de los últimos 30 días" value={money(d.revenue30)} />
        <Stat label="Pedidos de los últimos 30 días" value={String(d.orders30)} />
        <Stat label="Pendientes de pago" value={String(d.pending)} href="/admin/pedidos?estado=pendiente" />
        <Stat label="Por despachar" value={String(d.toShip)} />
      </div>

      <div className="mt-4">
        <SalesChart days={d.days} />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <RecentOrders rows={d.recent} />
        <div className="space-y-4">
          <LowStock rows={d.low} />
          <TopProducts rows={d.top} />
        </div>
      </div>
    </>
  );
}

function SetupNotice({ children }: { children: string }) {
  return (
    <Notice className="flex items-start gap-3">
      <Info className="mt-0.5 size-[18px] shrink-0 text-ink-3" aria-hidden />
      <p>{children}</p>
    </Notice>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="text-[14px] leading-snug text-ink-2">{label}</span>
      <span className="text-[24px] font-semibold tracking-[-0.03em] tabular-nums sm:mt-2 sm:text-[28px]">{value}</span>
    </>
  );
  const cls =
    "flex items-center justify-between gap-4 rounded-[24px] bg-white px-5 py-4 sm:flex-col sm:items-start sm:justify-start sm:gap-0 sm:p-6";
  if (href) {
    return (
      <Link href={href} className={cx(cls, "transition-colors hover:bg-white/70")}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

/* ───────────── Ventas de 14 días ───────────── */

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" });

function SalesChart({ days }: { days: Data["days"] }) {
  const money = useMoney();
  const max = Math.max(0, ...days.map((x) => x.total));
  const total = days.reduce((sum, x) => sum + x.total, 0);
  const orders = days.reduce((sum, x) => sum + x.count, 0);
  const peak = max > 0 ? days.findIndex((x) => x.total === max) : -1;
  const tip = (x: Data["days"][number]) =>
    `${dayLabel(x.day)}: ${money(x.total)} en ${x.count} ${x.count === 1 ? "pedido" : "pedidos"}`;

  return (
    <Card
      title="Ventas de los últimos 14 días"
      description={
        max > 0
          ? `${money(total)} en ${orders} ${orders === 1 ? "pedido" : "pedidos"}. Incluye los pendientes de pago y excluye los cancelados.`
          : "Aún no hay ventas en estos días. Cuando llegue un pedido, lo verás aquí."
      }
    >
      <div role="img" aria-label={`Ventas por día de los últimos 14 días. Total: ${money(total)}.`}>
        <div className="flex h-[168px] items-end gap-[2px] border-b border-mist-2 pt-7 sm:gap-1.5" aria-hidden>
          {days.map((x, i) => {
            const pct = max > 0 ? (x.total / max) * 100 : 0;
            return (
              <div key={x.day} title={tip(x)} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                {i === peak && (
                  <span
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-full pb-1.5 text-[12px] font-medium whitespace-nowrap text-ink"
                    style={{ bottom: `${pct}%` }}
                  >
                    {money(x.total)}
                  </span>
                )}
                <span
                  className={cx(
                    "block w-full max-w-6 rounded-t-[4px] transition-opacity",
                    x.total > 0 ? "bg-ink group-hover:opacity-70" : "bg-mist-2",
                  )}
                  style={{ height: x.total > 0 ? `max(3px, ${pct}%)` : "2px" }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-[2px] sm:gap-1.5" aria-hidden>
          {days.map((x) => (
            <span key={x.day} title={tip(x)} className="min-w-0 flex-1 text-center text-[12px] tabular-nums text-ink-3">
              {Number(x.day.slice(8, 10))}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Ventas por día</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Ventas</th>
            <th scope="col">Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {days.map((x) => (
            <tr key={x.day}>
              <th scope="row">{dayLabel(x.day)}</th>
              <td>{money(x.total)}</td>
              <td>{x.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ───────────── Listas ───────────── */

function RecentOrders({ rows }: { rows: Data["recent"] }) {
  const money = useMoneyFor();
  return (
    <Card
      title="Pedidos recientes"
      actions={
        rows.length > 0 ? (
          <ButtonLink href="/admin/pedidos" variant="secondary" size="sm">
            Ver todos
          </ButtonLink>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p className="text-[15px] text-ink-2">
          Todavía no hay pedidos. Cuando un cliente termine su compra, aparecerá aquí y te llegará un correo de aviso.
        </p>
      ) : (
        <ul className="-mx-2">
          {rows.map((o) => (
            <li key={o.id} className="border-t border-mist-2 first:border-t-0">
              <Link
                href={`/admin/pedidos/${o.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl px-2 py-3 transition-colors hover:bg-mist"
              >
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block font-medium">{o.number}</span>
                  <span className="block truncate text-[14px] text-ink-2">
                    {o.customerName} · {fmtDateTime(o.createdAt)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center justify-end gap-2">
                  {o.hasProof && o.status === "pendiente" && (
                    <Tag tone="warn">
                      <Paperclip className="size-3" aria-hidden />
                      Comprobante
                    </Tag>
                  )}
                  <StatusBadge status={o.status} />
                  <span className="min-w-[72px] text-right font-medium tabular-nums">{money(o.total, o.currency)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LowStock({ rows }: { rows: Data["low"] }) {
  return (
    <Card title="Poco inventario">
      {rows.length === 0 ? (
        <p className="text-[15px] text-ink-2">Todo en orden: ninguna talla está por agotarse.</p>
      ) : (
        <ul className="-mx-2">
          {rows.map((v, i) => {
            const variant = [v.color, v.size].filter(Boolean).join(" / ");
            return (
              <li key={`${v.productId}-${v.color}-${v.size}-${i}`} className="border-t border-mist-2 first:border-t-0">
                <Link
                  href={`/admin/productos/${v.productId}`}
                  className="flex items-center justify-between gap-4 rounded-xl px-2 py-2.5 transition-colors hover:bg-mist"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{v.name}</span>
                    {variant && <span className="block truncate text-[14px] text-ink-2">{variant}</span>}
                  </span>
                  <span className={cx("shrink-0 text-[14px] font-medium tabular-nums", v.stock === 0 ? "text-bad" : "text-warn")}>
                    {v.stock === 0 ? "Agotado" : v.stock === 1 ? "1 unidad" : `${v.stock} unidades`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function TopProducts({ rows }: { rows: Data["top"] }) {
  const money = useMoney();
  return (
    <Card title="Más vendidos" description="Pedidos pagados de los últimos 30 días.">
      {rows.length === 0 ? (
        <p className="text-[15px] text-ink-2">Aún no hay ventas confirmadas en este periodo.</p>
      ) : (
        <ul>
          {rows.map((t) => (
            <li key={t.name} className="flex items-center justify-between gap-4 border-t border-mist-2 py-2.5 first:border-t-0 first:pt-0 last:pb-0">
              <span className="min-w-0">
                <span className="block truncate">{t.name}</span>
                <span className="block text-[14px] text-ink-2">
                  {t.units} {t.units === 1 ? "unidad" : "unidades"}
                </span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">{money(t.revenue)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
