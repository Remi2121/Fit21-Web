// src/Admin/components/Attendance/Attendance.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../services/firebase";
import {
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import "./Attendance.css";

export default function Attendance() {
  const [selectedDay, setSelectedDay] = useState(1);

  // search/mark
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // lists
  const [markedList, setMarkedList] = useState([]);   // only those marked for the day
  const [markedLoading, setMarkedLoading] = useState(false);

  const [allUsers, setAllUsers] = useState([]);       // every user with status
  const [allLoading, setAllLoading] = useState(false);

  const dayOptions = Array.from({ length: 21 }, (_, i) => i + 1);

  const formatDT = (d) => (d ? new Date(d).toLocaleString() : "—");

  // ---------- Marked so far ----------
  const loadMarkedForDay = async (dayNum) => {
    setMarkedLoading(true);
    try {
      // Fast path (needs a collection-group index on attendance.day)
      const cg = query(
        collectionGroup(db, "attendance"),
        where("day", "==", Number(dayNum))
      );
      const snap = await getDocs(cg);
      const items = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        items.push({
          id: d.id,
          name: data.name || "No Name",
          email: data.email || "",
          present: !!data.present,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
          date: data.date?.toDate ? data.date.toDate() : null,
        });
      });
      setMarkedList(items);
    } catch (e) {
      // Fallback: no CG index → scan each user’s subcollection
      const usersSnap = await getDocs(collection(db, "users"));
      const rows = [];
      for (const udoc of usersSnap.docs) {
        const u = udoc.data() || {};
        const qs = await getDocs(
          query(collection(db, "users", udoc.id, "attendance"), where("day", "==", Number(dayNum)))
        );
        qs.forEach((attDoc) => {
          const ad = attDoc.data() || {};
          rows.push({
            id: attDoc.id,
            name: ad.name || u.username || u.name || "No Name",
            email: ad.email || u.email || "",
            present: !!ad.present,
            updatedAt: ad.updatedAt?.toDate ? ad.updatedAt.toDate() : null,
            date: ad.date?.toDate ? ad.date.toDate() : null,
          });
        });
      }
      setMarkedList(rows);
    } finally {
      setMarkedLoading(false);
    }
  };

  // ---------- Every user — status (handles random old IDs) ----------
  const loadAllUsersWithStatus = async (dayNum) => {
    setAllLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const rows = await Promise.all(
        usersSnap.docs.map(async (udoc) => {
          const u = udoc.data() || {};
          // 1) deterministic doc
          const fixedRef = doc(db, "users", udoc.id, "attendance", `day-${dayNum}`);
          const fixedSnap = await getDoc(fixedRef);

          let present = false;
          let markedAt = null;

          if (fixedSnap.exists()) {
            const ad = fixedSnap.data() || {};
            present = !!ad.present;
            markedAt = ad.updatedAt?.toDate ? ad.updatedAt.toDate() : null;
          } else {
            // 2) any random doc with same day (old data)
            const qSnap = await getDocs(
              query(collection(db, "users", udoc.id, "attendance"), where("day", "==", Number(dayNum)))
            );
            if (!qSnap.empty) {
              // pick latest by updatedAt
              let bestDoc = qSnap.docs[0].data() || {};
              qSnap.forEach((d) => {
                const v = d.data() || {};
                const vt = v.updatedAt?.toDate ? v.updatedAt.toDate().getTime() : 0;
                const bt = bestDoc.updatedAt?.toDate ? bestDoc.updatedAt.toDate().getTime() : 0;
                if (vt > bt) bestDoc = v;
              });
              present = !!bestDoc.present;
              markedAt = bestDoc.updatedAt?.toDate ? bestDoc.updatedAt.toDate() : null;
            }
          }

          return {
            id: udoc.id,
            name: u.username || u.name || "No Name",
            email: u.email || "",
            present,
            markedAt,
            status: present ? "Present" : "Not Marked",
          };
        })
      );

      rows.sort((a, b) => {
        if (a.present !== b.present) return a.present ? -1 : 1;
        return (a.name || "").localeCompare(b.name || "");
      });

      setAllUsers(rows);
    } catch (e) {
      console.error("loadAllUsersWithStatus error", e);
    } finally {
      setAllLoading(false);
    }
  };

  useEffect(() => {
    loadMarkedForDay(selectedDay);
    loadAllUsersWithStatus(selectedDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  // ---------- search ----------
  const refreshExistingFlags = async (dayNum, items) => {
    const hydrated = await Promise.all(
      items.map(async (it) => {
        try {
          const attDocRef = doc(db, "users", it.docId, "attendance", `day-${dayNum}`);
          const attDoc = await getDoc(attDocRef);
          if (attDoc.exists()) {
            const adata = attDoc.data() || {};
            return {
              ...it,
              present: !!adata.present,
              existingAttendance: { id: attDoc.id, ...adata },
            };
          }
          // also consider old random IDs
          const qSnap = await getDocs(
            query(collection(db, "users", it.docId, "attendance"), where("day", "==", Number(dayNum)))
          );
          if (!qSnap.empty) {
            const adata = qSnap.docs[0].data() || {};
            return {
              ...it,
              present: !!adata.present,
              existingAttendance: { id: qSnap.docs[0].id, ...adata },
            };
          }
          return { ...it, existingAttendance: null };
        } catch {
          return { ...it, existingAttendance: null };
        }
      })
    );
    setResults(hydrated);
  };

  const handleSearch = async () => {
    setMessage("");
    setResults([]);
    const term = (queryText || "").trim().toLowerCase();
    if (!term) {
      setMessage("Enter name or email to search.");
      return;
    }

    setLoading(true);
    try {
      // client-side filter to avoid extra indexes
      const all = await getDocs(collection(db, "users"));
      const filtered = all.docs.filter((d) => {
        const data = d.data() || {};
        const name = (data.username || data.name || "").toLowerCase();
        const email = (data.email || "").toLowerCase();
        return email === term || name.startsWith(term);
      });

      const items = filtered.map((d) => {
        const data = d.data() || {};
        return {
          uid: data.uid ?? d.id,
          docId: d.id,
          name: data.username ?? data.name ?? "No Name",
          email: data.email ?? "",
          present: false,
          existingAttendance: null,
        };
      });

      await refreshExistingFlags(selectedDay, items);
      if (items.length === 0) setMessage("No users found.");
    } catch (err) {
      console.error("search error", err);
      setMessage("Search failed — check console.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- mark/save ----------
  const togglePresent = (index) => {
    setResults((prev) => {
      const cp = [...prev];
      cp[index] = { ...cp[index], present: !cp[index].present };
      return cp;
    });
  };

  const saveSingle = async (item) => {
    setSaving(true);
    setMessage("");
    try {
      // Upsert to deterministic document (avoids duplicates)
      const attDocRef = doc(db, "users", item.docId, "attendance", `day-${selectedDay}`);
      const payload = {
        day: Number(selectedDay),
        date: new Date(),
        present: !!item.present,
        updatedAt: serverTimestamp(),
        userDocId: item.docId,
        name: item.name || "",
        email: item.email || "",
      };
      await setDoc(attDocRef, payload, { merge: true });

      setMessage(`Saved attendance for ${item.name}`);
      setResults((prev) =>
        prev.map((r) =>
          r.docId === item.docId ? { ...r, existingAttendance: payload } : r
        )
      );

      await Promise.all([
        loadMarkedForDay(selectedDay),
        loadAllUsersWithStatus(selectedDay),
      ]);
    } catch (err) {
      console.error("saveSingle error", err);
      setMessage("Save failed — check console.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const clearSearch = () => {
    setQueryText("");
    setResults([]);
    setMessage("");
  };

  // ---------- UI ----------
  return (
    <div className="att-wrap">
      <h2>Attendance — mark present (admin)</h2>

      <div className="att-controls">
        <div className="att-day">
          <label>Day</label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
          >
            {dayOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="att-search">
          <label>Search by email or name</label>
          <input
            type="text"
            placeholder="Enter email/name"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
          <div className="att-buttons">
            <button onClick={handleSearch} disabled={loading}>
              {loading ? "Searching…" : "Search"}
            </button>
            <button onClick={clearSearch}>Clear</button>
          </div>
        </div>
      </div>

      {message ? <div className="att-msg">{message}</div> : null}

      {/* Search Results / Marking */}
      <div className="att-results">
        {results.length === 0 ? (
          <div className="att-empty">No search results</div>
        ) : (
          results.map((r, idx) => (
            <div className="att-row" key={r.docId}>
              <div className="att-user">
                <div className="att-name"><strong>{r.name}</strong></div>
                <div className="att-email">{r.email || "—"}</div>
                <div className="att-uid">uid: {r.uid}</div>
              </div>

              <div className="att-controls-mini">
                <label className="att-present">
                  <input
                    type="checkbox"
                    checked={!!r.present}
                    onChange={() => togglePresent(idx)}
                  />
                  Present
                </label>

                <div className="att-existing">
                  {r.existingAttendance ? (
                    <span className="exists-yes">Already marked</span>
                  ) : (
                    <span className="exists-no">Not marked</span>
                  )}
                </div>

                <button
                  className="att-save-one"
                  onClick={() => saveSingle(r)}
                  disabled={saving}
                >
                  Save
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="att-sep" />

      {/* Marked so far */}
      <section className="att-list">
        <div className="att-list-head">
          <h3>Marked so far — Day {selectedDay}</h3>
          {markedLoading ? <span className="att-list-spin">Loading…</span> : null}
        </div>
        {markedList.length === 0 ? (
          <div className="att-empty">No attendance marked for this day yet.</div>
        ) : (
          <div className="att-table-wrap">
            <table className="att-table">
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Email</th><th>Present</th><th>Marked At</th>
                </tr>
              </thead>
              <tbody>
                {markedList.map((row, i) => (
                  <tr key={row.id + String(i)}>
                    <td>{i + 1}</td>
                    <td>{row.name || "—"}</td>
                    <td className="muted">{row.email || "—"}</td>
                    <td>{row.present ? "Yes" : "No"}</td>
                    <td className="muted">{formatDT(row.updatedAt || row.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="att-sep" />

      {/* Every user — status */}
      <section className="att-list">
        <div className="att-list-head">
          <h3>Every user — Day {selectedDay} status</h3>
          {allLoading ? <span className="att-list-spin">Loading…</span> : null}
        </div>

        {allUsers.length === 0 ? (
          <div className="att-empty">No users found.</div>
        ) : (
          <div className="att-table-wrap">
            <table className="att-table">
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Email</th><th>Status</th><th>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u, i) => (
                  <tr key={u.id}>
                    <td>{i + 1}</td>
                    <td>{u.name}</td>
                    <td className="muted">{u.email || "—"}</td>
                    <td>{u.status}</td>
                    <td className="muted">{formatDT(u.markedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
