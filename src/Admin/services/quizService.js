// src/Admin/services/quizService.js
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "quizzes";

// 🔹 Get all quizzes
export async function fetchQuizzes() {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// quiz = { id?, day, question, options, correct, published?, expiresAt? }
export async function saveQuiz(quiz) {
  const { id, ...data } = quiz;

  if (id) {
    await updateDoc(doc(db, COLLECTION, id), data);
    return id;
  } else {
    const ref = await addDoc(collection(db, COLLECTION), {
      published: false,
      expiresAt: null,
      ...data,
    });
    return ref.id;
  }
}

export async function deleteQuiz(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

// 🔹 Publish / unpublish (timer-oda state store panna use aagum)
export async function setQuizPublishState(id, published, expiresAt = null) {
  await updateDoc(doc(db, COLLECTION, id), { published, expiresAt });
}
