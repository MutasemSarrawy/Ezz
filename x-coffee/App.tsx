import React, { useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/state/store';
import Splash from './src/screens/Splash';
import Login from './src/screens/Login';
import Home from './src/screens/Home';
import Order from './src/screens/Order';
import Tracking from './src/screens/Tracking';
import Barista from './src/screens/Barista';

function Router() {
  const { route, go } = useStore();
  const done = useCallback(() => go('login'), [go]);
  switch (route) {
    case 'splash': return <Splash onDone={done} />;
    case 'login': return <Login />;
    case 'home': return <Home />;
    case 'order': return <Order />;
    case 'tracking': return <Tracking />;
    case 'barista': return <Barista />;
  }
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
