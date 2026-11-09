import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.chordless.music',
  appName: 'Chordless',
  webDir: '../web/dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
