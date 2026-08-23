import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mbtidebate.platform',
  appName: 'MBTI辩论平台',
  webDir: 'dist',
  server: {
    // 允许访问明文 HTTP（局域网后端 http://192.168.x.x:3001）
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
