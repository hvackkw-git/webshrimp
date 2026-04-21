export default {
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  use: {
    browserName: 'chromium',
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
  webServer: {
    command: 'python3 -m http.server 3001 --directory /home/user/webshrimp',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
  },
};
