// src/Admin/components/QuizSection.jsx

import React, { useEffect, useState } from "react";
import {
  getAllQuizzes,
  addQuiz,
  updateQuiz,
  deleteQuiz,
  publishAllForDay,
  deleteAllForDay,
} from "../services/quizService";

// Firestore helpers
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";

export default function QuizSection() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ===== Create/Update Quiz form =====
  const [form, setForm] = useState({
    day: "",
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "A",
  });
  const [editingId, setEditingId] = useState(null);

  // ===== Per-day settings controller (top) =====
  const [daySettingsInput, setDaySettingsInput] = useState({
    day: 1,
    maxPoints: 20,
    timeLimitMinutes: 10,
  });

  // Cache of saved per-day settings
  const [daySettingsMap, setDaySettingsMap] = useState({});

  // Existing timer used in summary for published questions (you can keep/change)
  const TIME_PER_QUESTION_SEC = 90;

  // ---------- LOAD ALL QUIZZES ----------
  async function loadQuizzes() {
    try {
      setLoading(true);
      setError("");
      const data = await getAllQuizzes();

      data.sort((a, b) => {
        if (a.day === b.day) return 0;
        return a.day < b.day ? -1 : 1;
      });

      setQuizzes(data);
    } catch (err) {
      console.error("Error loading quizzes:", err);
      setError("Failed to load quizzes.");
    } finally {
      setLoading(false);
    }
  }

  // ---------- LOAD PER-DAY SETTINGS ----------
  async function loadDaySettings() {
    try {
      const snap = await getDocs(collection(db, "quizDaySettings"));
      const map = {};
      snap.forEach((d) => {
        const v = d.data();
        if (typeof v?.day === "number") {
          map[v.day] = {
            maxPoints: typeof v?.maxPoints === "number" ? v.maxPoints : 20,
            timeLimitMinutes:
              typeof v?.timeLimitMinutes === "number"
                ? v.timeLimitMinutes
                : 10,
          };
        }
      });
      setDaySettingsMap(map);
    } catch (err) {
      console.error("Error loading day settings:", err);
    }
  }

  useEffect(() => {
    loadQuizzes();
    loadDaySettings();
  }, []);

  // --- helpers ---

  // check if any quiz exists for EXACT day
  // eslint-disable-next-line no-unused-vars
  async function hasAnyForDay(dayNumber) {
    const qRef = query(
      collection(db, "quizQuestions"),
      where("day", "==", Number(dayNumber))
    );
    const snap = await getDocs(qRef);
    return snap.size > 0;
  }

  // check if any quiz exists for ANY day < given day
  async function hasAnyBeforeDay(dayNumber) {
    if (Number(dayNumber) <= 1) return false;
    const qRef = query(
      collection(db, "quizQuestions"),
      where("day", "<", Number(dayNumber))
    );
    const snap = await getDocs(qRef);
    return snap.size > 0;
  }

  // get smallest day that currently exists (for UX hints)
  function getMinExistingDayLocal() {
    if (!quizzes || quizzes.length === 0) return null;
    return Math.min(...quizzes.map((q) => Number(q.day) || 0));
  }

  // ---------- FORM HANDLERS ----------
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm({
      day: "",
      question: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      correctOption: "A",
    });
    setEditingId(null);
  }

  async function handleSave(e) {
    e.preventDefault();

    const quizData = {
      day: Number(form.day) || 0,
      question: form.question || "",
      optionA: form.optionA || "",
      optionB: form.optionB || "",
      optionC: form.optionC || "",
      optionD: form.optionD || "",
      correctOption: form.correctOption || "A",
    };

    if (!quizData.day || quizData.day < 1 || quizData.day > 21) {
      setError("Please enter a valid day (1–21).");
      return;
    }

    try {
      setError("");

      // ==== NEW GLOBAL RULE ====
      // For any Day D (>1), block adding if ANY previous day (<D) still has quizzes.
      // Applies on "create". Also applies on "edit" if user changes the day to a later one.
      const prevExists = await hasAnyBeforeDay(quizData.day);
      if (prevExists) {
        setError(
          `Cannot add/edit for Day ${quizData.day}. Please delete all quizzes from earlier days (< ${quizData.day}) first.`
        );
        return;
      }

      if (editingId) {
        await updateQuiz(editingId, quizData);
      } else {
        await addQuiz(quizData);
      }

      resetForm();
      await loadQuizzes();

      if (quizData.day) await recomputeAndWriteDayDerived(quizData.day);
    } catch (err) {
      console.error("Error saving quiz:", err);
      setError("Failed to save quiz.");
    }
  }

  // ---------- ROW ACTIONS ----------
  function handleEdit(quiz) {
    setEditingId(quiz.id);
    setForm({
      day: quiz.day?.toString() || "",
      question: quiz.question || "",
      optionA: quiz.optionA || "",
      optionB: quiz.optionB || "",
      optionC: quiz.optionC || "",
      optionD: quiz.optionD || "",
      correctOption: quiz.correctOption || "A",
    });
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this quiz?")) return;

    try {
      setError("");
      const qz = quizzes.find((q) => q.id === id);
      const day = qz?.day;

      await deleteQuiz(id);
      await loadQuizzes();

      if (day) await recomputeAndWriteDayDerived(day);
    } catch (err) {
      console.error("Error deleting quiz:", err);
      setError("Failed to delete quiz.");
    }
  }

  async function handlePublishOne(quiz) {
    try {
      setError("");
      await updateQuiz(quiz.id, { ...quiz, published: true });
      await loadQuizzes();

      if (quiz.day) await recomputeAndWriteDayDerived(quiz.day);
    } catch (err) {
      console.error("Error publishing quiz:", err);
      setError("Failed to publish quiz.");
    }
  }

  async function handlePublishAll(day) {
    try {
      setError("");
      await publishAllForDay(day);
      await loadQuizzes();

      await recomputeAndWriteDayDerived(day);
    } catch (err) {
      console.error("Error publishing all:", err);
      setError("Failed to publish all quizzes for this day.");
    }
  }

  async function handleDeleteAll(day) {
    if (
      !window.confirm(
        `Delete all quizzes for Day ${day}? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setError("");
      await deleteAllForDay(day);
      await loadQuizzes();

      await recomputeAndWriteDayDerived(day);
    } catch (err) {
      console.error("Error deleting all quizzes for day:", err);
      setError("Failed to delete all quizzes for this day.");
    }
  }

  // ---------- SAVE DAY SETTINGS (max points + time limit) ----------
  async function saveDaySettings(e) {
    e.preventDefault();
    const day = Number(daySettingsInput.day);
    const maxPoints = Number(daySettingsInput.maxPoints);
    const timeLimitMinutes = Number(daySettingsInput.timeLimitMinutes);

    if (!day || day < 1 || day > 21) {
      setError("Please enter a valid day (1–21).");
      return;
    }
    if (!Number.isFinite(maxPoints) || maxPoints < 0) {
      setError("Please enter a valid maximum points value.");
      return;
    }
    if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes < 0) {
      setError("Please enter a valid time limit (minutes).");
      return;
    }

    try {
      setError("");
      await setDoc(
        doc(db, "quizDaySettings", `day_${day}`),
        {
          day,
          maxPoints,
          timeLimitMinutes,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      // Update local cache
      setDaySettingsMap((prev) => ({
        ...prev,
        [day]: { maxPoints, timeLimitMinutes },
      }));

      // Recompute derived fields for that day
      await recomputeAndWriteDayDerived(day);
    } catch (err) {
      console.error("Error saving day settings:", err);
      setError("Failed to save settings for this day.");
    }
  }

  // ---------- CORE: Update each quiz in a day ----------
  // Sets both: ponits_for_this_question & timeLimitMinutes
  async function recomputeAndWriteDayDerived(day) {
    try {
      const q = query(
        collection(db, "quizQuestions"),
        where("day", "==", Number(day))
      );
      const snap = await getDocs(q);

      const totalCount = snap.size;

      const settings = daySettingsMap?.[day] || {
        maxPoints: 20,
        timeLimitMinutes: 10,
      };
      const perQuestion = totalCount > 0 ? settings.maxPoints / totalCount : 0;

      const batch = writeBatch(db);
      snap.forEach((d) => {
        batch.update(doc(db, "quizQuestions", d.id), {
          // exact field name as requested:
          ponits_for_this_question: perQuestion,
          timeLimitMinutes: settings.timeLimitMinutes,
        });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error updating quizzes for day:", err);
    }
  }

  // When quizzes OR settings map changes, recompute for all days shown
  useEffect(() => {
    if (!quizzes || quizzes.length === 0) return;
    const uniqueDays = Array.from(new Set(quizzes.map((q) => q.day))).sort(
      (a, b) => a - b
    );
    (async () => {
      for (const d of uniqueDays) {
        await recomputeAndWriteDayDerived(d);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizzes, daySettingsMap]);

  // derived for UX hint
  const minExistingDay = getMinExistingDayLocal();

  // ---------- UI ----------
  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem" }}>
      <h2
        style={{
          fontSize: "2rem",
          fontWeight: "bold",
          marginBottom: "1.5rem",
        }}
      >
        Quiz Management (21 Days)
      </h2>

      {error && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.5rem 0.75rem",
            backgroundColor: "#ffe5e5",
            color: "#b00020",
            borderRadius: "6px",
          }}
        >
          {error}
        </div>
      )}

      {/* ===== DAY SETTINGS CONTROLLER ===== */}
      <form
        onSubmit={saveDaySettings}
        style={{
          marginBottom: "1.25rem",
          padding: "1rem",
          borderRadius: "12px",
          background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "0.75rem",
          alignItems: "end",
        }}
      >
        <div>
          <label style={{ fontSize: "0.85rem" }}>Day (1 - 21)</label>
          <input
            type="number"
            min="1"
            max="21"
            value={daySettingsInput.day}
            onChange={(e) =>
              setDaySettingsInput((p) => ({
                ...p,
                day: Number(e.target.value),
              }))
            }
            style={{
              width: "100%",
              marginTop: "0.25rem",
              padding: "0.4rem 0.6rem",
              borderRadius: "6px",
              border: "1px solid #444",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
            }}
          />
        </div>

        <div style={{ gridColumn: "span 2 / span 2" }}>
          <label style={{ fontSize: "0.85rem" }}>
            Maximum Points (for this day)
          </label>
          <input
            type="number"
            step="1"
            min="0"
            value={daySettingsInput.maxPoints}
            onChange={(e) =>
              setDaySettingsInput((p) => ({
                ...p,
                maxPoints: Number(e.target.value),
              }))
            }
            placeholder="20"
            style={{
              width: "100%",
              marginTop: "0.25rem",
              padding: "0.4rem 0.6rem",
              borderRadius: "6px",
              border: "1px solid #444",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
            }}
          />
        </div>

        <div style={{ gridColumn: "span 2 / span 2" }}>
          <label style={{ fontSize: "0.85rem" }}>
            Time Limit (minutes, this day)
          </label>
          <input
            type="number"
            step="1"
            min="0"
            value={daySettingsInput.timeLimitMinutes}
            onChange={(e) =>
              setDaySettingsInput((p) => ({
                ...p,
                timeLimitMinutes: Number(e.target.value),
              }))
            }
            placeholder="10"
            style={{
              width: "100%",
              marginTop: "0.25rem",
              padding: "0.4rem 0.6rem",
              borderRadius: "6px",
              border: "1px solid #444",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
            }}
          />
        </div>

        <div>
          <button
            type="submit"
            style={{
              padding: "0.55rem 1.1rem",
              borderRadius: "999px",
              border: "none",
              background: "linear-gradient(135deg,#16a34a,#22c55e)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 500,
              width: "100%",
            }}
          >
            Save Day Settings
          </button>
          <div style={{ marginTop: "0.55rem", fontSize: "0.55rem", color: "#bbb" }}>
            Saved for Day {daySettingsInput.day}:{" "}
            Max {daySettingsMap[daySettingsInput.day]?.maxPoints ?? 20},{" "}
            Time {daySettingsMap[daySettingsInput.day]?.timeLimitMinutes ?? 10}{" "}
            min (defaults shown if not set)
          </div>
        </div>
      </form>

      {/* ===== CREATE/UPDATE QUIZ FORM ===== */}
      <div
        style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          borderRadius: "12px",
          background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h3 style={{ marginBottom: "1rem", fontSize: "1.2rem" }}>
          {editingId ? "Update Quiz" : "Create / Update Quiz"}
        </h3>

        <form
          onSubmit={handleSave}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "0.75rem",
          }}
        >
          {/* Day + Question */}
          <div>
            <label style={{ fontSize: "0.85rem" }}>Day (1 - 21)</label>
            <input
              type="number"
              name="day"
              min="1"
              max="21"
              value={form.day}
              onChange={handleChange}
              placeholder="1"
              // UX: if there is any earlier day present, prevent choosing a later day visually
              title={
                Number(form.day) > 1 && minExistingDay !== null
                  ? "You must delete all earlier days before adding this day"
                  : ""
              }
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
              }}
            />
            {Number(form.day) > 1 && minExistingDay !== null && (
              <div
                style={{
                  color: "#fca5a5",
                  fontSize: "0.8rem",
                  marginTop: "0.25rem",
                }}
              >
                Clear all quizzes from earlier days before adding Day {form.day}.
              </div>
            )}
          </div>

          <div style={{ gridColumn: "span 3 / span 3" }}>
            <label style={{ fontSize: "0.85rem" }}>Question</label>
            <input
              type="text"
              name="question"
              value={form.question}
              onChange={handleChange}
              placeholder="Question text"
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
              }}
            />
          </div>

          {/* Options */}
          <div>
            <label style={{ fontSize: "0.85rem" }}>Option A</label>
            <input
              type="text"
              name="optionA"
              value={form.optionA}
              onChange={handleChange}
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem" }}>Option B</label>
            <input
              type="text"
              name="optionB"
              value={form.optionB}
              onChange={handleChange}
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem" }}>Option C</label>
            <input
              type="text"
              name="optionC"
              value={form.optionC}
              onChange={handleChange}
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem" }}>Option D</label>
            <input
              type="text"
              name="optionD"
              value={form.optionD}
              onChange={handleChange}
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
              }}
            />
          </div>

          {/* Correct Answer */}
          <div>
            <label style={{ fontSize: "0.85rem" }}>Correct Answer</label>
            <select
              name="correctOption"
              value={form.correctOption}
              onChange={handleChange}
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
              }}
            >
              <option value="A">Option A</option>
              <option value="B">Option B</option>
              <option value="C">Option C</option>
              <option value="D">Option D</option>
            </select>
          </div>

          {/* Buttons */}
          <div
            style={{
              gridColumn: "span 4 / span 4",
              marginTop: "0.75rem",
              display: "flex",
              gap: "0.75rem",
            }}
          >
            <button
              type="submit"
              style={{
                padding: "0.45rem 1.2rem",
                borderRadius: "999px",
                border: "none",
                background: "linear-gradient(135deg,#16a34a,#22c55e)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {editingId ? "Update Quiz" : "Save Quiz"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: "0.45rem 1.2rem",
                  borderRadius: "999px",
                  border: "1px solid #888",
                  background: "transparent",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ===== QUIZ LIST ===== */}
      <div
        style={{
          padding: "1.5rem",
          borderRadius: "12px",
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h3 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
          Quiz List
        </h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
              <th style={{ padding: "0.5rem" }}>Day</th>
              <th style={{ padding: "0.5rem" }}>Question</th>
              <th style={{ padding: "0.5rem" }}>Published</th>
              <th style={{ padding: "0.5rem" }}>Time left</th>
              <th style={{ padding: "0.5rem" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: "0.75rem", color: "#ccc" }}>
                  Loading quizzes…
                </td>
              </tr>
            ) : quizzes.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "0.75rem", color: "#ccc" }}>
                  No quizzes yet. Add one above 👆
                </td>
              </tr>
            ) : (
              quizzes.map((quiz) => (
                <tr
                  key={quiz.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <td style={{ padding: "0.5rem" }}>{quiz.day}</td>
                  <td style={{ padding: "0.5rem" }}>{quiz.question}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {quiz.published ? "Yes" : "No"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>-</td>
                  <td style={{ padding: "0.5rem" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.4rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={() => handlePublishOne(quiz)}
                        style={{
                          padding: "0.25rem 0.7rem",
                          borderRadius: "999px",
                          border: "none",
                          background: "#16a34a",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Publish
                      </button>
                      <button
                        onClick={() => handleEdit(quiz)}
                        style={{
                          padding: "0.25rem 0.7rem",
                          borderRadius: "999px",
                          border: "1px solid #60a5fa",
                          background: "transparent",
                          color: "#bfdbfe",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        style={{
                          padding: "0.25rem 0.7rem",
                          borderRadius: "999px",
                          border: "1px solid #f97373",
                          background: "transparent",
                          color: "#fecaca",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Day-wise bulk actions */}
        {quizzes.length > 0 && (
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {[...new Set(quizzes.map((q) => q.day))]
              .sort((a, b) => a - b)
              .map((day) => (
                <div key={day} style={{ display: "flex", gap: "0.4rem" }}>
                  <button
                    onClick={() => handlePublishAll(day)}
                    style={{
                      padding: "0.3rem 0.9rem",
                      borderRadius: "999px",
                      border: "1px solid #22c55e",
                      background: "transparent",
                      color: "#bbf7d0",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    Publish all (Day {day})
                  </button>

                  <button
                    onClick={() => handleDeleteAll(day)}
                    style={{
                      padding: "0.3rem 0.9rem",
                      borderRadius: "999px",
                      border: "1px solid #f97373",
                      background: "transparent",
                      color: "#fecaca",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    Delete all (Day {day})
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* Day-wise stats */}
        {quizzes.length > 0 && (
          <div
            style={{
              marginTop: "1rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              fontSize: "0.85rem",
              color: "#ddd",
            }}
          >
            <div style={{ marginBottom: "0.4rem", fontWeight: 600 }}>
              Day summary (published count → timer) & points:
            </div>

            {[...new Set(quizzes.map((q) => q.day))]
              .sort((a, b) => a - b)
              .map((day) => {
                const dayQuizzes = quizzes.filter((q) => q.day === day);
                const publishedCount = dayQuizzes.filter((q) => q.published)
                  .length;
                const totalCount = dayQuizzes.length;

                const totalSeconds = publishedCount * TIME_PER_QUESTION_SEC;
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;

                const settings = daySettingsMap?.[day] || {
                  maxPoints: 20,
                  timeLimitMinutes: 10,
                };
                const perQuestion =
                  totalCount > 0 ? settings.maxPoints / totalCount : 0;

                return (
                  <div key={day}>
                    Day {day}: {publishedCount}/{totalCount} published → {minutes}{" "}
                    min {seconds.toString().padStart(2, "0")} sec | Max{" "}
                    {settings.maxPoints} → 1 Q = {perQuestion} points | Time
                    limit saved: {settings.timeLimitMinutes} min{" "}
                    (stored in each quiz as <code>timeLimitMinutes</code> and{" "}
                    <code>ponits_for_this_question</code>)
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
