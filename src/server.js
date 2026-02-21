import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "./lib/config.js";
import { requireSession } from "./middleware/requireSession.js";

import { healthRouter } from "./routes/heath.js";
import { authRouter } from "./routes/auth.js";
import { feedRouter } from "./routes/feed.js";
import { albumsRouter } from "./routes/albums.js";
import { mediaRouter } from "./routes/media.js";
import { storageRouter } from "./routes/storage.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" })); // metadata only
app.use(morgan("dev"));

app.use(healthRouter);
app.use(authRouter);

// everything below requires custom OTP session
app.use(requireSession);
app.use(feedRouter);
app.use(albumsRouter);
app.use(mediaRouter);
app.use(storageRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(Number(err?.status || 500)).json({
    error: err?.message || "Server error",
    detail: String(err?.message || err),
  });
});

app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}`);
});
