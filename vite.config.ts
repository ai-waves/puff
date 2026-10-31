import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const LEVEL_DIR = fileURLToPath(new URL('./src/game/levels/data', import.meta.url));

// The level editor's save button (dev server only). It writes the level's JSON file and nothing
// else, and the editor already holds what it saved, so that write doesn't reload the page.
function levelEditor(): Plugin {
  const written = new Map<string, number>(); // file -> when the editor wrote it
  return {
    name: 'hollowdrift-level-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__editor/save', (req, res) => {
        const reply = (status: number, text: string) => {
          res.statusCode = status;
          res.setHeader('content-type', 'text/plain');
          res.end(text);
        };
        if (req.method !== 'POST') return reply(405, 'POST a level');
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => (body += chunk));
        req.on('end', async () => {
          try {
            const { id, text } = JSON.parse(body) as { id: unknown; text: unknown };
            if (typeof id !== 'string' || !/^\d+-\d+$/.test(id)) return reply(400, 'A level ID looks like 1-2');
            if (typeof text !== 'string' || (JSON.parse(text) as { id?: unknown }).id !== id) return reply(400, "The level's JSON doesn't match its ID");
            const file = resolve(LEVEL_DIR, `${id}.json`);
            // Only levels that already have a file: new ones are added by hand, with their import.
            await readFile(file);
            written.set(file, Date.now());
            await writeFile(file, text);
            reply(200, 'saved');
          } catch (err) {
            reply(500, (err as Error).message);
          }
        });
      });
    },
    handleHotUpdate(ctx) {
      const at = written.get(ctx.file);
      if (at !== undefined && Date.now() - at < 3000) return [];
      return undefined;
    },
  };
}

export default defineConfig({
  plugins: [levelEditor()],
  // box2d3-wasm finds its .wasm next to its own module. Pre-bundling would move the module away
  // from the file, so serve it as-is; production builds copy the .wasm into dist as an asset.
  optimizeDeps: { exclude: ['box2d3-wasm'] },
  build: { target: 'es2022' },
});
