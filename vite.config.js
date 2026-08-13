import { defineConfig } from 'vite';

export default defineConfig({
    // Use relative paths so the build works when served from any subdirectory:
    // - Production:  https://musabaqa.kauzariyya.com/mobile-app/
    // - Local test:  http://localhost/kauzariyya-musabaqa/web/mobile-app/
    // - Capacitor:   android WebView via server.url
    base: './',
});
