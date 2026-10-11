import { Resend } from "resend";
import { ORDER_STATUS_LABEL, formatMoney, type OrderStatus } from "../shared/types";
import { env } from "./env";
import { getSettings } from "./settings";
import type { schema } from "./db";

type Order = typeof schema.orders.$inferSelect;
type Item = typeof schema.orderItems.$inferSelect;

let resend: Resend | null = null;
const client = () => (resend ??= new Resend(env.resendKey));

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function send(to: string, subject: string, html: string) {
  if (!env.resendKey || !env.emailFrom || !to) return;
  try {
    const { error } = await client().emails.send({ from: env.emailFrom, to, subject, html });
    if (error) console.warn("Resend rechazó el correo:", error.message);
  } catch (err) {
    console.warn("No se pudo enviar el correo:", (err as Error).message);
  }
}

function layout(storeName: string, title: string, body: string, cta?: { label: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1d1d1f">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <p style="font-size:18px;font-weight:600;letter-spacing:-0.01em;margin:0 0 20px">${esc(storeName)}</p>
    <div style="background:#fff;border-radius:24px;padding:32px">
      <h1 style="font-size:26px;line-height:1.15;letter-spacing:-0.02em;margin:0 0 16px">${esc(title)}</h1>
      ${body}
      ${
        cta
          ? `<p style="margin:28px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;background:#1d1d1f;color:#fff;text-decoration:none;border-radius:999px;padding:13px 24px;font-size:15px">${esc(cta.label)}</a></p>`
          : ""
      }
    </div>
  </div></body></html>`;
}

function itemsTable(order: Order, items: Item[], locale: string) {
  const m = (c: number) => formatMoney(c, order.currency, locale);
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:15px">${esc(i.name)}<br>
          <span style="color:#6e6e73;font-size:13px">${esc([i.color, i.size].filter(Boolean).join(" / "))} × ${i.quantity}</span></td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:15px;text-align:right;white-space:nowrap">${m(i.price * i.quantity)}</td>
      </tr>`,
    )
    .join("");
  const line = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:6px 0;font-size:15px;${bold ? "font-weight:600" : "color:#6e6e73"}">${label}</td><td style="padding:6px 0;font-size:15px;text-align:right;${bold ? "font-weight:600" : ""}">${value}</td></tr>`;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px">${rows}
    ${line("Subtotal", m(order.subtotal))}
    ${order.discount > 0 ? line(`Descuento ${esc(order.couponCode)}`, `−${m(order.discount)}`) : ""}
    ${line(`Envío (${esc(order.shippingMethod)})`, order.shippingCost === 0 ? "Gratis" : m(order.shippingCost))}
    ${line("Total", m(order.total), true)}
  </table>`;
}

const trackUrl = (order: Order) => `${env.publicUrl}/pedido/${order.token}`;

export async function sendOrderCreated(order: Order, items: Item[]) {
  const s = await getSettings();
  const pay = order.paymentInstructions
    ? `<div style="background:#f5f5f7;border-radius:16px;padding:16px;margin:20px 0 0;font-size:14px;line-height:1.5;white-space:pre-line"><strong>${esc(order.paymentMethod)}</strong>\n${esc(order.paymentInstructions)}</div>`
    : "";
  const body = `<p style="font-size:15px;line-height:1.5;color:#6e6e73;margin:0 0 8px">Hola ${esc(order.customerName.split(" ")[0] ?? "")}, recibimos tu pedido <strong style="color:#1d1d1f">${esc(order.number)}</strong>.${
    order.paymentRequiresProof ? " Cuando hagas el pago, sube el comprobante desde el enlace de seguimiento." : ""
  }</p>${itemsTable(order, items, s.locale)}${pay}`;
  await send(
    order.customerEmail,
    `Recibimos tu pedido ${order.number}`,
    layout(s.storeName, "Gracias por tu compra", body, env.publicUrl ? { label: "Ver mi pedido", href: trackUrl(order) } : undefined),
  );

  if (s.notifyEmail) {
    const adminBody = `<p style="font-size:15px;line-height:1.5;color:#6e6e73;margin:0 0 8px">${esc(order.customerName)} · ${esc(order.customerEmail)} · ${esc(order.customerPhone)}<br>${esc([order.address, order.addressExtra, order.city, order.region, order.country].filter(Boolean).join(", "))}</p>${itemsTable(order, items, s.locale)}`;
    await send(
      s.notifyEmail,
      `Nuevo pedido ${order.number} · ${formatMoney(order.total, order.currency, s.locale)}`,
      layout(s.storeName, `Nuevo pedido ${order.number}`, adminBody, env.publicUrl ? { label: "Abrir en el panel", href: `${env.publicUrl}/admin/pedidos/${order.id}` } : undefined),
    );
  }
}

const STATUS_COPY: Partial<Record<OrderStatus, { title: string; text: string }>> = {
  pagado: { title: "Confirmamos tu pago", text: "Ya estamos alistando tu pedido." },
  preparando: { title: "Estamos preparando tu pedido", text: "Te avisamos apenas salga a despacho." },
  enviado: { title: "Tu pedido va en camino", text: "Ya salió de nuestra bodega." },
  entregado: { title: "Tu pedido fue entregado", text: "Esperamos que lo disfrutes." },
  cancelado: { title: "Tu pedido fue cancelado", text: "Si crees que es un error, responde a este correo." },
};

export async function sendOrderStatus(order: Order) {
  const copy = STATUS_COPY[order.status as OrderStatus];
  if (!copy) return;
  const s = await getSettings();
  const tracking =
    order.status === "enviado" && order.trackingNumber
      ? `<p style="font-size:15px;line-height:1.5;margin:12px 0 0">Guía: <strong>${esc(order.trackingNumber)}</strong>${
          order.trackingUrl ? ` · <a href="${esc(order.trackingUrl)}" style="color:#1d1d1f">Rastrear envío</a>` : ""
        }</p>`
      : "";
  const body = `<p style="font-size:15px;line-height:1.5;color:#6e6e73;margin:0">Pedido <strong style="color:#1d1d1f">${esc(order.number)}</strong> — ${esc(ORDER_STATUS_LABEL[order.status as OrderStatus])}. ${copy.text}</p>${tracking}`;
  await send(
    order.customerEmail,
    `${copy.title} · ${order.number}`,
    layout(s.storeName, copy.title, body, env.publicUrl ? { label: "Ver mi pedido", href: trackUrl(order) } : undefined),
  );
}

export async function sendProofReceived(order: Order) {
  const s = await getSettings();
  if (!s.notifyEmail) return;
  await send(
    s.notifyEmail,
    `Comprobante recibido · ${order.number}`,
    layout(
      s.storeName,
      `Comprobante del pedido ${order.number}`,
      `<p style="font-size:15px;line-height:1.5;color:#6e6e73;margin:0">${esc(order.customerName)} subió el comprobante de pago. Revísalo y confirma el pago en el panel.</p>`,
      env.publicUrl ? { label: "Abrir en el panel", href: `${env.publicUrl}/admin/pedidos/${order.id}` } : undefined,
    ),
  );
}
