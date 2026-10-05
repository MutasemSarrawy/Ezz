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
import type { CartLine, Choice, Currency, FulfilmentMode, Lang, LatLng, MarketId, Order, Product, TrackingMode, TravelMode } from '../domain/types';
import { pointsEarned } from '../domain/loyalty';
import { minutes, translate, type StringKey } from '../i18n/strings';
import { orderService } from '../services/orderService';
import { watchLocation } from '../services/location';
import { getJSON, getPref, setJSON, setPref } from '../services/prefs';
import { clearSession, isBiometricEnabled, loadSession, saveSession, type Session } from '../services/auth';
import { loadStaffSession, staffSignOut, type StaffSession } from '../services/staffAuth';
import { uid, type LedgerEntry, type Profile, type SavedCard, type SavedDrink } from '../domain/account';
import type { Address, DeliveryQuote } from '../domain/delivery';
import type { Branch } from '../domain/market';

export type Route =
  | 'splash' | 'login' | 'signup' | 'home' | 'product' | 'order' | 'checkout' | 'tracking' | 'barista' | 'settings'
  | 'profile' | 'editProfile' | 'history' | 'favourites' | 'wallet' | 'address' | 'staffLogin';

/** Pickup details chosen on the Order screen, carried into Checkout. */
export type PendingPickup = { kind: 'pickup'; location: LatLng; tracking: TrackingMode; travel: TravelMode; prepSeconds: number; branch: Branch };
export type PendingDelivery = { kind: 'delivery'; address: Address; quote: Extract<DeliveryQuote, { ok: true }>; prepSeconds: number };
export type PendingOrder = PendingPickup | PendingDelivery;

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
  updateProfile: (p: Profile) => void;
  signOut: () => void;

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

  /** Staff signed in on this device (barista tablet). */
  staff: StaffSession | null;
  setStaff: (s: StaffSession | null) => void;
  /** Branches currently not taking orders. */
  pausedBranches: string[];

  /** Pickup or delivery, kept while the customer moves between Order, Address and Checkout. */
  fulfilment: FulfilmentMode;
  setFulfilment: (m: FulfilmentMode) => void;
  pendingOrder: PendingOrder | null;
  setPendingOrder: (p: PendingOrder | null) => void;

  addresses: Address[];
  saveAddress: (a: Address) => void;
  removeAddress: (id: string) => void;
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;

  /** Loyalty points balance (shared across countries). */
  points: number;
  addPoints: (delta: number, kind: LedgerEntry['kind'], orderId?: string) => void;
  /** Prepaid wallet balance per currency. */
  wallet: Record<Currency, number>;
  addWallet: (currency: Currency, delta: number, kind: LedgerEntry['kind'], orderId?: string) => void;
  /** Wallet and points movements, newest first. */
  ledger: LedgerEntry[];

  favourites: string[];
  toggleFavourite: (productId: string) => void;
  savedDrinks: SavedDrink[];
  saveDrink: (productId: string, choice: Choice) => void;
  removeSavedDrink: (id: string) => void;
  savedCards: SavedCard[];
  addCard: (c: Omit<SavedCard, 'id'>) => void;
  removeCard: (id: string) => void;
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
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [fulfilment, setFulfilment] = useState<FulfilmentMode>('pickup');
  const [staff, setStaffState] = useState<StaffSession | null>(null);
  const [pausedBranches, setPausedBranches] = useState<string[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [wallet, setWallet] = useState<Record<Currency, number>>({ JOD: 0, SAR: 0 });
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [savedDrinks, setSavedDrinks] = useState<SavedDrink[]>([]);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);

  useEffect(() => orderService.subscribe(setOrders), []);
  useEffect(() => orderService.subscribePaused(setPausedBranches), []);
  useEffect(() => { loadStaffSession().then((s) => s && setStaffState(s)); }, []);
  // While staff are on shift they mark orders ready themselves.
  useEffect(() => { orderService.setAutoAdvance(!staff); }, [staff]);
  const setStaff = useCallback((s: StaffSession | null) => {
    setStaffState(s);
    if (!s) staffSignOut();
  }, []);
  useEffect(() => {
    (async () => {
      const l = await getPref('x.lang');
      const m = await getPref('x.market');
      if (l === 'en' || l === 'ar') setLangState(l);
      if (m === 'JO' || m === 'SA') setMarketId(m);
      const pts = Number(await getPref('x.points'));
      if (Number.isFinite(pts) && pts > 0) setPoints(pts);
      try {
        const w = JSON.parse((await getPref('x.wallet')) ?? 'null');
        if (w && typeof w.JOD === 'number' && typeof w.SAR === 'number') setWallet(w);
      } catch {}
      // Stay signed in between launches, unless the user chose a biometric unlock.
      const saved = await loadSession();
      if (saved && !(await isBiometricEnabled())) setSession((cur) => cur ?? saved);
      setLedger(await getJSON('x.ledger', []));
      setFavourites(await getJSON('x.favourites', []));
      setSavedDrinks(await getJSON('x.savedDrinks', []));
      setSavedCards(await getJSON('x.savedCards', []));
      const addr = await getJSON<Address[]>('x.addresses', []);
      setAddresses(addr);
      if (addr[0]) setSelectedAddressId((cur) => cur ?? addr[0].id);
    })();
  }, []);

  const record = useCallback((e: Omit<LedgerEntry, 'id' | 'at'>) => {
    setLedger((l) => { const n = [{ ...e, id: uid('tx'), at: Date.now() }, ...l].slice(0, 200); setJSON('x.ledger', n); return n; });
  }, []);
  const addPoints = useCallback((d: number, kind: LedgerEntry['kind'], orderId?: string) => {
    if (!d) return;
    setPoints((p) => { const n = Math.max(0, p + d); setPref('x.points', String(n)); return n; });
    record({ kind, amount: d, unit: 'points', orderId });
  }, [record]);
  const addWallet = useCallback((cur: Currency, d: number, kind: LedgerEntry['kind'], orderId?: string) => {
    if (!d) return;
    setWallet((w) => {
      const n = { ...w, [cur]: roundMoney(Math.max(0, w[cur] + d), cur) };
      setPref('x.wallet', JSON.stringify(n));
      return n;
    });
    record({ kind, amount: roundMoney(d, cur), unit: cur, orderId });
  }, [record]);

  const toggleFavourite = useCallback((id: string) => {
    setFavourites((f) => { const n = f.includes(id) ? f.filter((x) => x !== id) : [id, ...f]; setJSON('x.favourites', n); return n; });
  }, []);
  const saveDrink = useCallback((productId: string, choice: Choice) => {
    setSavedDrinks((d) => {
      const key = choiceKey(productId, choice);
      if (d.some((x) => choiceKey(x.productId, x.choice) === key)) return d;
      const n = [{ id: uid('drink'), productId, choice }, ...d].slice(0, 30);
      setJSON('x.savedDrinks', n);
      return n;
    });
  }, []);
  const removeSavedDrink = useCallback((id: string) => {
    setSavedDrinks((d) => { const n = d.filter((x) => x.id !== id); setJSON('x.savedDrinks', n); return n; });
  }, []);
  const addCard = useCallback((c: Omit<SavedCard, 'id'>) => {
    setSavedCards((cs) => {
      if (cs.some((x) => x.last4 === c.last4 && x.expiry === c.expiry && x.brand === c.brand)) return cs;
      const n = [...cs, { ...c, id: uid('card') }];
      setJSON('x.savedCards', n);
      return n;
    });
  }, []);
  const removeCard = useCallback((id: string) => {
    setSavedCards((cs) => { const n = cs.filter((x) => x.id !== id); setJSON('x.savedCards', n); return n; });
  }, []);

  const saveAddress = useCallback((a: Address) => {
    setAddresses((as) => {
      const n = as.some((x) => x.id === a.id) ? as.map((x) => (x.id === a.id ? a : x)) : [a, ...as];
      setJSON('x.addresses', n);
      return n;
    });
    setSelectedAddressId(a.id);
  }, []);
  const removeAddress = useCallback((id: string) => {
    setAddresses((as) => { const n = as.filter((x) => x.id !== id); setJSON('x.addresses', n); return n; });
    setSelectedAddressId((cur) => (cur === id ? null : cur));
  }, []);

  const updateProfile = useCallback((p: Profile) => {
    setSession((s) => {
      const n = { identifier: s?.identifier ?? p.phone ?? p.email ?? p.name, ...s, ...p };
      saveSession(n);
      return n;
    });
  }, []);
  const signOut = useCallback(() => {
    setSession(null);
    clearSession();
    setHistory(['login']);
  }, []);

  // Bookkeeping the backend will own later: credit points once an order is
  // picked up, and return wallet money / redeemed points if it is cancelled.
  useEffect(() => {
    for (const o of orders) {
      if ((o.status === 'picked_up' || o.status === 'delivered') && o.pointsEarned === undefined) {
        // points are earned on items, not on the delivery fee
        const earned = pointsEarned(o.payment.amount - (o.payment.deliveryFee ?? 0), o.currency);
        addPoints(earned, 'earn', o.id);
        orderService.annotate(o.id, { pointsEarned: earned });
      }
      if (o.status === 'cancelled' && !o.refunded) {
        if (o.payment.pointsRedeemed) addPoints(o.payment.pointsRedeemed, 'restore', o.id);
        if (o.payment.method === 'wallet') addWallet(o.currency, o.payment.amount, 'refund', o.id);
        orderService.annotate(o.id, { refunded: true });
      }
    }
  }, [orders, addPoints, addWallet]);

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
      updateProfile,
      signOut,
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
      staff,
      setStaff,
      pausedBranches,
      fulfilment,
      setFulfilment,
      pendingOrder,
      setPendingOrder,
      addresses,
      saveAddress,
      removeAddress,
      selectedAddressId,
      setSelectedAddressId,
      points,
      addPoints,
      wallet,
      addWallet,
      ledger,
      favourites,
      toggleFavourite,
      savedDrinks,
      saveDrink,
      removeSavedDrink,
      savedCards,
      addCard,
      removeCard,
    };
  }, [history, go, reset, back, openProduct, productId, session, lang, setLang, market, setMarket, lines, addLine, removeOne, changeQty, clear, orders, activeOrder, staff, setStaff, pausedBranches, fulfilment, pendingOrder, addresses, saveAddress, removeAddress, selectedAddressId, points, addPoints, wallet, addWallet, ledger, favourites, toggleFavourite, savedDrinks, saveDrink, removeSavedDrink, savedCards, addCard, removeCard, updateProfile, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
