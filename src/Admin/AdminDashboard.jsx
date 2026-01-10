// src/Admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { testFirebase } from "./services/testFirebase";
import "./AdminDashboard.css";

import CommitteeSection from "./components/CommitteeSection.jsx";
import QuizSection from "./components/QuizSection.jsx";
import AnnouncementSection from "./components/AnnouncementSection.jsx";
import LeaderboardSection from "./components/LeaderboardSection.jsx";
import TeamSection from "./components/TeamSection.jsx";
import Rules from "./components/Rules/Rules.jsx";
import Attendance from "./components/Attendance/Attendance.jsx";
import AchievementSection from "./components/Achievement/Achievement.jsx";

// 🔥 Firestore imports for dashboard counts
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

// small helper – count docs in a collection
async function getCollectionCount(colName) {
  const snap = await getDocs(collection(db, colName));
  return snap.size;
}

export default function AdminDashboard() {
  // ===== FIREBASE TEST (OPTIONAL) =====
  useEffect(() => {
    async function runTest() {
      try {
        const count = await testFirebase();
        console.log(
          `✅ Firebase OK! debug_tests collection-la total docs: ${count}`
        );
      } catch (err) {
        console.error("❌ Firebase test FAILED:", err);
      }
    }
    runTest();
  }, []);

  // ===== STATE =====

  // Organizing committee – used inside CommitteeSection UI
  const [committee, setCommittee] = useState([
    {
      id: 1,
      role: "President",
      name: "John Doe",
      phone: "0771234567",
      email: "president@fit21.com",
      photoUrl: "https://via.placeholder.com/80",
    },
    {
      id: 2,
      role: "Secretary",
      name: "Jane Smith",
      phone: "0772345678",
      email: "secretary@fit21.com",
      photoUrl: "https://via.placeholder.com/80",
    },
    {
      id: 3,
      role: "Treasurer",
      name: "Alex Silva",
      phone: "0773456789",
      email: "treasurer@fit21.com",
      photoUrl: "https://via.placeholder.com/80",
    },
  ]);
  const [selectedMember, setSelectedMember] = useState(null);

  // Quiz state – used by QuizSection UI (Firestore sync happens there)
  const [quizList, setQuizList] = useState([
    {
      id: 1,
      day: 1,
      question: "Push-up count?",
      options: { A: "", B: "", C: "", D: "" },
      correct: "A",
      published: false,
      expiresAt: null,
    },
    {
      id: 2,
      day: 2,
      question: "Memory words?",
      options: { A: "", B: "", C: "", D: "" },
      correct: "A",
      published: false,
      expiresAt: null,
    },
  ]);

  const emptyQuiz = {
    day: "",
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correct: "A",
  };

  const [newQuiz, setNewQuiz] = useState(emptyQuiz);
  const [editingQuizId, setEditingQuizId] = useState(null); // null = create mode

  // Leaderboard data – only for UI (real points in Firestore)
  const [leaderboard, setLeaderboard] = useState([
    { id: 1, rank: null, name: "User A", daysCompleted: 15, points: 150 },
    { id: 2, rank: null, name: "User B", daysCompleted: 12, points: 120 },
    { id: 3, rank: null, name: "User C", daysCompleted: 10, points: 100 },
  ]);

  // challenge current day (0–21) – admin updates this
  const [currentDay, setCurrentDay] = useState(0);

  const [activeTab, setActiveTab] = useState("dashboard");

  // Timer – every 1 second re-render for quiz countdown
  const [timerTick, setTimerTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTimerTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ===== QUIZ HANDLERS (local for QuizSection) =====

  const resetQuizForm = () => {
    setNewQuiz(emptyQuiz);
    setEditingQuizId(null);
  };

  const handleQuizSubmit = (e) => {
    e.preventDefault();
    if (!newQuiz.day || !newQuiz.question) return;

    if (editingQuizId) {
      // update existing quiz
      setQuizList(
        quizList.map((q) =>
          q.id === editingQuizId
            ? {
                ...q,
                day: Number(newQuiz.day),
                question: newQuiz.question,
                options: {
                  A: newQuiz.optionA,
                  B: newQuiz.optionB,
                  C: newQuiz.optionC,
                  D: newQuiz.optionD,
                },
                correct: newQuiz.correct,
              }
            : q
        )
      );
    } else {
      // create new quiz
      const newItem = {
        id: Date.now(),
        day: Number(newQuiz.day),
        question: newQuiz.question,
        options: {
          A: newQuiz.optionA,
          B: newQuiz.optionB,
          C: newQuiz.optionC,
          D: newQuiz.optionD,
        },
        correct: newQuiz.correct,
        published: false,
        expiresAt: null,
      };
      setQuizList((prev) => [...prev, newItem]);
    }

    resetQuizForm();
  };

  const handleEditQuiz = (quiz) => {
    setActiveTab("quiz");
    setEditingQuizId(quiz.id);
    setNewQuiz({
      day: String(quiz.day),
      question: quiz.question,
      optionA: quiz.options?.A || "",
      optionB: quiz.options?.B || "",
      optionC: quiz.options?.C || "",
      optionD: quiz.options?.D || "",
      correct: quiz.correct || "A",
    });
  };

  const handleDeleteQuiz = (id) => {
    setQuizList(quizList.filter((q) => q.id !== id));
    if (editingQuizId === id) {
      resetQuizForm();
    }
  };

  // publish / unpublish with 60s timer
  const publishQuiz = (id) => {
    const now = Date.now();
    setQuizList(
      quizList.map((q) => {
        if (q.id !== id) return q;
        if (!q.published) {
          return {
            ...q,
            published: true,
            expiresAt: now + 60 * 1000,
          };
        }
        return { ...q, published: false, expiresAt: null };
      })
    );
  };

  // ===== RENDER =====

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <h2 className="admin-sidebar-title">FIT21 Admin</h2>
        <small className="admin-sidebar-note">
          Only President, Secretary &amp; Treasurer
        </small>

        <button
          onClick={() => setActiveTab("dashboard")}
          className={`admin-nav-button ${
            activeTab === "dashboard" ? "active" : ""
          }`}
        >
          Dashboard
        </button>

        <button
          onClick={() => setActiveTab("committee")}
          className={`admin-nav-button ${
            activeTab === "committee" ? "active" : ""
          }`}
        >
          Organizing Team
        </button>

        <button
          onClick={() => setActiveTab("quiz")}
          className={`admin-nav-button ${
            activeTab === "quiz" ? "active" : ""
          }`}
        >
          Quiz Management
        </button>

        <button
          onClick={() => setActiveTab("announcements")}
          className={`admin-nav-button ${
            activeTab === "announcements" ? "active" : ""
          }`}
        >
          21 Days Announcements
        </button>

        <button
          onClick={() => setActiveTab("attendance")}
          className={`admin-nav-button ${
            activeTab === "attendance" ? "active" : ""
          }`}
        >
          Attendance
        </button>

        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`admin-nav-button ${
            activeTab === "leaderboard" ? "active" : ""
          }`}
        >
          Points &amp; Leaderboard
        </button>

        <button
          onClick={() => setActiveTab("teams")}
          className={`admin-nav-button ${
            activeTab === "teams" ? "active" : ""
          }`}
        >
          Teams
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`admin-nav-button ${
            activeTab === "rules" ? "active" : ""
          }`}
        >
          Rules
        </button>

        <button
          onClick={() => setActiveTab("achievements")}
          className={`admin-nav-button ${
            activeTab === "achievements" ? "active" : ""
          }`}
        >
          Achievements
        </button>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        {activeTab === "dashboard" && (
          <DashboardOverview
            committee={committee}
            quizList={quizList}
            leaderboard={leaderboard}
          />
        )}

        {activeTab === "committee" && (
          <CommitteeSection
            committee={committee}
            selectedMember={selectedMember}
            setSelectedMember={setSelectedMember}
            setCommittee={setCommittee}
          />
        )}

        {activeTab === "quiz" && (
          <QuizSection
            quizList={quizList}
            newQuiz={newQuiz}
            setNewQuiz={setNewQuiz}
            onSubmit={handleQuizSubmit}
            publishQuiz={publishQuiz}
            timerTick={timerTick}
            onEditQuiz={handleEditQuiz}
            onDeleteQuiz={handleDeleteQuiz}
            isEditing={Boolean(editingQuizId)}
          />
        )}

        {/* Announcements use Firestore internally */}
        {activeTab === "announcements" && <AnnouncementSection />}

        {activeTab === "leaderboard" && (
          <LeaderboardSection
            leaderboard={leaderboard}
            setLeaderboard={setLeaderboard}
            currentDay={currentDay}
            setCurrentDay={setCurrentDay}
          />
        )}

        {activeTab === "teams" && <TeamSection />}

        {activeTab === "rules" && <Rules />}

        {activeTab === "attendance" && <Attendance />}

        {activeTab === "achievements" && <AchievementSection />}
      </main>
    </div>
  );
}

