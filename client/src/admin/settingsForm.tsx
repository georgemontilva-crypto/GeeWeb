import type { ReactNode } from "react";
import type { Settings } from "@shared/types";
import { toast, toastError } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { LoadError, Loading } from "./common";

/**
 * Portada y Ajustes editan el mismo objeto de ajustes y lo guardan completo.
 * Por eso se carga siempre fresco (sin caché): si una pantalla partiera de una
 * copia vieja, al guardar pisaría lo que se cambió en la otra.
 */
export function SettingsLoader({ children }: { children: (initial: Settings) => ReactNode }) {
  const q = trpc.admin.settings.get.useQuery(undefined, { staleTime: 0, gcTime: 0 });
  if (q.isPending) return <Loading />;
  if (q.isError) return <LoadError error={q.error} retry={() => q.refetch()} />;
  return <>{children(q.data)}</>;
}

export function useSaveSettings(done = "Cambios guardados") {
  const utils = trpc.useUtils();
  return trpc.admin.settings.save.useMutation({
    onSuccess: (_res, saved) => {
      toast(done);
      utils.admin.settings.get.setData(undefined, saved);
      // Nombre, color, moneda, anuncio y portada se leen desde la tienda.
      void utils.store.invalidate();
      void utils.admin.dashboard.invalidate();
    },
    onError: toastError,
  });
}
