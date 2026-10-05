import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CartLine, Order, Product } from '../domain/types';
import { orderService } from '../services/orderService';
import { watchLocation } from '../services/location';
import type { Session } from '../services/auth';

export type Route = 'splash' | 'login' | 'home' | 'order' | 'tracking' | 'barista';

type Store = {
  route: Route;
  go: (r: Route) => void;
  session: Session | null;
  setSession: (s: Session | null) => void;

  lines: CartLine[];
  count: number;
  subtotal: number;
  qtyOf: (id: string) => number;
  add: (p: Product) => void;
  remove: (p: Product) => void;
  clear: () => void;

  orders: Order[];
  activeOrder: Order | undefined;
  setActiveOrderId: (id: string | null) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [route, go] = useState<Route>('splash');
  const [session, setSession] = useState<Session | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeId, setActiveOrderId] = useState<string | null>(null);

  useEffect(() => orderService.subscribe(setOrders), []);

  const activeOrder = orders.find((o) => o.id === activeId);

  // Live location: stream fixes to the order service only while the barista
  // has not yet been told to start. Stops itself afterwards to save battery.
  const watching = useRef<string | null>(null);
  const needsLive =
    activeOrder?.tracking === 'live' && activeOrder.status === 'waiting' ? activeOrder.id : null;
  useEffect(() => {
    if (!needsLive || watching.current === needsLive) return;
    watching.current = needsLive;
    let stop: (() => void) | undefined;
    let cancelled = false;
    watchLocation((loc, acc) => orderService.sendLocation(needsLive, loc, acc))
      .then((s) => (cancelled ? s() : (stop = s)))
      .catch(() => {});
    return () => {
      cancelled = true;
      watching.current = null;
      stop?.();
    };
  }, [needsLive]);

  const add = useCallback((p: Product) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.product.id === p.id);
      if (i === -1) return [...ls, { product: p, qty: 1 }];
      return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
    });
  }, []);
  const remove = useCallback((p: Product) => {
    setLines((ls) =>
      ls.flatMap((l) =>
        l.product.id !== p.id ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : [],
      ),
    );
  }, []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<Store>(
    () => ({
      route,
      go,
      session,
      setSession,
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: Math.round(lines.reduce((s, l) => s + l.qty * l.product.price, 0) * 100) / 100,
      qtyOf: (id) => lines.find((l) => l.product.id === id)?.qty ?? 0,
      add,
      remove,
      clear,
      orders,
      activeOrder,
      setActiveOrderId,
    }),
    [route, session, lines, orders, activeOrder, add, remove, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}

export const money = (n: number) => `$${n.toFixed(2)}`;
