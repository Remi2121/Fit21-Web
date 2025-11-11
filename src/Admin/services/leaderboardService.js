// src/Admin/services/leaderboardService.js
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "leaderboard";

export async function fetchLeaderboard() {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// player = { id?, name, daysCompleted, points, rank? }
export async function savePlayer(player) {
  const { id, ...data } = player;

  if (id) {
    await updateDoc(doc(db, COLLECTION, id), data);
    return id;
  } else {
    const ref = await addDoc(collection(db, COLLECTION), data);
    return ref.id;
  }
}

export async function deletePlayer(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
