import { useEffect, useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc } from "./trpc";
import { cart, useCart } from "./cart";

/** Une lo guardado en la bolsa con el precio y las existencias actuales. */
export function useCartDetails() {
  const { lines } = useCart();
  const ids = useMemo(() => lines.map((l) => l.variantId).sort((a, b) => a - b), [lines]);
  const q = trpc.store.cart.useQuery(
    { variantIds: ids },
    { enabled: ids.length > 0, placeholderData: keepPreviousData, staleTime: 15_000 },
  );

  // Si un artículo ya no existe en la tienda, se quita de la bolsa.
  useEffect(() => {
    if (!q.data || q.isPlaceholderData || q.isFetching) return;
    for (const l of lines) {
      if (!q.data.some((d) => d.variantId === l.variantId)) cart.remove(l.variantId);
    }
  }, [q.data, q.isPlaceholderData, q.isFetching, lines]);

  const rows = useMemo(
    () =>
      lines.flatMap((l) => {
        const d = q.data?.find((x) => x.variantId === l.variantId);
        if (!d) return [];
        const available = d.isActive ? d.stock : 0;
        return [{ ...d, quantity: l.quantity, available, problem: available < l.quantity }];
      }),
    [lines, q.data],
  );

  const subtotal = rows.reduce((sum, r) => sum + r.price * r.quantity, 0);
  return {
    rows,
    subtotal,
    loading: ids.length > 0 && q.isLoading,
    hasProblems: rows.some((r) => r.problem),
    refetch: q.refetch,
  };
}
export type CartRow = ReturnType<typeof useCartDetails>["rows"][number];
