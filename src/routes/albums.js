import { Router } from "express";
import { z } from "zod";
import { config } from "../lib/config.js";

export const albumsRouter = Router();

albumsRouter.get("/albums", async (req, res, next) => {
  try {
    const sort = String(req.query.sort || "new");
    const asc = sort === "old";

    const { data, error } = await req.sb
      .from("albums")
      .select("*")
      .order("created_at", { ascending: asc });

    if (error) throw error;
    res.json({ items: data || [] });
  } catch (e) {
    next(e);
  }
});

albumsRouter.post("/albums", async (req, res, next) => {
  try {
    const body = z.object({ title: z.string().min(1).max(80) }).parse(req.body);

    const { data, error } = await req.sb
      .from("albums")
      .insert([{ owner_id: req.uid, title: body.title }])
      .select("*")
      .single();

    if (error) throw error;
    res.status(201).json({ album: data });
  } catch (e) {
    next(e);
  }
});

albumsRouter.delete("/albums/:id", async (req, res, next) => {
  try {
    const { id: albumId } = z.object({ id: z.string().uuid() }).parse(req.params);

    const { data: album, error: albumErr } = await req.sb
      .from("albums")
      .select("id,owner_id,title")
      .eq("id", albumId)
      .single();

    if (albumErr || !album) {
      return res.status(404).json({ error: "Album not found" });
    }
    if (album.owner_id !== req.uid) {
      return res.status(403).json({ error: "Not allowed to delete this album" });
    }

    // Keep photos, but move them out of this album.
    const { error: moveErr } = await req.sb
      .from("media")
      .update({ album_id: null })
      .eq("album_id", albumId)
      .eq("owner_id", req.uid);
    if (moveErr) throw moveErr;

    const { error: deleteErr } = await req.sb
      .from("albums")
      .delete()
      .eq("id", albumId)
      .eq("owner_id", req.uid);
    if (deleteErr) throw deleteErr;

    res.json({ ok: true, id: albumId, title: album.title });
  } catch (e) {
    next(e);
  }
});

albumsRouter.get("/albums/:id/media", async (req, res, next) => {
  try {
    const albumId = req.params.id;
    const sort = String(req.query.sort || "new");
    const limit = Math.min(Number(req.query.limit || 30), 50);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const asc = sort === "old";

    const { data, error } = await req.sb
      .from("media")
      .select("*")
      .eq("album_id", albumId)
      .order("created_at", { ascending: asc })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // signed urls
    const out = [];
    for (const m of (data || [])) {
      const { data: signed, error: sErr } = await req.sb
        .storage
        .from(config.bucket)
        .createSignedUrl(m.storage_path, config.signedUrlExpires);
      if (sErr) throw sErr;
      out.push({ ...m, signed_url: signed.signedUrl });
    }

    res.json({ items: out, album_id: albumId, limit, offset, sort });
  } catch (e) {
    next(e);
  }
});
