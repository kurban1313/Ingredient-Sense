import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ingredient.copilot',
  appName: 'Ingredient Sense', // Renamed
  webDir: 'dist',
  backgroundColor: '#00000000',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#00000000"
    }
  }
};

export default config;
