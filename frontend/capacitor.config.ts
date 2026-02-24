const config = {
  appId: 'app.shopkeeper.pos',
  appName: 'ShopKeeper',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Searching for printers...',
        cancel: 'Cancel',
        availableDevices: 'Available devices',
        noDeviceFound: 'No printer found',
      },
    },
  },
} as const;

export default config;
