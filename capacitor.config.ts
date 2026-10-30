import type { CapacitorConfig } from '@capacitor/cli';

// iOS shell around the Vite build. Run `npm run ios:sync` after building on a Mac with Xcode.
const config: CapacitorConfig = {
  appId: 'com.hollowdrift.game',
  appName: 'Hollowdrift',
  webDir: 'dist',
  backgroundColor: '#1b0f10',
  ios: {
    // The game draws edge to edge; the Xcode project locks orientation to landscape.
    contentInset: 'never',
    backgroundColor: '#1b0f10',
    preferredContentMode: 'mobile',
    scrollEnabled: false,
  },
};

export default config;
