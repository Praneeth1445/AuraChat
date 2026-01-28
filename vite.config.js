import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom'],
                    'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
                },
            },
        },
        chunkSizeWarningLimit: 1000,
    },
});
