// Owners.jsx
import React, { useEffect, useState } from "react";
import "./owners.css";
import leftArrow from "../assets/leftArrow.png";
import rightArrow from "../assets/rightArrow.png";
import { motion } from "framer-motion";

/* ✅ using your shared exports (db and storage) */
import { db, storage } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

/* use storage helpers but use the storage instance you export */
import { ref as storageRef, getDownloadURL } from "firebase/storage";

const ROLE_ORDER = ["Leader", "Secretary", "Treasurer","President","editing"]; // display order

export default function Owners() {
  const transition = { type: "spring", duration: 3 };
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(0);

  // fetch members and resolve photo URL from storage if needed
useEffect(() => {
  (async () => {
    try {
      const q = query(
        collection(db, "committeeMembers"),
        where("role", "in", ROLE_ORDER)
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const rowsWithUrls = await Promise.all(
        rows.map(async (r) => {
          let url = r.photoUrl || "";

          const looksLikeHttp = typeof url === "string" && url.startsWith("http");
          const looksLikeGs = typeof url === "string" && url.startsWith("gs://");
          const looksLikePath = typeof url === "string" && !looksLikeHttp && !looksLikeGs && url.length > 0;

          if (looksLikeGs) {
            try {
              const withoutPrefix = url.replace(/^gs:\/\/[^/]+\//, "");
              const ref = storageRef(storage, withoutPrefix);
              url = await getDownloadURL(ref);
            } catch (err) {
              console.warn("getDownloadURL failed for gs:// url:", url, err);
            }
          } else if (looksLikePath) {
            try {
              const ref = storageRef(storage, url);
              url = await getDownloadURL(ref);
            } catch (err) {
              console.warn("getDownloadURL failed for storage path:", url, err);
            }
          }

          // ✅ DO NOT decode full download URLs
          return { ...r, photoUrl: url };
        })
      );

      rowsWithUrls.sort(
        (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
      );

      setMembers(rowsWithUrls);
      setSelected(0);
      console.log("Loaded committee members:", rowsWithUrls);
    } catch (err) {
      console.error("Failed to load committee members:", err);
    }
  })();
}, []);


  useEffect(() => {
    if (members.length > 0 && selected >= members.length) {
      setSelected(0);
    }
  }, [members, selected]);

  const tLength = members.length;

  if (!tLength) {
    return (
      <div className="owners">
        <div className="left-o">
          <span>Team Members</span>
          <span className="stoke-text">Top 3 Members</span>
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  const cur = members[selected] || {};
  const photo =
    (cur.photoUrl && String(cur.photoUrl)) ||
    "https://via.placeholder.com/320x320?text=Member";

  return (
    <div className="owners">
      {/* RIGHT: image + arrows */}
      <div className="right-o">
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

<motion.img
  key={cur.id || selected}
  initial={{ opacity: 0, x: 100 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -100 }}
  transition={transition}
  src={photo}
  alt={`${cur.name || "Member"} photo`}
  onError={(e) => {
    console.error("Image failed to load:", photo);
    e.currentTarget.src =
      "https://via.placeholder.com/320x320?text=Member";
  }}
  style={{ maxWidth: "320px", maxHeight: "320px", objectFit: "cover" }}
/>


        <div className="owners-arrows">
          <img
            src={leftArrow}
            alt="previous"
            onClick={() =>
              setSelected((p) => (p === 0 ? tLength - 1 : p - 1))
            }
          />
          <img
            src={rightArrow}
            alt="next"
            onClick={() =>
              setSelected((p) => (p === tLength - 1 ? 0 : p + 1))
            }
          />
        </div>
      </div>

      {/* LEFT */}
      <div className="left-o">
        <span>Team Members</span>
        <span className="stoke-text">Top 3 Members</span>
        <span>Currently</span>

        <motion.span
          key={`email-${cur.id || selected}`}
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={transition}
        >
          {cur.email}
        </motion.span>

        <span>
          <span style={{ color: "var(--red)", fontWeight: "bold" }}>
            {cur.name} —{" "}
          </span>
          {cur.role}
        </span>
      </div>
    </div>
  );
}
