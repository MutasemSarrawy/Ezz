# X Coffee House — mobile app (Expo / React Native)

Flow: **Splash (logo)** → **Login (optional)** → **Menu** → **Product details** → **Order** → **Checkout** → **Pickup tracking**.

Languages: English and Arabic (right-to-left). Countries: Jordan (JOD, 3 decimals) and Saudi Arabia (SAR) — switch with the flag button on the menu.
A **Barista console** (chef button, top-right of the menu) shows the shop's side.

## Run
```bash
npm install
npx expo start      # scan the QR with Expo Go, or press a / i / w
npm test            # pickup-timing rules (vitest)
```

## Login
Email *or* mobile + password, "Skip for now" for testing, and a biometric / device-passkey button.
Sign in once with a password, accept "Enable", and next time Face ID / fingerprint restores the session.
Auth is a stub (`src/services/auth.ts`) that accepts any well-formed credentials.
True WebAuthn passkeys need the backend; the current button uses device biometrics.

## Pickup: how the timing works
1. Customer picks Pickup, chooses driving/walking, and shares location (permission prompt).
2. `ETA` = distance × 1.35 route factor ÷ speed. `Prep` = barista time for the basket (+ queue backlog).
3. Barista is notified when `ETA ≤ Prep + 45 s buffer` (`src/domain/pickup.ts`, `orderEngine.ts`).
   - **Share once**: start time is fixed from the ETA at order time.
   - **Live location**: every fix (≥25 m or 15 s) re-projects the start time. Within 150 m the barista is notified immediately. Fixes less accurate than 100 m are ignored.
   - "I'm here" starts the order immediately in either mode.
4. After `Prep` seconds the order becomes **Ready**.

## Accounts and profile
- Sign up with mobile number + 6-digit SMS code (Jordan +962 7X, Saudi +966 5X). Mock code: `123456`. Plug a real SMS provider into `requestOtp` / `verifyOtp` in `src/services/auth.ts`.
- Profile: edit name/email, order history with "Order again", favourites (♡ items and saved drinks with exact options), saved cards, wallet top-up, points and wallet history, sign out.
- Session stays signed in between launches (SecureStore on device). Other local data uses AsyncStorage until the backend exists.

## Checkout and loyalty
- Methods: Apple Pay (iOS) / Google Pay (Android), card (Visa, Mastercard, mada in Saudi), X Wallet, pay at counter.
- Payments go through `src/services/paymentService.ts` (mock). Swap in the chosen provider's SDK; card data must go to the provider, never to our servers.
- Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined, `4406 4700 0000 0008` shows as mada.
- Points (`src/domain/loyalty.ts`): ~5% back. Jordan 10 pts per JD, 100 pts = 0.500 JD. Saudi 2 pts per SAR, 100 pts = 2.50 SAR. Earned on the amount paid once the order is picked up; redeemed in steps of 100. Cancelling returns redeemed points and wallet money.

## What is mocked / needs your input
- `src/services/orderService.ts`: in-memory backend. Implement the `OrderService` interface against the real system and run `orderEngine` server-side so baristas are notified even if the customer's phone sleeps.
- Branch coordinates in `src/domain/market.ts` (Amman, Riyadh) and all prices in `src/domain/menu.ts` / `options.ts` are placeholders.
- ETA is a straight-line estimate; swap in a routing API (Google/Mapbox) for traffic-aware times.
- Live tracking runs while the app is open (foreground). Tracking while the app is backgrounded needs background-location permission + `expo-task-manager`.
- Product photos in `src/domain/menu.ts` are placeholder stock URLs; swap in the shop's own.
- Logo is a code-drawn "X" (`XLogo`); replace with the real asset and app icon in `assets/`.
- In dev builds the order screen shows **test tools** to simulate driving closer (5 km → 100 m).
