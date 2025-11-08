// src/Admin/components/QuizSection.jsx

import React, { useEffect, useState } from "react";
import {
  getAllQuizzes,
  addQuiz,
  updateQuiz,
  deleteQuiz,
  publishAllForDay,
  deleteAllForDay,
} from "../services/quizService"; // path correct nu check pannunga

export default function QuizSection() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  // ovoru question-ku 90 sec (1.5 mins)
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

  useEffect(() => {
    loadQuizzes();
  }, []);

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

    console.log("FORM BEFORE SAVE:", form); // debug-ku

    const quizData = {
      day: Number(form.day) || 0, // later validation add panna laam
      question: form.question || "",
      optionA: form.optionA || "",
      optionB: form.optionB || "",
      optionC: form.optionC || "",
      optionD: form.optionD || "",
      correctOption: form.correctOption || "A",
    };

    try {
      setError("");

      if (editingId) {
        await updateQuiz(editingId, quizData);
      } else {
        await addQuiz(quizData);
      }

      resetForm();
      await loadQuizzes();
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
      await deleteQuiz(id);
      await loadQuizzes();
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
    } catch (err) {
      console.error("Error deleting all quizzes for day:", err);
      setError("Failed to delete all quizzes for this day.");
    }
  }

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

      {/* ===== FORM ===== */}
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

        {/* Day-wise bulk actions: publish all / delete all */}
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

        {/* Day-wise stats: how many published & total time */}
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
              Day summary (published count → timer):
            </div>

            {[...new Set(quizzes.map((q) => q.day))]
              .sort((a, b) => a - b)
              .map((day) => {
                const dayQuizzes = quizzes.filter((q) => q.day === day);
                const publishedCount = dayQuizzes.filter(
                  (q) => q.published
                ).length;
                const totalCount = dayQuizzes.length;

                const totalSeconds =
                  publishedCount * TIME_PER_QUESTION_SEC;
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;

                return (
                  <div key={day}>
                    Day {day}: {publishedCount}/{totalCount} published →{" "}
                    {minutes} min{" "}
                    {seconds.toString().padStart(2, "0")} sec
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
