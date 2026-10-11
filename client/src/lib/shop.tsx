import { useCallback, useEffect } from "react";
import { formatMoney } from "@shared/types";
import { trpc, type Out } from "./trpc";

export type Bootstrap = Out["store"]["bootstrap"];
export type ProductCard = Out["store"]["products"]["items"][number];
export type ProductDetail = NonNullable<Out["store"]["product"]>["product"];

/** Marca, menú y categorías de la tienda (una sola consulta, en caché). */
export function useShop() {
  const q = trpc.store.bootstrap.useQuery(undefined, { staleTime: 5 * 60_000 });
  const accent = q.data?.settings.accent;
  useEffect(() => {
    if (accent) document.documentElement.style.setProperty("--accent", accent);
  }, [accent]);
  return q.data;
}

/** Formatea centavos con la moneda configurada en la tienda. */
export function useMoney() {
  const shop = useShop();
  const currency = shop?.settings.currency ?? "USD";
  const locale = shop?.settings.locale ?? "es-CO";
  return useCallback((cents: number) => formatMoney(cents, currency, locale), [currency, locale]);
}

/** Foto principal de un producto para un color dado. */
export function imageFor(images: { url: string; color: string }[], color?: string) {
  return (
    (color ? images.find((i) => i.color === color) : undefined) ??
    images.find((i) => i.color === "") ??
    images[0]
  )?.url;
}
