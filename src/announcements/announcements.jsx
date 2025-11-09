import React, { useEffect, useMemo, useState } from "react";
import "./announcements.css";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { motion } from "framer-motion";
import leftArrow from "../assets/leftArrow.png";
import rightArrow from "../assets/rightArrow.png";

/* ---------- Helpers ---------- */

/* 1) Detect YouTube URLs */
const isYouTube = (url, mediaType) => {
  if (!url) return false;
  if (mediaType === "youtube") return true;
  return /(youtube\.com|youtu\.be)\//i.test(url);
};

/* Convert any common YouTube URL into an embeddable URL */
const getYouTubeEmbed = (raw) => {
  try {
    const u = new URL(raw);
    let id = "";

    // watch?v=ID
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      id = u.searchParams.get("v");
    }
    // youtu.be/ID
    if (!id && u.hostname.includes("youtu.be")) {
      id = u.pathname.split("/")[1];
    }
    // /shorts/ID or /embed/ID
    if (!id && u.pathname.includes("/shorts/")) {
      id = u.pathname.split("/shorts/")[1].split("/")[0];
    }
    if (!id && u.pathname.includes("/embed/")) {
      id = u.pathname.split("/embed/")[1].split("/")[0];
    }
    if (!id) return null;

    // start time ?t=120 or &start=120
    const t = u.searchParams.get("t") || u.searchParams.get("start");
    const start = t ? parseInt(String(t).replace(/s$/i, ""), 10) || 0 : 0;

    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      start: String(start),
    });

    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
  } catch {
    return null;
  }
};

/* 2) Detect direct video files by extension (works for most hosts) */
const videoExtRe = /\.(mp4|m4v|webm|ogg|ogv|mov|mkv)(\?.*)?$/i;
const isVideoFile = (url, mediaType) => {
  if (!url) return false;
  if (mediaType === "video") return true;
  if (mediaType === "image" || mediaType === "youtube") return false;
  return videoExtRe.test(url);
};

/* Guess MIME type for the <source> tag (helps some browsers) */
const guessMime = (url) => {
  const m = String(url).toLowerCase().match(videoExtRe);
  const ext = m?.[1];
  switch (ext) {
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "ogg":
    case "ogv":
      return "video/ogg";
    case "mov":
      return "video/quicktime";
    case "mkv":
      return "video/x-matroska"; // not all browsers support, but harmless
    default:
      return undefined;
  }
};

export default function Announcement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(rows);
        setLoading(false);
        setIdx((old) => (rows.length ? Math.min(old, rows.length - 1) : 0));
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const ann = useMemo(() => (items.length ? items[idx] : null), [items, idx]);

  // arrows: no looping
  const hasPrev = idx > 0;
  const hasNext = idx < items.length - 1;
  const prev = () => setIdx((p) => (p > 0 ? p - 1 : p));
  const next = () => setIdx((p) => (p < items.length - 1 ? p + 1 : p));

  return (
    <section className="announce-wrap">
      <div className="announce-card">
        <h2 className="stoke-text">Announcement</h2>

        {loading && (
          <div className="announce-skeleton">
            <div className="sk-media" />
            <div className="sk-lines">
              <div className="sk-line" />
              <div className="sk-line short" />
            </div>
          </div>
        )}

        {!loading && !ann && <p className="announce-empty">No announcement yet.</p>}

        {ann && (
          <div className="announce-content">
            {/* media + decor */}
            <div className="announce-media">
              <motion.div
                initial={{ opacity: 0, x: -60 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", duration: 1.2 }}
                className="anoframe"
              />
              <motion.div
                initial={{ opacity: 0, x: 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", duration: 1.2 }}
                className="anobg-block"
              />

              {/* ---- Render YouTube | Video file | Image | Fallback ---- */}
              {isYouTube(ann.mediaUrl, ann.mediaType) ? (
                <div className="media-frame" key={`y-${ann.id}`}>
                  <iframe
                    className="yt-frame"
                    src={getYouTubeEmbed(ann.mediaUrl) || ""}
                    title={ann.title || "YouTube video"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : isVideoFile(ann.mediaUrl, ann.mediaType) ? (
                <video
                  key={`v-${ann.id}`}
                  className="media-box"
                  controls
                  playsInline
                >
                  <source src={ann.mediaUrl} type={guessMime(ann.mediaUrl)} />
                  {/* Fallback text if codec unsupported */}
                  Your browser cannot play this video.
                </video>
              ) : ann.mediaUrl ? (
                <img
                  key={`i-${ann.id}`}
                  className="media-box"
                  src={ann.mediaUrl}
                  alt={ann.title || "Announcement"}
                />
              ) : (
                <div className="media-box no-media">No media</div>
              )}

              {/* arrows: only if there are 2+ items */}
              {items.length > 1 && (
                <div className="anoarrows">
                  <img
                    src={leftArrow}
                    alt="previous"
                    className={`arrow-img ${hasPrev ? "" : "disabled"}`}
                    onClick={hasPrev ? prev : undefined}
                  />
                  <img
                    src={rightArrow}
                    alt="next"
                    className={`arrow-img ${hasNext ? "" : "disabled"}`}
                    onClick={hasNext ? next : undefined}
                  />
                </div>
              )}
            </div>

            {/* text */}
            <div className="announce-text">
              <h3>{ann.title || "Untitled"}</h3>
              {ann.body && <p>{ann.body}</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
