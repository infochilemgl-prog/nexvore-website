import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App";
import "./styles/globals.css";

// Polling fallback for live-ish updates. Socket.IO cannot run on Vercel's
// standard serverless functions (no persistent WebSocket host on that
// deployment path -- see the repo README's "Limitaciones en Vercel"). In
// this codebase that's a documentation concern more than a regression:
// the backend's Socket.IO server only ever had an inert
// `io.on("connection")` handler that never actually emitted anything, and
// no frontend code ever opened a socket.io-client connection to it, so
// polling was already the dashboard's real "live update" mechanism on
// every deployment target, not just Vercel. This default just makes that
// baseline explicit and applies it everywhere; individual pages (Inbox,
// Approvals, Maintenance, Overview) already override it with a faster
// interval where that matters more.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchInterval: 20_000,
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
