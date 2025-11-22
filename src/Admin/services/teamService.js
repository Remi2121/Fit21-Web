// src/Admin/services/teamService.js
// Team-related Firestore helpers for Admin panel
// Usage: import { createTeam, listTeams, listMembers, addMemberToTeam, removeMemberFromTeam, findUserByEmail } from './services/teamService';

import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";

/**
 * createTeam({ teamId (optional), teamName, description })
 * - if teamId provided -> sets (merge) document at teams/{teamId}
 * - otherwise -> creates new doc with addDoc
 * returns { id }
 */
export async function createTeam({ teamId, teamName, description }) {
  if (!teamName) throw new Error("teamName required");
  if (teamId) {
    const ref = doc(db, "teams", teamId);
    await setDoc(ref, { teamName, description: description || "" }, { merge: true });
    return { id: teamId };
  } else {
    const ref = await addDoc(collection(db, "teams"), { teamName, description: description || "" });
    return { id: ref.id };
  }
}

/**
 * addMemberToTeam(teamId, { userId, username, email })
 * - writes to teams/{teamId}/members/{userId}
 * - recommended: userId = uid from /users collection (keeps consistency)
 */
export async function addMemberToTeam(teamId, { userId, username, email }) {
  if (!teamId || !userId) throw new Error("teamId and userId required");
  const memberRef = doc(db, "teams", teamId, "members", userId);
  const payload = {
    username: username || null,
    email: email || null,
    addedAt: new Date(),
  };
  await setDoc(memberRef, payload, { merge: true });
  return { id: userId };
}

/**
 * removeMemberFromTeam(teamId, userId)
 */
export async function removeMemberFromTeam(teamId, userId) {
  if (!teamId || !userId) throw new Error("teamId and userId required");
  const memberRef = doc(db, "teams", teamId, "members", userId);
  await deleteDoc(memberRef);
  return true;
}

/**
 * listTeams() => array of { id, teamName, description }
 */
export async function listTeams() {
  const snaps = await getDocs(collection(db, "teams"));
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * getTeam(teamId) => { id, ...data } or null
 */
export async function getTeam(teamId) {
  if (!teamId) return null;
  const ref = doc(db, "teams", teamId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * listMembers(teamId) => array of { id, username, email, addedAt }
 */
export async function listMembers(teamId) {
  if (!teamId) return [];
  const snaps = await getDocs(collection(db, "teams", teamId, "members"));
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * findUserByEmail(email) => { id, ...data } or null
 * - helpful if you want to validate that user exists in /users
 */
export async function findUserByEmail(email) {
  if (!email) return null;
  const q = query(collection(db, "users"), where("email", "==", email));
  const snaps = await getDocs(q);
  if (snaps.empty) return null;
  const doc0 = snaps.docs[0];
  return { id: doc0.id, ...doc0.data() };
}

/**
 * deleteTeam(teamId)
 * - deletes the team document (does NOT delete subcollection members)
 * - if you want to remove members first, call listMembers + delete each
 */
export async function deleteTeam(teamId) {
  if (!teamId) throw new Error("teamId required");
  await deleteDoc(doc(db, "teams", teamId));
  return true;
}
