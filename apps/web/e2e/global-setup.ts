import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const appUrl = "http://127.0.0.1:5173";

const isLogixDevServerRunning = async () => {
  if (process.env.CI) return false;

  try {
    const response = await fetch(appUrl);
    if (!response.ok) return false;
    return (await response.text()).includes('data-ui-theme="logix"');
  } catch {
    return false;
  }
};

export default async function globalSetup() {
  if (await isLogixDevServerRunning()) return;

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
