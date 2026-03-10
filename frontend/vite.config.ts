import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react-swc'
import eslint from 'vite-plugin-eslint';


// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
      react(),
      eslint({
        // optional: nur bestimmte Dateien/Ordner prüfen
        include: ['src/**/*.ts', 'src/**/*.tsx'],
        fix: true, // optional: Fehler automatisch beheben
      })
  ],
  css: {
    preprocessorOptions: {
      scss: {
        // additionalData: `@import "src/styles/variables";`
      },
    },
  },
})
