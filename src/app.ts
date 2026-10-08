import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import type {
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
} from "./types.js";

const MAX_MESSAGE_LENGTH = 500;

// Builds the app WITHOUT listening, so tests can start it on a random port later.
export function buildServer() {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use(express.static(path.join(process.cwd(), "public")));

  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);

  io.on("connection", (socket) => {
    console.log(`[socket] connected ${socket.id}`);

    socket.on("chat:send", (text) => {
      // Never trust the client. Full zod validation comes in Phase 3.
      if (typeof text !== "string") return;
      const trimmed = text.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_MESSAGE_LENGTH) return;

      const msg: ChatMessage = {
        id: randomUUID(),
        from: socket.id.slice(0, 5), // temporary until usernames exist
        text: trimmed,
        sentAt: Date.now(), // server time, not client time
      };
      io.emit("chat:message", msg); // broadcast to every connected tab
    });

    socket.on("disconnect", (reason) => {
      console.log(`[socket] disconnected ${socket.id} (${reason})`);
    });
  });

  return { app, httpServer, io };
}
