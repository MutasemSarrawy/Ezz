import React, { useCallback, useEffect, useRef } from 'react';
import { BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/state/store';
import Splash from './src/screens/Splash';
import Login from './src/screens/Login';
import Home from './src/screens/Home';
import Product from './src/screens/Product';
import Order from './src/screens/Order';
import Tracking from './src/screens/Tracking';
import Staff from './src/screens/Staff';
import StaffLogin from './src/screens/StaffLogin';
import Settings from './src/screens/Settings';
import Checkout from './src/screens/Checkout';
import SignUp from './src/screens/SignUp';
import Profile from './src/screens/Profile';
import EditProfile from './src/screens/EditProfile';
import History from './src/screens/History';
import Favourites from './src/screens/Favourites';
import Wallet from './src/screens/Wallet';
import AddressScreen from './src/screens/Address';

function Router() {
  const { route, reset, back, isRTL, session } = useStore();
  // Read the session through a ref so a session restored mid-splash doesn't restart the animation.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const done = useCallback(() => reset(sessionRef.current ? 'home' : 'login'), [reset]);

  // Android hardware back walks the in-app history before leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  const screen = (() => {
    switch (route) {
      case 'splash': return <Splash onDone={done} />;
      case 'login': return <Login />;
      case 'home': return <Home />;
      case 'product': return <Product />;
      case 'order': return <Order />;
      case 'checkout': return <Checkout />;
      case 'signup': return <SignUp />;
      case 'profile': return <Profile />;
      case 'editProfile': return <EditProfile />;
      case 'history': return <History />;
      case 'favourites': return <Favourites />;
      case 'wallet': return <Wallet />;
      case 'address': return <AddressScreen />;
      case 'tracking': return <Tracking />;
      case 'barista': return <Staff />;
      case 'staffLogin': return <StaffLogin />;
      case 'settings': return <Settings />;
    }
  })();

  // Layout direction flips for Arabic without an app restart.
  return <View style={{ flex: 1, direction: isRTL ? 'rtl' : 'ltr' }}>{screen}</View>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Router />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
