import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bowtaifitness.app',
  appName: 'Bowtai Fitness',
  webDir: 'dist',
  server: {
    hostname: 'app.bowtaifitness.com',
    allowNavigation: [
      '*.stripe.com',
      '*.google.com',
      '*.apple.com',
      '*.facebook.com',
      '*.youtube.com',
      '*.youtube-nocookie.com',
      '*.googlevideo.com',
      '*.supabase.co',
    ],
  },
  plugins: {
    Browser: {
      // iOS will handle com.bowtaifitness.app:// scheme callbacks
    },
    YoutubePlayer: {
      patchRefererHeader: true,
      refererHeader: 'https://app.bowtaifitness.com',
    },
  },
  ios: {
    scheme: 'com.bowtaifitness.app',
    allowsLinkPreview: false,
    contentInset: 'never',
    preferredContentMode: 'mobile',
    allowsInlineMediaPlayback: true,
    backgroundColor: '#ffffff',
  },
};

export default config;
