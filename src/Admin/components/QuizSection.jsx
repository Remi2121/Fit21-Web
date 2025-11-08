// src/Admin/components/QuizSection.jsx
import React from "react";
import Card from "./Card.jsx";
import Input from "./Input.jsx";
import "../AdminDashboard.css";

export default function QuizSection({
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
        

<button
  type="submit"
  className="btn btn-success quiz-save-btn"   // 👈 class add pannunga
>
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
