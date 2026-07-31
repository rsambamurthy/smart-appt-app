# SmartAppt Mobile App — Expo Setup

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli eas-cli`
- Android Studio (for Android emulator) or Xcode (for iOS simulator)

## 1. Install dependencies

```bash
cd mobile
npm install
```

## 2. Set your backend URL

Open `src/api/client.ts` and change `API_BASE` to your Railway backend URL:

```ts
export const API_BASE = 'https://YOUR-RAILWAY-APP.railway.app/api/v1';
```

## 3. Run on simulator

```bash
# Android
npm run android

# iOS (macOS only)
npm run ios

# Expo Go (scan QR on your phone)
npm start
```

## 4. Build APK / IPA for distribution

```bash
# Configure EAS first (one-time)
eas build:configure

# Android APK
eas build --platform android

# iOS (requires Apple Developer account)
eas build --platform ios
```

## How the mobile config works

1. Super User logs into the **web app** → System Settings → Mobile App Config
2. Toggle which features are visible for each association
3. Mobile app users see only the enabled sections in their bottom tabs
4. "Can Post" permission controls whether residents can submit/create records

## App structure

```
mobile/
├── App.tsx                     Entry point, Redux store + session restore
├── src/
│   ├── api/
│   │   ├── client.ts           Fetch wrapper with JWT auth
│   │   └── types.ts            Shared API types
│   ├── store/
│   │   ├── index.ts            Redux store
│   │   └── authSlice.ts        Auth + mobile config state
│   ├── navigation/
│   │   ├── RootNavigator.tsx   Login ↔ Main stack
│   │   └── MainTabNavigator.tsx Dynamic bottom tabs from mobile config
│   └── screens/
│       ├── LoginScreen.tsx
│       ├── HomeScreen.tsx      Dashboard with quick-access tiles
│       ├── BillsScreen.tsx     My Bills & Payments
│       ├── AnnouncementsScreen.tsx
│       ├── MaintenanceScreen.tsx   Service requests
│       ├── VisitorsScreen.tsx
│       ├── JournalScreen.tsx   Accounting journal entries
│       ├── LedgerScreen.tsx    Account-level ledger
│       ├── PnLScreen.tsx       Profit & Loss report
│       ├── BalanceSheetScreen.tsx
│       └── MoreScreen.tsx      Overflow tabs + logout
```
