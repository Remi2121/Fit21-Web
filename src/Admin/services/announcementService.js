// src/Admin/services/announcementService.js

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";

const ANNOUNCEMENT_COLLECTION = "announcements";

function getCollectionRef() {
  return collection(db, ANNOUNCEMENT_COLLECTION);
}

// 🔹 Get all announcements (sorted by day)
export async function fetchAnnouncements() {
  const q = query(getCollectionRef(), orderBy("day", "asc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

// 🔹 Add new announcement
export async function addAnnouncement(data) {
  const payload = {
    day: Number(data.day) || 0,
    title: data.title || "",
    message: data.message || "",
    body: data.message || "",
    mediaUrl: data.mediaUrl || "",
    mediaType: data.mediaType || "",
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(getCollectionRef(), payload);
  return docRef.id;
}

// 🔹 Update announcement
export async function updateAnnouncement(id, data) {
  const ref = doc(db, ANNOUNCEMENT_COLLECTION, id);

  const payload = {
    day: Number(data.day) || 0,
    title: data.title || "",
    message: data.message || "",
    body: data.message || "",
    mediaUrl: data.mediaUrl || "",
    mediaType: data.mediaType || "",
  };

  await updateDoc(ref, payload);
}

// 🔹 Delete announcement
export async function deleteAnnouncement(id) {
  const ref = doc(db, ANNOUNCEMENT_COLLECTION, id);
  await deleteDoc(ref);
}
