import { fileURLToPath } from "node:url";

import { createServer } from "vite";

import { DEV_SERVER_PORT, isLogixDevServerRunning } from "../src/e2eDevServer";

const webRoot = fileURLToPath(new URL("..", import.meta.url));

export default async function globalSetup() {
  if (await isLogixDevServerRunning()) return;

  const server = await createServer({
    root: webRoot,
    server: {
      host: true,
      port: DEV_SERVER_PORT,
      strictPort: true,
    },
  });

  await server.listen();

  return async () => {
    await server.close();
  };
}