/* ========== DASHBOARD OVERVIEW (ALL 4 CARDS FROM FIRESTORE) ========== */

function DashboardOverview({ committee, quizList, leaderboard }) {
  const [counts, setCounts] = useState({
    members: 0,
    quizzes: 0,
    announcements: 0,
    users: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCounts() {
      try {
        setLoading(true);

        // 👇 map each dashboard box → Firestore collection
        const [members, quizzes, announcements, users] = await Promise.all([
          getCollectionCount("committeeMembers"),        // Organizing Members
          getCollectionCount("quizQuestions"), // Quizzes Created
          getCollectionCount("announcements"), // Announcements
          getCollectionCount("users"),         // Users on Leaderboard
        ]);

        setCounts({ members, quizzes, announcements, users });
      } catch (err) {
        console.error("Error loading dashboard counts:", err);
        setCounts({ members: 0, quizzes: 0, announcements: 0, users: 0 });
      } finally {
        setLoading(false);
      }
    }

    loadCounts();
  }, []);

  return (
    <div>
      <h1 className="page-title">Dashboard Overview</h1>
      <div className="stat-grid">
        <StatCard
          label="Organizing Members"
          value={loading ? "…" : counts.members}
          note="President, Secretary, Treasurer"
        />
        <StatCard
          label="Quizzes Created"
          value={loading ? "…" : counts.quizzes}
          note="21 days challenge"
        />
        <StatCard
          label="Announcements"
          value={loading ? "…" : counts.announcements}
          note="Daily messages"
        />
        <StatCard
          label="Users on Leaderboard"
          value={loading ? "…" : counts.users}
          note="Top participants"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, note }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}
