import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const webRoot = fileURLToPath(new URL("..", import.meta.url));

export default async function globalSetup() {
  const server = await createServer({
    root: webRoot,
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
    },
  });

  await server.listen();

  return async () => {
    await server.close();
  };
}
