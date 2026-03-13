import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import eslint from 'vite-plugin-eslint';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function schemaWatcherPlugin(): Plugin {
    const schemaSourceDir = path.resolve(__dirname, '../model/schema');
    const schemaTargetDir = path.resolve(__dirname, 'public/schemas');

    function copySchemas(changedFile?: string) {
        fs.mkdirSync(schemaTargetDir, { recursive: true });

        // Nur die direkt im Verzeichnis liegenden JSON-Dateien (nicht Archive-Unterordner)
        const files = fs.readdirSync(schemaSourceDir).filter(f => {
            const fullPath = path.join(schemaSourceDir, f);
            return f.endsWith('.json') && fs.statSync(fullPath).isFile();
        });

        for (const file of files) {
            // Wenn ein konkretes File übergeben wurde, nur dieses kopieren
            if (changedFile && path.basename(changedFile) !== file) continue;
            fs.copyFileSync(
                path.join(schemaSourceDir, file),
                path.join(schemaTargetDir, file)
            );
            console.log(`[schema-watcher] Copied: ${file} → public/schemas/`);
        }
    }

    return {
        name: 'schema-watcher',

        // Beim Build: alle Schemas kopieren
        buildStart() {
            copySchemas();
        },

        // Im Dev-Server: Watcher auf model/schema registrieren
        configureServer(server) {
            copySchemas();

            server.watcher.add(schemaSourceDir);

            const onSchemaChange = (filePath: string) => {
                if (!filePath.startsWith(schemaSourceDir) || !filePath.endsWith('.json')) return;
                copySchemas(filePath);
                // Vite 7: server.hot statt server.ws
                server.hot.send({ type: 'full-reload', path: '*' });
            };

            server.watcher.on('change', onSchemaChange);
            server.watcher.on('add', onSchemaChange);
            server.watcher.on('unlink', (filePath) => {
                if (!filePath.startsWith(schemaSourceDir) || !filePath.endsWith('.json')) return;
                const target = path.join(schemaTargetDir, path.basename(filePath));
                if (fs.existsSync(target)) {
                    fs.unlinkSync(target);
                    console.log(`[schema-watcher] Removed: ${path.basename(filePath)} from public/schemas/`);
                }
                server.hot.send({ type: 'full-reload', path: '*' });
            });
        },
    };
}

export default defineConfig({
    base: './',
    plugins: [
        react(),
        eslint({
            include: ['src/**/*.ts', 'src/**/*.tsx'],
            fix: true,
        }),
        schemaWatcherPlugin(),
    ],
    css: {
        preprocessorOptions: {
            scss: {},
        },
    },
})
