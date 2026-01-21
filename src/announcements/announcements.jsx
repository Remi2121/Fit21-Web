/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from "react";
import "./announcements.css";
import { db, storage } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { motion } from "framer-motion";
import leftArrow from "../assets/leftArrow.png";
import rightArrow from "../assets/rightArrow.png";


/* ---------- Helpers ---------- */
const isYouTube = (url, mediaType) => {
  if (!url) return false;
  if (mediaType === "youtube") return true;
  return /(youtube\.com|youtu\.be)\//i.test(url);
};

const getYouTubeEmbed = (raw) => {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    let id = "";

    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      id = u.searchParams.get("v");
    }
    if (!id && u.hostname.includes("youtu.be")) {
      id = u.pathname.split("/")[1];
    }
    if (!id && u.pathname.includes("/shorts/")) {
      id = u.pathname.split("/shorts/")[1].split("/")[0];
    }
    if (!id && u.pathname.includes("/embed/")) {
      id = u.pathname.split("/embed/")[1].split("/")[0];
    }
    if (!id) return null;

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

const videoExtRe = /\.(mp4|m4v|webm|ogg|ogv|mov|mkv)(\?.*)?$/i;
const imgExtRe = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;

const isVideoFile = (url, mediaType) => {
  if (!url) return false;
  if (mediaType === "video") return true;
  if (mediaType === "image" || mediaType === "youtube") return false;
  return videoExtRe.test(url);
};
const isImageFile = (url, mediaType) => {
  if (!url) return false;
  if (mediaType === "image") return true;
  if (mediaType === "video" || mediaType === "youtube") return false;
  return imgExtRe.test(url);
};

const isGenericLink = (url, mediaType) =>
  !!url &&
  !isYouTube(url, mediaType) &&
  !isVideoFile(url, mediaType) &&
  !isImageFile(url, mediaType);

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
      return "video/x-matroska";
    default:
      return undefined;
  }
};

/* ---------- Clean linkify (no duplicate https or host label) ---------- */
const urlRe = /\b((?:https?:\/\/|www\.)[^\s<]+[^<.,:;"')\]\s])/gi;

function toAbsolute(href) {
  return href.startsWith("http") ? href : `https://${href}`;
}

function prettyText(raw) {
  // remove scheme + www for cleaner display
  return raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
}

function linkify(text) {
  if (!text) return null;

  const nodes = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRe.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // plain text before link
    if (start > lastIndex) {
      nodes.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, start)}</span>);
    }

    const raw = match[0];
    const href = toAbsolute(raw);

    nodes.push(
      <a
        key={`a-${start}`}
        href={href}
        className="anno-link"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="anno-link-dot" aria-hidden>🔗</span>
        <span className="anno-link-text">{prettyText(raw)}</span>
      </a>
    );

    lastIndex = end;
  }

  // remaining text
  if (lastIndex < text.length) {
    nodes.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return nodes;
}

export default function Announcement() {
  const transition = { type: "spring", duration: 3 };
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
      async (snap) => {
        const rows = await Promise.all(
          snap.docs.map(async (d) => {
            const data = { id: d.id, ...d.data() };
            let url = data.mediaUrl || "";

            const isGs = typeof url === "string" && url.startsWith("gs://");
            const isPath =
              typeof url === "string" &&
              !isGs &&
              !url.startsWith("http") &&
              url.length > 0;

            if (isGs) {
              try {
                const withoutPrefix = url.replace(/^gs:\/\/[^/]+\//, "");
                const ref = storageRef(storage, withoutPrefix);
                url = await getDownloadURL(ref);
              } catch (err) {
                console.warn("Failed getDownloadURL for gs://", url, err);
              }
            } else if (isPath) {
              try {
                const ref = storageRef(storage, url);
                url = await getDownloadURL(ref);
              } catch (err) {
                console.warn("Failed getDownloadURL for storage path", url, err);
              }
            }

            return { ...data, mediaUrl: url };
          })
        );

        setItems(rows);
        setLoading(false);
        setIdx((old) => (rows.length ? Math.min(old, rows.length - 1) : 0));
      },
      (err) => {
        console.error("Failed to load announcements:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const ann = useMemo(() => (items.length ? items[idx] : null), [items, idx]);
  const hasPrev = idx > 0;
  const hasNext = idx < items.length - 1;
  const prev = () => setIdx((p) => (p > 0 ? p - 1 : p));
  const next = () => setIdx((p) => (p < items.length - 1 ? p + 1 : p));


  return (
    <section className="announce-wrap">
      <div className="announce-card">
        <h2 className="stoke-text">Announcement</h2>

        {loading && (
          <div className="announce-skeleton" role="status" aria-live="polite">
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
            <div className="announce-media">
              <motion.div
                initial={{ opacity: 0, x: -60 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", duration: 1.2 }}
                className="anoframe"
                aria-hidden
              />
              <motion.div
                initial={{ opacity: 0, x: 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", duration: 1.2 }}
                className="anobg-block"
                aria-hidden
              />

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
                <video key={`v-${ann.id}`} className="media-box" controls playsInline>
                  <source src={ann.mediaUrl} type={guessMime(ann.mediaUrl)} />
                  Your browser cannot play this video.
                </video>
              ) : isImageFile(ann.mediaUrl, ann.mediaType) ? (
                <img
                  key={`i-${ann.id}`}
                  className="media-box"
                  src={ann.mediaUrl}
                  alt={ann.title || "Announcement"}
                />
              ) : isGenericLink(ann.mediaUrl, ann.mediaType) ? (
                <a
                  key={`g-${ann.id}`}
                  href={toAbsolute(ann.mediaUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="anno-cta"
                >
                  Open attachment
                </a>
              ) : (
                <div className="media-box no-media">No media</div>
              )}

                          {items.length > 1 && (
                <div className="anoarrows">
                  <img
                    src={leftArrow}
                    alt="Previous"
                    className={`arrow-img ${hasPrev ? "" : "disabled"}`}
                    onClick={hasPrev ? prev : undefined}
                    tabIndex={0}
                    onKeyDown={(e) =>
                      hasPrev && (e.key === "Enter" || e.key === " ") ? prev() : null
                    }
                  />
                  <img
                    src={rightArrow}
                    alt="Next"
                    className={`arrow-img ${hasNext ? "" : "disabled"}`}
                    onClick={hasNext ? next : undefined}
                    tabIndex={0}
                    onKeyDown={(e) =>
                      hasNext && (e.key === "Enter" || e.key === " ") ? next() : null
                    }
                  />
                </div>
              )}

            </div>

            <motion.div
              initial={{ opacity: 0, x: -100 }}
              transition={{ ...transition, duration: 3 }}
              whileInView={{ opacity: 1, x: 0 }}
              className="announce-text"
            >
              <h3>{ann.title || "Untitled"}</h3>
{ann.body && (
  <div className="anno-body">
    {ann.body.split("\n").map((line, i) => (
      <React.Fragment key={i}>
        {linkify(line)}
        <br />
      </React.Fragment>
    ))}
  </div>
)}
            </motion.div>
          </div>
        )}
      </div>
    </section>
  );
}
