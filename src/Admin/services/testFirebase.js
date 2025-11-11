// src/Admin/services/testFirebase.js
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Simple test:
 * 1. debug_tests collection-la oru dummy document add pannum
 * 2. adha collection-la total docs count return pannum
 */
export async function testFirebase() {
  // 1. write dummy document
  await addDoc(collection(db, "debug_tests"), {
    createdAt: serverTimestamp(),
    message: "Hello from Admin Dashboard",
  });

  // 2. read back all docs from that collection
  const snap = await getDocs(collection(db, "debug_tests"));
  return snap.docs.length; // total docs count
}
