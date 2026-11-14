import { createSpaceExplorerApp } from './server/app.ts';
import { loadConfig } from './server/config.ts';

/**
 * Standalone entry point: `npm start` (production) or `npm run dev` (Vite dev server).
 * Hosts that want to embed the module in their own Node server import
 * `createSpaceExplorerApp` / `createApiRouter` from ./server/app.ts instead.
 */
async function main() {
  const config = loadConfig();
  const app = await createSpaceExplorerApp(config);
  app.listen(config.port, config.host, () => {
    const base = config.basePath === '/' ? '/' : `${config.basePath}/`;
    console.log(
      `Space Explorer listening on http://${config.host}:${config.port}${base} ` +
        `(${config.isProduction ? 'production' : 'development'}, notes: ${config.notebookMode === 'server' ? `shared server notebook in ${config.dataDir}` : 'kept in each visitor\'s browser'})`
    );
  });
}

main().catch((err) => {
  console.error('Space Explorer failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});
