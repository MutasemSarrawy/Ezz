import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MARKETS, formatMoney, roundMoney, type Market } from '../domain/market';
import { choiceKey, unitPrice } from '../domain/options';
import type { CartLine, Choice, Currency, Lang, MarketId, Order, Product } from '../domain/types';
import { minutes, translate, type StringKey } from '../i18n/strings';
import { orderService } from '../services/orderService';
import { watchLocation } from '../services/location';
import { getPref, setPref } from '../services/prefs';
import type { Session } from '../services/auth';

export type Route = 'splash' | 'login' | 'home' | 'product' | 'order' | 'tracking' | 'barista' | 'settings';

type Store = {
  route: Route;
  /** Push a screen. */
  go: (r: Route) => void;
  /** Replace the whole history with one screen (after login, splash). */
  reset: (r: Route) => void;
  /** Pop one screen. Returns false when there is nothing to go back to. */
  back: () => boolean;
  openProduct: (id: string) => void;
  productId: string | null;

  session: Session | null;
  setSession: (s: Session | null) => void;

  lang: Lang;
  setLang: (l: Lang) => void;
  isRTL: boolean;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  mins: (seconds: number) => string;

  market: Market;
  setMarket: (m: MarketId) => void;
  money: (amount: number, currency?: Currency) => string;

  lines: CartLine[];
  count: number;
  subtotal: number;
  qtyOf: (productId: string) => number;
  addLine: (p: Product, choice: Choice, qty?: number) => void;
  /** Remove one unit from the most recently added line of this product. */
  removeOne: (p: Product) => void;
  changeQty: (key: string, delta: number) => void;
  clear: () => void;
  linePrice: (l: CartLine) => number;

  orders: Order[];
  activeOrder: Order | undefined;
  setActiveOrderId: (id: string | null) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<Route[]>(['splash']);
  const [productId, setProductId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [lang, setLangState] = useState<Lang>('en');
  const [marketId, setMarketId] = useState<MarketId>('JO');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeId, setActiveOrderId] = useState<string | null>(null);

  useEffect(() => orderService.subscribe(setOrders), []);
  useEffect(() => {
    (async () => {
      const l = await getPref('x.lang');
      const m = await getPref('x.market');
      if (l === 'en' || l === 'ar') setLangState(l);
      if (m === 'JO' || m === 'SA') setMarketId(m);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => { setLangState(l); setPref('x.lang', l); }, []);
  const setMarket = useCallback((m: MarketId) => { setMarketId(m); setPref('x.market', m); }, []);

  const go = useCallback((r: Route) => setHistory((h) => (h[h.length - 1] === r ? h : [...h, r])), []);
  const reset = useCallback((r: Route) => setHistory([r]), []);
  const historyRef = useRef(history);
  historyRef.current = history;
  const back = useCallback(() => {
    if (historyRef.current.length <= 1) return false;
    setHistory((h) => h.slice(0, -1));
    return true;
  }, []);
  const openProduct = useCallback((id: string) => { setProductId(id); go('product'); }, [go]);

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

  const addLine = useCallback((p: Product, choice: Choice, qty = 1) => {
    const key = choiceKey(p.id, choice);
    setLines((ls) =>
      ls.some((l) => l.key === key)
        ? ls.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l))
        : [...ls, { key, product: p, choice, qty }],
    );
  }, []);
  const changeQty = useCallback((key: string, delta: number) => {
    setLines((ls) => ls.flatMap((l) => (l.key !== key ? [l] : l.qty + delta > 0 ? [{ ...l, qty: l.qty + delta }] : [])));
  }, []);
  const removeOne = useCallback((p: Product) => {
    setLines((ls) => {
      const idx = ls.map((l) => l.product.id).lastIndexOf(p.id);
      if (idx === -1) return ls;
      return ls.flatMap((l, i) => (i !== idx ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []));
    });
  }, []);
  const clear = useCallback(() => setLines([]), []);

  const market = MARKETS[marketId];

  const value = useMemo<Store>(() => {
    const linePrice = (l: CartLine) => unitPrice(l.product, l.choice, market.currency);
    return {
      route: history[history.length - 1],
      go,
      reset,
      back,
      openProduct,
      productId,
      session,
      setSession,
      lang,
      setLang,
      isRTL: lang === 'ar',
      t: (key, vars) => translate(lang, key, vars),
      mins: (s) => minutes(s, lang),
      market,
      setMarket,
      money: (n, cur) => formatMoney(n, cur ?? market.currency, lang),
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: roundMoney(lines.reduce((s, l) => s + l.qty * linePrice(l), 0), market.currency),
      qtyOf: (id) => lines.filter((l) => l.product.id === id).reduce((s, l) => s + l.qty, 0),
      addLine,
      removeOne,
      changeQty,
      clear,
      linePrice,
      orders,
      activeOrder,
      setActiveOrderId,
    };
  }, [history, go, reset, back, openProduct, productId, session, lang, setLang, market, setMarket, lines, addLine, removeOne, changeQty, clear, orders, activeOrder]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
