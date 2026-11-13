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
    // Un acento negro (el de fábrica) sigue al tema: negro en claro y blanco
    // en oscuro. Cualquier otro color se respeta en los dos modos.
    const root = document.documentElement.style;
    const m = accent?.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    const lum = m ? (0.2126 * parseInt(m[1]!, 16) + 0.7152 * parseInt(m[2]!, 16) + 0.0722 * parseInt(m[3]!, 16)) / 255 : 0;
    if (!m || lum < 0.16) {
      root.removeProperty("--accent");
      root.removeProperty("--on-accent");
    } else {
      root.setProperty("--accent", accent!);
      root.setProperty("--on-accent", lum > 0.6 ? "#121212" : "#ffffff");
    }
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
