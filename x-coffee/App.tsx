import React, { useCallback, useEffect } from 'react';
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
import Barista from './src/screens/Barista';
import Settings from './src/screens/Settings';
import Checkout from './src/screens/Checkout';

function Router() {
  const { route, reset, back, isRTL } = useStore();
  const done = useCallback(() => reset('login'), [reset]);

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
      case 'tracking': return <Tracking />;
      case 'barista': return <Barista />;
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
