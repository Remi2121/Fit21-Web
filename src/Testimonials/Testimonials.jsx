// src/components/Testimonials.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./Testimonials.css";
import leftArrow from "../assets/leftArrow.png";
import rightArrow from "../assets/rightArrow.png";
import { motion } from "framer-motion";

import { db, storage } from "../firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";

const transition = { type: "spring", duration: 3 };

/** Prefer mediaURL; else resolve from storagePath */
const resolveMediaURL = async (docData) => {
  if (docData.mediaURL) return docData.mediaURL;
  if (docData.storagePath) {
    const r = ref(storage, docData.storagePath);
    return await getDownloadURL(r);
  }
  return "https://via.placeholder.com/320x420?text=No+Media";
};

const Testimonials = () => {
  const [items, setItems] = useState([]); // [{id,title,description,mediaType,image}]
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // 🔁 LIVE: achievements ordered by "order"
    const q = query(collection(db, "achievements"), orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        try {
          const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const withUrls = await Promise.all(
            raw.map(async (r) => ({
              ...r,
              image: await resolveMediaURL(r),
            }))
          );
          setItems(withUrls);
          setLoading(false);
          setSelected((p) => (withUrls.length ? Math.min(p, withUrls.length - 1) : 0));
        } catch (e) {
          setError(e.message || "Failed to load achievements");
          setLoading(false);
        }
      },
      (e) => {
        setError(e.message || "Failed to subscribe to achievements");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const tLength = items.length;
  const current = useMemo(() => (tLength ? items[selected] : null), [items, selected, tLength]);

  const goPrev = () => tLength && setSelected((p) => (p === 0 ? tLength - 1 : p - 1));
  const goNext = () => tLength && setSelected((p) => (p === tLength - 1 ? 0 : p + 1));

  if (loading) {
    return (
      <div className="testimonials">
        <div className="left-t">
          <span>About Us</span>
          <span className="stoke-text">What We Achieved</span>
          <span>Currently</span>
          <span>Loading achievements…</span>
        </div>
        <div className="right-t" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="testimonials">
        <div className="left-t">
          <span>About Us</span>
          <span className="stoke-text">What We Achieved</span>
          <span>Currently</span>
          <span style={{ textTransform: "none" }}>Error: {error}</span>
        </div>
        <div className="right-t" />
      </div>
    );
  }

  if (!tLength) {
    return (
      <div className="testimonials">
        <div className="left-t">
          <span>About Us</span>
          <span className="stoke-text">What We Achieved</span>
          <span>Currently</span>
          <span style={{ textTransform: "none" }}>
            No achievements yet. Add documents to the <b>achievements</b> collection.
          </span>
        </div>
        <div className="right-t" />
      </div>
    );
  }

  return (
    <div className="testimonials">
      <div className="left-t">
        <span>About Us</span>
        <span className="stoke-text">What We Achieved</span>
        <span>Currently</span>

        <motion.span
          key={current.id + "_desc"}
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={transition}
          style={{ textTransform: "none" }}
        >
          {current.description || ""}
        </motion.span>

        <span>

          <motion.span
          key={current.id + "_desc"}
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={transition}
          style={{ textTransform: "none" , color: "rgba(255, 5, 5, 0.93)" , fontWeight: "bold"}}>
            {current.title || "Achievement"}
          </motion.span>
        </span>
      </div>

      <div className="right-t">
        {/* decorative layers */}
        <motion.div
          initial={{ opacity: 0, x: -100 }}
          transition={{ ...transition, duration: 3 }}
          whileInView={{ opacity: 1, x: 0 }}
          className="frame"
        />
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          transition={{ ...transition, duration: 3 }}
          whileInView={{ opacity: 1, x: 0 }}
          className="bg-block"
        />

        {/* media (image or video) */}
        {current.mediaType === "video" ? (
          <motion.video
            key={current.id + "_video"}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={transition}
            src={current.image}
            className="ach-video"
            controls
          />
        ) : (
          <motion.img
            key={current.id + "_img"}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={transition}
            src={current.image}
            alt={current.title || "achievement"}
          />
        )}

        {/* arrows */}
        <div className="arrows">
          <img src={leftArrow} alt="previous" onClick={goPrev} />
          <img src={rightArrow} alt="next" onClick={goNext} />
        </div>
      </div>
    </div>
  );
};

export default Testimonials;
