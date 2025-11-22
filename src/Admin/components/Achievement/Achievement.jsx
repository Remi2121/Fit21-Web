/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Achievement.css";

import { db, storage } from "../../../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

const emptyForm = {
  title: "",
  description: "",
  order: "",
};

export default function Achievement() {
  const [items, setItems] = useState([]); // [{id,title,description,mediaType,mediaURL,storagePath,order,createdAt}]
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");
  const [uploadPct, setUploadPct] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState("");
  const fileInputRef = useRef(null);

  // live fetch
  useEffect(() => {
    const q = query(collection(db, "achievements"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(rows);
    });
    return () => unsub();
  }, []);

  // file preview
  useEffect(() => {
    if (!file) {
      setPreviewURL("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewURL(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const mediaType = useMemo(() => {
    if (file) return file.type.startsWith("video") ? "video" : "image";
    return null;
  }, [file]);

  const resetForm = () => {
    setForm(emptyForm);
    setFile(null);
    setPreviewURL("");
    setUploadPct(0);
    setEditingId(null);
    fileInputRef.current && (fileInputRef.current.value = "");
  };

  const pickForEdit = (row) => {
    setEditingId(row.id);
    setForm({
      title: row.title || "",
      description: row.description || "",
      order: String(row.order ?? ""),
    });
    setFile(null);
    setPreviewURL(row.mediaURL || "");
    setUploadPct(0);
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeRow = async (row) => {
    if (!window.confirm("Delete this achievement?")) return;
    try {
      await deleteDoc(doc(db, "achievements", row.id));
      if (row.storagePath) {
        await deleteObject(ref(storage, row.storagePath)).catch(() => {});
      }
      setMsg("Deleted.");
    } catch (e) {
      console.error(e);
      setMsg(e.message || "Delete failed");
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!form.title.trim()) {
      setMsg("Title is required.");
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      order: Number(form.order || 0),
      updatedAt: serverTimestamp(),
    };

    try {
      // If new file chosen, upload first
      let newMedia = null;
      if (file) {
        const ext =
          file.name.split(".").pop() || (mediaType === "video" ? "mp4" : "jpg");
        const base = editingId || String(Date.now());
        const storagePath = `achievements/${base}_${Date.now()}.${ext}`;
        const storageRef = ref(storage, storagePath);
        const task = uploadBytesResumable(storageRef, file);

        await new Promise((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round(
                (snap.bytesTransferred / snap.totalBytes) * 100
              );
              setUploadPct(pct);
            },
            reject,
            resolve
          );
        });

        const mediaURL = await getDownloadURL(storageRef);
        newMedia = { storagePath, mediaURL, mediaType };
      }

      if (editingId) {
        const docRef = doc(db, "achievements", editingId);

        // If replacing the file, delete old one (if exists)
        if (newMedia) {
          const prev = items.find((i) => i.id === editingId);
          if (prev?.storagePath) {
            deleteObject(ref(storage, prev.storagePath)).catch(() => {});
          }
          await updateDoc(docRef, { ...payload, ...newMedia });
        } else {
          await updateDoc(docRef, payload);
        }
        setMsg("Updated successfully.");
      } else {
        const docData = {
          ...payload,
          createdAt: serverTimestamp(),
          ...(newMedia || { mediaURL: "", mediaType: "", storagePath: "" }),
        };
        await addDoc(collection(db, "achievements"), docData);
        setMsg("Created successfully.");
      }

      resetForm();
    } catch (e) {
      console.error(e);
      setMsg(e.message || "Save failed.");
    }
  };

  return (
    <div className="ach-wrap">
      <h1 className="ach-title">Achievements</h1>

      <form className="ach-form" onSubmit={onSubmit}>
        <label className="ach-label">
          Title
          <input
            className="ach-input"
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="Ex: Day 7 – Perfect Pushups"
          />
        </label>

        <label className="ach-label ach-wide">
          Description
          <textarea
            className="ach-input ach-textarea"
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            placeholder="Short note about this achievement"
          />
        </label>

        <label className="ach-label">
          Order
          <input
            className="ach-input"
            type="number"
            value={form.order}
            onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
            placeholder="0"
          />
        </label>

        <label className="ach-label ach-file">
          Media (Image or Video)
          <input
            ref={fileInputRef}
            className="ach-input"
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <small className="ach-hint">
            PNG/JPG or MP4/MOV — new upload replaces existing media when
            editing.
          </small>
        </label>

        {previewURL && (
          <div className="ach-preview">
            {mediaType === "video" || previewURL?.includes(".mp4") ? (
              <video src={previewURL} controls className="ach-preview-media" />
            ) : (
              <img src={previewURL} alt="preview" className="ach-preview-media" />
            )}
          </div>
        )}

        {uploadPct > 0 && uploadPct < 100 && (
          <div className="ach-progress">
            <div
              className="ach-progress-bar"
              style={{ width: `${uploadPct}%` }}
            />
            <span>{uploadPct}%</span>
          </div>
        )}

        <div className="ach-actions">
          <button className="ach-save" type="submit">
            {editingId ? "Update" : "Save"}
          </button>
          <button className="ach-default" type="button" onClick={resetForm}>
            Reset
          </button>
        </div>

        {msg && <div className="ach-msg">{msg}</div>}
      </form>

      <hr className="ach-sep" />

      <h2 className="ach-subtitle">Existing Achievements</h2>
      <div className="ach-grid">
        {items.map((row) => (
          <div key={row.id} className="ach-card">
            <div className="ach-thumb">
              {row.mediaType === "video" ? (
                <video src={row.mediaURL} className="ach-thumb-media" controls />
              ) : (
                <img
                  src={row.mediaURL}
                  className="ach-thumb-media"
                  alt={row.title}
                />
              )}
            </div>
            <div className="ach-info">
              <div className="ach-top">
                <div className="ach-badge">#{row.order ?? 0}</div>
                {/* visible pill removed */}
              </div>
              <h3 className="ach-card-title">{row.title}</h3>
              {row.description && (
                <p className="ach-card-desc">{row.description}</p>
              )}
              <div className="ach-card-actions">
                <button className="ach-edit" onClick={() => pickForEdit(row)}>
                  Edit
                </button>
                <button className="ach-del" onClick={() => removeRow(row)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {!items.length && <div className="ach-empty">No achievements yet.</div>}
      </div>
    </div>
  );
}
