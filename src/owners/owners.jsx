import React, { useEffect, useState } from "react";
import "./owners.css";
import leftArrow from "../assets/leftArrow.png";
import rightArrow from "../assets/rightArrow.png";
import { motion } from "framer-motion";

/* ✅ use your shared Firebase instance */
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const ROLE_ORDER = ["Leader", "Secretary", "Treasurer"]; // display order

export default function Owners() {
  const transition = { type: "spring", duration: 3 };
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(0);
  const tLength = members.length;

  useEffect(() => {
    // fetch Leader + Secretary + Treasurer
    (async () => {
      try {
        const q = query(
          collection(db, "committeeMembers"),
          where("role", "in", ROLE_ORDER) // Firestore supports 'in' up to 10 values
        );
        const snap = await getDocs(q);

        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // sort into our fixed display order (Leader → Secretary → Treasurer)
        rows.sort(
          (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
        );

        setMembers(rows);
        setSelected(0); // start at first
      } catch (err) {
        console.error("Failed to load committee members:", err);
      }
    })();
  }, []);

  if (!tLength) {
    // simple loading state
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

  const cur = members[selected];
  const photo =
    (cur.photoUrl && String(cur.photoUrl)) ||
    "https://via.placeholder.com/320x320?text=Member";

  return (
    <div className="owners">
      {/* RIGHT: image + arrows (same animations) */}
      <div className="right-o">
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

        {/* main image */}
        <motion.img
          key={cur.id || selected}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={transition}
          src={photo}
          alt={`${cur.name} photo`}
        />

        {/* arrows */}
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

      {/* LEFT: text content (animated) */}
      <div className="left-o">
        <span>Team Members</span>
        <span className="stoke-text">Top 3 Members</span>
        <span>Currently</span>

        {/* review/intro → here we’ll show email as the animated text */}
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
          <span style={{ color: "var(--red)" ,fontWeight:"bold" }}>
            {cur.name} —{" "}
          </span>
          {cur.role}
        </span>
      </div>
    </div>
  );
}
