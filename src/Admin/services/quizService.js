// src/Admin/services/quizService.js

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

const QUIZ_COLLECTION = "quizQuestions";
const DEFAULT_TIME_LIMIT_MINUTES = 10; // 👈 ippo fix pannalaam

function getCollectionRef() {
  return collection(db, QUIZ_COLLECTION);
}

// 🔹 get all quizzes (admin list)
export async function getAllQuizzes() {
  const snap = await getDocs(getCollectionRef());
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

export async function addQuiz(quiz) {
  const docRef = await addDoc(getCollectionRef(), {
    ...quiz,
    published: false,
    timeLimitMinutes: DEFAULT_TIME_LIMIT_MINUTES, // 👈 IMPORTANT
    createdAt: new Date(),
  });
  return docRef.id;
}


// 🔹 update quiz (edit / single publish)
export async function updateQuiz(id, quiz) {
  const ref = doc(db, QUIZ_COLLECTION, id);
  await updateDoc(ref, quiz);
}

// 🔹 delete quiz
export async function deleteQuiz(id) {
  const ref = doc(db, QUIZ_COLLECTION, id);
  await deleteDoc(ref);
}

// 🔹 publish ALL quizzes for one day
export async function publishAllForDay(day) {
  const q = query(getCollectionRef(), where("day", "==", day));
  const snap = await getDocs(q);

  const batch = writeBatch(db);
  snap.forEach((d) => batch.update(d.ref, { published: true }));
  await batch.commit();
}

// 🔹 delete ALL quizzes for one day
export async function deleteAllForDay(day) {
  const q = query(getCollectionRef(), where("day", "==", day));
  const snap = await getDocs(q);

  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
