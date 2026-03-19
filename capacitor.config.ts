import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.condomanager.app',
  appName: 'CasaMGR',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#f5f2ed',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff',
      overlaysWebView: true,
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#f5f2ed',
      showSpinner: false,
    },
  },
};

export default config;
