// services/committee.services.js
import { db, storage } from "./firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const COMMITTEE_COLLECTION = "committeeMembers";

function getCollectionRef() {
  return collection(db, COMMITTEE_COLLECTION);
}

// Get all members
export async function getCommitteeMembers() {
  const snap = await getDocs(getCollectionRef());
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

// Internal helper to upload photo
async function uploadPhotoForMember(memberId, file) {
  const storageRef = ref(storage, `committeeMembers/${memberId}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
}

// Add new member (with optional photo)
export async function addCommitteeMember(member, photoFile) {
  // 1. create doc first (without photoUrl or empty)
  const docRef = await addDoc(getCollectionRef(), {
    name: member.name,
    role: member.role,
    phone: member.phone || "",
    email: member.email || "",
    photoUrl: "", // will update if photo uploaded
  });

  // 2. if photo selected → upload & update
  if (photoFile) {
    const url = await uploadPhotoForMember(docRef.id, photoFile);
    await updateDoc(docRef, { photoUrl: url });
  }

  return docRef.id;
}

// Update existing member (and optionally replace photo)
export async function updateCommitteeMember(id, member, photoFile) {
  const docRef = doc(db, COMMITTEE_COLLECTION, id);

  const payload = {
    name: member.name,
    role: member.role,
    phone: member.phone || "",
    email: member.email || "",
  };

  if (photoFile) {
    const url = await uploadPhotoForMember(id, photoFile);
    payload.photoUrl = url;
  }

  await updateDoc(docRef, payload);
}

// Delete member
export async function deleteCommitteeMember(id) {
  const docRef = doc(db, COMMITTEE_COLLECTION, id);
  await deleteDoc(docRef);
}
