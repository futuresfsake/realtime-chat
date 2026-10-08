import { buildServer } from "./app.js";

const PORT = Number(process.env.PORT) || 3000;
const { httpServer, io } = buildServer();

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other server (Ctrl+C) or run: PORT=3001 npm run dev`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// Graceful shutdown: close sockets cleanly when the platform stops us.
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  io.close(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
