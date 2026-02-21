import { Router } from "express";
import { config } from "../lib/config.js";

export const feedRouter = Router();

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

feedRouter.get("/feed", async (req, res, next) => {
  try {
    const sort = String(req.query.sort || "new");
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    let rows = [];

    if (sort === "random") {
      const { data, error } = await req.sb
        .from("media")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      rows = shuffle(data || []).slice(offset, offset + limit);
    } else {
      const asc = sort === "old";
      const { data, error } = await req.sb
        .from("media")
        .select("*")
        .order("created_at", { ascending: asc })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      rows = data || [];
    }

    const albumIds = Array.from(
      new Set(
        (rows || [])
          .map((m) => m.album_id)
          .filter(Boolean)
      )
    );
    let albumTitleById = new Map();
    if (albumIds.length) {
      const { data: albums, error: aErr } = await req.sb
        .from("albums")
        .select("id,title")
        .in("id", albumIds);
      if (aErr) throw aErr;
      albumTitleById = new Map((albums || []).map((a) => [a.id, a.title]));
    }

    // Attach signed URLs for private bucket + album title
    const out = [];
    for (const m of rows) {
      const { data: signed, error: sErr } = await req.sb
        .storage
        .from(config.bucket)
        .createSignedUrl(m.storage_path, config.signedUrlExpires);
      if (sErr) throw sErr;

      out.push({
        ...m,
        signed_url: signed.signedUrl,
        album_title: m.album_id ? albumTitleById.get(m.album_id) || null : null,
      });
    }

    res.json({ items: out, limit, offset, sort });
  } catch (e) {
    next(e);
  }
});
