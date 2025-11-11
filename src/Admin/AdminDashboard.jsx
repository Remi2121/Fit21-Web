// src/Admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { testFirebase } from "./services/testFirebase";
import "./AdminDashboard.css";

import CommitteeSection from "./components/CommitteeSection.jsx";
import QuizSection from "./components/QuizSection.jsx";
import AnnouncementSection from "./components/AnnouncementSection.jsx";
import LeaderboardSection from "./components/LeaderboardSection.jsx";
import Card from "./components/Card.jsx";



export default function AdminDashboard() {
  // ===== STATE =====

useEffect(() => {
    // page load aana udane oru dhadava test pannum
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
  }, []); // empty dependency -> once on mount
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

  // Quiz data
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

  // Announcements data
  const [announcements, setAnnouncements] = useState([
    {
      id: 1,
      day: 1,
      title: "Day 1 Start",
      message: "Fit21 starts at 6.30 PM today.",
    },
    {
      id: 2,
      day: 2,
      title: "Warm Up",
      message: "Please arrive 15 mins early for warm up.",
    },
  ]);

  const emptyAnnouncement = { day: "", title: "", message: "" };

  const [newAnnouncement, setNewAnnouncement] =
    useState(emptyAnnouncement);
  const [editingAnnouncementId, setEditingAnnouncementId] =
    useState(null);

  // Leaderboard data – start with no rank (auto rank only when day 21)
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

  // ===== QUIZ HANDLERS =====

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
      setQuizList([...quizList, newItem]);
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

  // ===== ANNOUNCEMENT HANDLERS =====

  const resetAnnouncementForm = () => {
    setNewAnnouncement(emptyAnnouncement);
    setEditingAnnouncementId(null);
  };

  const handleAnnouncementSubmit = (e) => {
    e.preventDefault();
    if (!newAnnouncement.day || !newAnnouncement.title) return;

    if (editingAnnouncementId) {
      // update
      setAnnouncements(
        announcements.map((a) =>
          a.id === editingAnnouncementId
            ? {
                ...a,
                day: Number(newAnnouncement.day),
                title: newAnnouncement.title,
                message: newAnnouncement.message,
              }
            : a
        )
      );
    } else {
      // create
      const item = {
        id: Date.now(),
        day: Number(newAnnouncement.day),
        title: newAnnouncement.title,
        message: newAnnouncement.message,
      };
      setAnnouncements([...announcements, item]);
    }

    resetAnnouncementForm();
  };

  const handleEditAnnouncement = (a) => {
    setActiveTab("announcements");
    setEditingAnnouncementId(a.id);
    setNewAnnouncement({
      day: String(a.day),
      title: a.title,
      message: a.message,
    });
  };

  const handleDeleteAnnouncement = (id) => {
    setAnnouncements(announcements.filter((a) => a.id !== id));
    if (editingAnnouncementId === id) {
      resetAnnouncementForm();
    }
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
          onClick={() => setActiveTab("leaderboard")}
          className={`admin-nav-button ${
            activeTab === "leaderboard" ? "active" : ""
          }`}
        >
          Points &amp; Leaderboard
        </button>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        {activeTab === "dashboard" && (
          <DashboardOverview
            committee={committee}
            quizList={quizList}
            announcements={announcements}
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

        {activeTab === "announcements" && (
          <AnnouncementSection
            announcements={announcements}
            newAnnouncement={newAnnouncement}
            setNewAnnouncement={setNewAnnouncement}
            onSubmit={handleAnnouncementSubmit}
            onEdit={handleEditAnnouncement}
            onDelete={handleDeleteAnnouncement}
            isEditing={Boolean(editingAnnouncementId)}
          />
        )}

        {activeTab === "leaderboard" && (
          <LeaderboardSection
            leaderboard={leaderboard}
            setLeaderboard={setLeaderboard}
            currentDay={currentDay}
            setCurrentDay={setCurrentDay}
          />
        )}
      </main>
    </div>
  );
}

/* ========== DASHBOARD OVERVIEW ========== */

function DashboardOverview({ committee, quizList, announcements, leaderboard }) {
  return (
    <div>
      <h1 className="page-title">Dashboard Overview</h1>
      <div className="stat-grid">
        <StatCard
          label="Organizing Members"
          value={committee.length}
          note="President, Secretary, Treasurer"
        />
        <StatCard
          label="Quizzes Created"
          value={quizList.length}
          note="21 days challenge"
        />
        <StatCard
          label="Announcements"
          value={announcements.length}
          note="Daily messages"
        />
        <StatCard
          label="Users on Leaderboard"
          value={leaderboard.length}
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
