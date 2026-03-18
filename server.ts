import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory store for the latest signal
  let latestSignal = {
    pair: "EURJPY",
    signal: "WAITING",
    buyerPressure: 50,
    sellerPressure: 50,
    timestamp: new Date().toISOString()
  };

  // API to get the latest signal
  app.get("/api/latest", (req, res) => {
    res.json(latestSignal);
  });

  // API for TradingView Webhooks (Alerts)
  app.post("/api/signal", (req, res) => {
    const { pair, signal, buyerPressure, sellerPressure } = req.body;
    if (pair && signal) {
      latestSignal = {
        pair,
        signal: signal.toUpperCase(),
        buyerPressure: buyerPressure || (signal.toUpperCase() === 'BUY' ? 75 : 25),
        sellerPressure: sellerPressure || (signal.toUpperCase() === 'SELL' ? 75 : 25),
        timestamp: new Date().toISOString()
      };
      console.log(`New signal received: ${pair} - ${signal}`);
      res.json({ status: "success", message: "Signal updated" });
    } else {
      res.status(400).json({ status: "error", message: "Invalid signal data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
