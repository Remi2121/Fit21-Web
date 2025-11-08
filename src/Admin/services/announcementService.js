// src/Admin/services/announcementService.js
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "announcements";

export async function fetchAnnouncements() {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// announcement = { id?, day, title, message }
export async function saveAnnouncement(announcement) {
  const { id, ...data } = announcement;

  if (id) {
    await updateDoc(doc(db, COLLECTION, id), data);
    return id;
  } else {
    const ref = await addDoc(collection(db, COLLECTION), data);
    return ref.id;
  }
}

export async function deleteAnnouncement(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
