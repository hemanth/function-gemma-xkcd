import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    base: '/ai/functiongemma/',
    plugins: [
        viteStaticCopy({
            targets: [
                { src: 'worker.js', dest: '.' }
            ]
        })
    ],
    build: {
        outDir: 'dist',
        assetsDir: 'assets'
    }
});
