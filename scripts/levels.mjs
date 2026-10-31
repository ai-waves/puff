// Check every level file and rewrite it in canonical form: the exact form the level editor saves
// and the format test expects. Run it after editing a level's JSON by hand: npm run levels:format
// Vite loads the game's own TypeScript (format.ts, lint.ts), so this can't drift from the game.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const DIR = 'src/game/levels/data';

const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
});
let invalid = 0;
try {
  const { formatLevel, parseLevel } = await server.ssrLoadModule('/src/game/levels/format.ts');
  const { lintLevel } = await server.ssrLoadModule('/src/game/levels/lint.ts');
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  for (const name of files) {
    const path = `${DIR}/${name}`;
    const text = readFileSync(path, 'utf8');
    let def;
    try {
      def = parseLevel(JSON.parse(text));
    } catch (err) {
      // A file the game can't load is left alone: fix it first.
      invalid += 1;
      console.error(`${name}: ${err.message}`);
      continue;
    }
    const canonical = formatLevel(def);
    if (canonical !== text) writeFileSync(path, canonical);
    const problems = lintLevel(def);
    console.log(`${name}: ${canonical !== text ? 'reformatted' : 'ok'}${problems.length ? `, ${problems.length} design problem(s)` : ''}`);
    for (const p of problems) console.log(`  ${p.level}: ${p.message}`);
  }
} finally {
  await server.close();
}
process.exit(invalid ? 1 : 0);
