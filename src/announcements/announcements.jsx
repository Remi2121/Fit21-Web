import React, { useEffect, useState } from "react";
import "./announcements.css";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

/* detect video by mediaType or file extension */
const isVideo = (url, mediaType) => {
  if (!url) return false;
  if (mediaType === "video") return true;
  if (mediaType === "image") return false;
  return /\.(mp4|webm|ogg)$/i.test(url);
};

export default function Announcement() {
  const [ann, setAnn] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // get most recent announcement
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAnn(snap.docs[0]?.data() || null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

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

        {!loading && !ann && (
          <p className="announce-empty">No announcement yet.</p>
        )}

        {ann && (
          <div className="announce-content">
            {/* media (optional) */}
            <div className="announce-media">
              {ann.mediaUrl ? (
                isVideo(ann.mediaUrl, ann.mediaType) ? (
                  <video
                    className="media-box"
                    src={ann.mediaUrl}
                    controls
                    playsInline
                  />
                ) : (
                  <img
                    className="media-box"
                    src={ann.mediaUrl}
                    alt={ann.title || "Announcement"}
                  />
                )
              ) : (
                <div className="media-box no-media">No media</div>
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
