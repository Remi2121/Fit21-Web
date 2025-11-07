// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  // ===== STATE =====
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

  // Leaderboard data
  // 👇 initial rank null – auto rank only when currentDay === 21
  const [leaderboard, setLeaderboard] = useState([
    { id: 1, rank: null, name: "User A", daysCompleted: 15, points: 150 },
    { id: 2, rank: null, name: "User B", daysCompleted: 12, points: 120 },
    { id: 3, rank: null, name: "User C", daysCompleted: 10, points: 100 },
  ]);

  // 👇 challenge-la ippo varaikkum evlo day mudinchu nu admin set panna
  const [currentDay, setCurrentDay] = useState(0); // 0–21

  const [activeTab, setActiveTab] = useState("dashboard");

  // Timer – every 1 second re-render for countdown
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

/* ========== REUSABLE COMPONENTS ========== */

function Card({ title, children }) {
  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      {children}
    </div>
  );
}

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

function CommitteeSection({
  committee,
  selectedMember,
  setSelectedMember,
  setCommittee,
}) {
  const [editData, setEditData] = useState(selectedMember || null);

  useEffect(() => {
    setEditData(selectedMember);
  }, [selectedMember]);

  const handleChange = (field, value) => {
    setEditData({ ...editData, [field]: value });
  };

  const handleSave = () => {
    if (!editData) return;
    setCommittee(
      committee.map((m) => (m.id === editData.id ? editData : m))
    );
    setSelectedMember(null);
  };

  return (
    <div>
      <h1 className="page-title">Organizing Team</h1>
      <Card title="Committee Members">
        <div className="committee-grid">
          {committee.map((member) => (
            <div
              key={member.id}
              className={`committee-card ${
                selectedMember && selectedMember.id === member.id
                  ? "selected"
                  : ""
              }`}
              onClick={() => setSelectedMember(member)}
            >
              <img
                src={member.photoUrl}
                alt={member.name}
                className="committee-avatar"
              />
              <div className="committee-name">{member.name}</div>
              <div className="committee-role">{member.role}</div>
              <div className="committee-line">📞 {member.phone}</div>
              <div className="committee-line">✉️ {member.email}</div>
            </div>
          ))}
        </div>
      </Card>

      {selectedMember && editData && (
        <Card title="Edit Member Details">
          <div className="edit-avatar-wrapper">
      <div className="edit-avatar-circle">
        {editData.photoUrl && (
          <img src={editData.photoUrl} alt={editData.name} />
        )}
         </div>
            <Input
              label="Name"
              value={editData.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
            <Input
              label="Role"
              value={editData.role}
              onChange={(e) => handleChange("role", e.target.value)}
            />
            <Input
              label="Phone"
              value={editData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
            <Input
              label="Email"
              value={editData.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
            <div className="input-wrapper">
              <label className="input-label">Upload Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      handleChange("photoUrl", reader.result);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="input-control file-input"
              />
             <div className="input-wrapper">
  
  
</div>

            </div>
          </div>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </Card>
      )}
    </div>
  );
}

function QuizSection({
  quizList,
  newQuiz,
  setNewQuiz,
  onSubmit,
  publishQuiz,
  timerTick, // just for rerender
  onEditQuiz,
  onDeleteQuiz,
  isEditing,
}) {
  return (
    <div>
      <h1 className="page-title">Quiz Management (21 Days)</h1>
      <Card title={isEditing ? "Edit Quiz" : "Create / Update Quiz"}>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <Input
              label="Day (1 - 21)"
              type="number"
              value={newQuiz.day}
              onChange={(e) =>
                setNewQuiz({ ...newQuiz, day: e.target.value })
              }
            />
            <Input
              label="Question"
              value={newQuiz.question}
              onChange={(e) =>
                setNewQuiz({ ...newQuiz, question: e.target.value })
              }
            />
            <Input
              label="Option A"
              value={newQuiz.optionA}
              onChange={(e) =>
                setNewQuiz({ ...newQuiz, optionA: e.target.value })
              }
            />
            <Input
              label="Option B"
              value={newQuiz.optionB}
              onChange={(e) =>
                setNewQuiz({ ...newQuiz, optionB: e.target.value })
              }
            />
            <Input
              label="Option C"
              value={newQuiz.optionC}
              onChange={(e) =>
                setNewQuiz({ ...newQuiz, optionC: e.target.value })
              }
            />
            <Input
              label="Option D"
              value={newQuiz.optionD}
              onChange={(e) =>
                setNewQuiz({ ...newQuiz, optionD: e.target.value })
              }
            />
            <div className="input-wrapper">
              <label className="input-label">Correct Answer</label>
              <select
                value={newQuiz.correct}
                onChange={(e) =>
                  setNewQuiz({ ...newQuiz, correct: e.target.value })
                }
                className="input-control"
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-success">
            {isEditing ? "Update Quiz" : "Save Quiz"}
          </button>
        </form>
      </Card>

      <Card title="Quiz List">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Question</th>
              <th>Published</th>
              <th>Time left</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {quizList.map((q) => {
              let remaining = null;
              if (q.published && q.expiresAt) {
                const diff = q.expiresAt - Date.now();
                remaining = diff > 0 ? Math.ceil(diff / 1000) : 0;
              }

              return (
                <tr key={q.id}>
                  <td>{q.day}</td>
                  <td>
                    <strong>Day {q.day} quiz:</strong> {q.question}
                  </td>
                  <td>{q.published ? "Yes" : "No"}</td>
                  <td>
                    {q.published && remaining !== null
                      ? `${remaining}s`
                      : "-"}
                  </td>
                  <td>
                    <button
                      onClick={() => publishQuiz(q.id)}
                      className={`btn btn-small ${
                        q.published ? "btn-warning" : "btn-success"
                      }`}
                    >
                      {q.published ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      onClick={() => onEditQuiz(q)}
                      className="btn btn-small btn-outline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteQuiz(q.id)}
                      className="btn btn-small btn-danger"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AnnouncementSection({
  announcements,
  newAnnouncement,
  setNewAnnouncement,
  onSubmit,
  onEdit,
  onDelete,
  isEditing,
}) {
  return (
    <div>
      <h1 className="page-title">21 Days Announcements</h1>

      <Card title={isEditing ? "Edit Announcement" : "Create Announcement"}>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <Input
              label="Day (1 - 21)"
              type="number"
              value={newAnnouncement.day}
              onChange={(e) =>
                setNewAnnouncement({
                  ...newAnnouncement,
                  day: e.target.value,
                })
              }
            />
            <Input
              label="Title"
              value={newAnnouncement.title}
              onChange={(e) =>
                setNewAnnouncement({
                  ...newAnnouncement,
                  title: e.target.value,
                })
              }
            />
          </div>
          <div className="input-wrapper mt-10">
            <label className="input-label">Message</label>
            <textarea
              value={newAnnouncement.message}
              onChange={(e) =>
                setNewAnnouncement({
                  ...newAnnouncement,
                  message: e.target.value,
                })
              }
              rows={3}
              className="input-control textarea"
            />
          </div>
          <button type="submit" className="btn btn-primary mt-10">
            {isEditing ? "Update Announcement" : "Save Announcement"}
          </button>
        </form>
      </Card>

      <Card title="Announcements List">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Title</th>
              <th>Message</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {announcements.map((a) => (
              <tr key={a.id}>
                <td>{a.day}</td>
                <td>{a.title}</td>
                <td>{a.message}</td>
                <td>
                  <button
                    onClick={() => onEdit(a)}
                    className="btn btn-small btn-outline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(a.id)}
                    className="btn btn-small btn-danger"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ===== LEADERBOARD ===== */

function LeaderboardSection({
  leaderboard,
  setLeaderboard,
  currentDay,
  setCurrentDay,
}) {
  const [editData, setEditData] = useState(null);

  // points-based rank + 17 days rule + only after day 21
  const recomputeRanks = (list, totalDays) => {
    // challenge innum mudiyala – rank assign pannadhe
    if (totalDays < 21) {
      return list.map((u) => ({ ...u, rank: null }));
    }

    const sorted = [...list].sort((a, b) => b.points - a.points);
    let runningRank = 1;

    return sorted.map((user) => {
      if (user.daysCompleted >= 17) {
        const rankedUser = { ...user, rank: runningRank };
        runningRank += 1;
        return rankedUser;
      } else {
        return { ...user, rank: null }; // disqualified – no rank
      }
    });
  };

  const handleCurrentDayChange = (value) => {
    const num = Number(value) || 0;
    const clamped = Math.max(0, Math.min(21, num)); // 0–21 range
    setCurrentDay(clamped);

    const ranked = recomputeRanks(leaderboard, clamped);
    setLeaderboard(ranked);
  };

  const startEdit = (user) => {
    setEditData({
      id: user.id,
      name: user.name,
      daysCompleted: String(user.daysCompleted),
      points: String(user.points),
    });
  };

  const handleChange = (field, value) => {
    setEditData({ ...editData, [field]: value });
  };

  const saveEdit = () => {
    if (!editData) return;

    const updated = leaderboard.map((u) =>
      u.id === editData.id
        ? {
            ...u,
            name: editData.name,
            daysCompleted: Number(editData.daysCompleted),
            points: Number(editData.points),
          }
        : u
    );

    const ranked = recomputeRanks(updated, currentDay);
    setLeaderboard(ranked);
    setEditData(null);
  };

  return (
    <div>
      <h1 className="page-title">Points &amp; Leaderboard</h1>
      <Card title="Users Progress (21 Days)">
        {/* top info: current challenge day */}
        <div className="leaderboard-top">
          <div className="leaderboard-current">
            Challenge Progress:&nbsp;
            <strong>
              Day {currentDay} / 21
            </strong>
          </div>

          <div className="form-inline">
            <label className="input-label">Current Day (0 - 21)</label>
            <input
              type="number"
              min="0"
              max="21"
              value={currentDay}
              onChange={(e) => handleCurrentDayChange(e.target.value)}
              className="input-control"
              style={{ width: "90px" }}
            />
          </div>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              <th>Days Completed</th>
              <th>Points</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((user) => (
              <tr key={user.id}>
                {/* currentDay < 21 or not enough days -> '-' */}
                <td>{user.rank != null ? user.rank : "-"}</td>
                <td>{user.name}</td>
                <td>
                  {user.daysCompleted} / {currentDay}
                </td>
                <td>{user.points}</td>
                <td>
                  <button
                    onClick={() => startEdit(user)}
                    className="btn btn-small btn-outline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {editData && (
          <div className="leaderboard-edit">
            <h4 className="leaderboard-edit-title">Edit User Points</h4>
            <div className="form-grid">
              <Input
                label="User Name"
                value={editData.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
              <Input
                label="Days Completed"
                type="number"
                value={editData.daysCompleted}
                onChange={(e) =>
                  handleChange("daysCompleted", e.target.value)
                }
              />
              <Input
                label="Points"
                type="number"
                value={editData.points}
                onChange={(e) => handleChange("points", e.target.value)}
              />
            </div>
            <button
              onClick={saveEdit}
              className="btn btn-primary mt-10 mr-8"
            >
              Save Changes
            </button>
            <button
              onClick={() => setEditData(null)}
              className="btn btn-outline mt-10"
            >
              Cancel
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

/* === generic input === */

function Input({ label, type = "text", ...props }) {
  return (
    <div className="input-wrapper">
      <label className="input-label">{label}</label>
      <input type={type} className="input-control" {...props} />
    </div>
  );
}
