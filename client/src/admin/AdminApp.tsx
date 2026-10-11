import { useEffect } from "react";
import { Route, Switch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState, Spinner } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { NotFound, errorCode, errorMessage } from "./common";
import Shell from "./Shell";
import Login from "./Login";
import Dashboard from "./Dashboard";
import Orders from "./Orders";
import OrderDetail from "./OrderDetail";
import Products from "./Products";
import ProductEditor from "./ProductEditor";
import Categories from "./Categories";
import Featured from "./Featured";
import Customers from "./Customers";
import Shipping from "./Shipping";
import Payments from "./Payments";
import Coupons from "./Coupons";
import Pages from "./Pages";
import PageEditor from "./PageEditor";
import HomeEditor from "./HomeEditor";
import Settings from "./Settings";

/** Convierte el parámetro de la ruta en un id válido, o null. */
const toId = (raw: string | undefined) => {
  const n = Number(raw);
  return raw && /^\d+$/.test(raw) && Number.isSafeInteger(n) && n > 0 ? n : null;
};

export default function AdminApp() {
  const me = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });
  const utils = trpc.useUtils();
  const qc = useQueryClient();

  // Si la sesión vence, cualquier consulta del panel responde UNAUTHORIZED:
  // se vuelve a preguntar quién está conectado y aparece el inicio de sesión.
  useEffect(() => {
    return qc.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error") return;
      if (errorCode(event.action.error) === "UNAUTHORIZED") void utils.auth.me.invalidate();
    });
  }, [qc, utils]);

  if (me.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-mist">
        <Spinner />
      </div>
    );
  }
  if (me.isError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-mist px-4">
        <div className="w-full max-w-[440px] rounded-[28px] bg-white">
          <EmptyState title="No se pudo abrir el panel" text={errorMessage(me.error)}>
            <Button variant="secondary" loading={me.isFetching} onClick={() => me.refetch()}>
              Reintentar
            </Button>
          </EmptyState>
        </div>
      </div>
    );
  }
  if (!me.data) return <Login />;

  return (
    <Shell user={me.data}>
      <Switch>
        <Route path="/admin">
          <Dashboard />
        </Route>

        <Route path="/admin/pedidos">
          <Orders />
        </Route>
        <Route path="/admin/pedidos/:id">
          {(p) => {
            const id = toId(p.id);
            return id ? <OrderDetail key={id} id={id} /> : <Missing />;
          }}
        </Route>

        <Route path="/admin/productos">
          <Products />
        </Route>
        <Route path="/admin/productos/nuevo">
          <ProductEditor key="nuevo" id={null} />
        </Route>
        <Route path="/admin/productos/:id">
          {(p) => {
            const id = toId(p.id);
            return id ? <ProductEditor key={id} id={id} /> : <Missing />;
          }}
        </Route>

        <Route path="/admin/categorias">
          <Categories />
        </Route>
        <Route path="/admin/destacados">
          <Featured />
        </Route>
        <Route path="/admin/clientes">
          <Customers />
        </Route>
        <Route path="/admin/envios">
          <Shipping />
        </Route>
        <Route path="/admin/pagos">
          <Payments />
        </Route>
        <Route path="/admin/cupones">
          <Coupons />
        </Route>

        <Route path="/admin/paginas">
          <Pages />
        </Route>
        <Route path="/admin/paginas/nueva">
          <PageEditor key="nueva" id={null} />
        </Route>
        <Route path="/admin/paginas/:id">
          {(p) => {
            const id = toId(p.id);
            return id ? <PageEditor key={id} id={id} /> : <Missing />;
          }}
        </Route>

        <Route path="/admin/portada">
          <HomeEditor />
        </Route>
        <Route path="/admin/ajustes">
          <Settings />
        </Route>

        <Route>
          <Missing />
        </Route>
      </Switch>
    </Shell>
  );
}

function Missing() {
  return (
    <NotFound
      title="Esta sección no existe"
      text="Puede que la dirección esté mal escrita o que el elemento se haya eliminado."
      href="/admin"
      action="Ir al inicio"
    />
  );
}
