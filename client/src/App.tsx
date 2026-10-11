import { Suspense, lazy, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { useShop } from "./lib/shop";
import { Spinner } from "./components/ui";
import { StoreLayout } from "./components/StoreLayout";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Product from "./pages/Product";
import Checkout from "./pages/Checkout";
import Order from "./pages/Order";
import Track from "./pages/Track";
import Page from "./pages/Page";

const AdminApp = lazy(() => import("./admin/AdminApp"));

function ScrollReset() {
  const [path] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [path]);
  return null;
}

const Loading = () => (
  <div className="grid min-h-dvh place-items-center">
    <Spinner />
  </div>
);

export default function App() {
  const shop = useShop();
  const [path] = useLocation();

  if (path.startsWith("/admin")) {
    return (
      <Suspense fallback={<Loading />}>
        <AdminApp />
      </Suspense>
    );
  }
  if (!shop) return <Loading />;

  return (
    <StoreLayout>
      <ScrollReset />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tienda" component={Shop} />
        <Route path="/categoria/:slug" component={Shop} />
        <Route path="/producto/:slug" component={Product} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/pedido/:token" component={Order} />
        <Route path="/seguimiento" component={Track} />
        <Route path="/:slug" component={Page} />
        <Route component={Page} />
      </Switch>
    </StoreLayout>
  );
}
