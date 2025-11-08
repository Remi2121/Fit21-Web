/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import "./quizstart.css";
import { db } from "../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

/* Map Firestore letter to index */
const letterToIndex = (L) =>
  ({ A: 0, B: 1, C: 2, D: 3 }[(L || "").toUpperCase()] ?? null);

/* Convert Firestore doc -> local question shape */
function docToQuestion(doc) {
  const d = doc.data();
  return {
    id: d.id || doc.id,
    text: d.question || "",
    options: [d.optionA, d.optionB, d.optionC, d.optionD].map((x) => x ?? ""),
    correctIndex: letterToIndex(d.correctOption),
  };
}

/* mm:ss */
const fmt = (s) => {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${ss}`;
};

export default function QuizStart() {
  // --- Auth state ---
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);

  // --- Quiz state ---
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // { [qid]: optionIndex }
  const [submitted, setSubmitted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [score, setScore] = useState(0);

  // --- Time limit ---
  const [timeLimitSec, setTimeLimitSec] = useState(10 * 60); // default 10 mins
  const [timeLeftSec, setTimeLeftSec] = useState(10 * 60);
  const timerRef = useRef(null);

  // Auth
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Fetch settings + questions after auth
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        // 1) optional quizSettings: take first doc's timeLimitMinutes
        try {
          const sSnap = await getDocs(collection(db, "quizSettings"));
          if (!sSnap.empty) {
            const first = sSnap.docs[0].data();
            const mins = Number(first?.timeLimitMinutes);
            if (!Number.isNaN(mins) && mins > 0) {
              setTimeLimitSec(mins * 60);
              setTimeLeftSec(mins * 60);
            }
          }
        } catch (e) {
          console.warn("quizSettings load failed; using default 10 mins.", e);
        }

        // 2) questions
        const qy = query(
          collection(db, "quizQuestions"),
          where("published", "==", true)
        );
        const snap = await getDocs(qy);
        const items = [];
        snap.forEach((doc) => items.push(docToQuestion(doc)));
        setQuestions(items);
      } catch (err) {
        console.error("Load quizQuestions failed:", err.code, err.message);
        alert(`Couldn't load quiz questions. Check Firestore rules/connection.`);
      } finally {
        setLoading(false);
      }
    })();
  }, [authReady, user, db]);

  // Start / run countdown
  useEffect(() => {
    if (loading) return;
    if (submitted) return;
    if (questions.length === 0) return;

    // initialize if needed
    setTimeLeftSec((prev) => (prev > 0 ? prev : timeLimitSec));

    timerRef.current = setInterval(() => {
      setTimeLeftSec((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleTimeout(); // auto submit on 0
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, submitted, questions.length, timeLimitSec]);

  const total = questions.length;

  const answeredCount = useMemo(
    () =>
      Object.keys(answers).filter((k) => typeof answers[k] === "number").length,
    [answers]
  );

  const progressPct = useMemo(
    () => (total ? Math.round((answeredCount / total) * 100) : 0),
    [answeredCount, total]
  );

  const handlePick = (qid, idx) => {
    if (submitted || timedOut || timeLeftSec <= 0) return; // locked
    setAnswers((prev) => ({ ...prev, [qid]: idx }));
  };

  const buildResult = () => {
    let ok = 0;
    const details = questions.map((q, i) => {
      const chosenIndex = answers[q.id];
      const correct =
        typeof q.correctIndex === "number" && q.correctIndex === chosenIndex;
      if (correct) ok += 1;
      return {
        qNo: i + 1,
        id: q.id,
        question: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        correctText:
          typeof q.correctIndex === "number" ? q.options[q.correctIndex] : null,
        chosenIndex:
          typeof chosenIndex === "number" ? chosenIndex : null, // null if not answered
        chosenText:
          typeof chosenIndex === "number" ? q.options[chosenIndex] : null,
        isCorrect: !!correct,
      };
    });
    const percentage = total ? Math.round((ok / total) * 100) : 0;
    return { ok, percentage, details };
  };

  const persistResult = async ({ ok, percentage, details }, extra = {}) => {
    try {
      await addDoc(collection(db, "quizAnswers"), {
        title: "Fitness Basics Quiz",
        createdAt: serverTimestamp(),
        userId: user?.uid || null,
        total,
        correct: ok,
        percentage,
        answers: details,
        ...extra, // timedOut:true etc.
      });
    } catch (e) {
      console.error("Saving answers failed:", e.code, e.message);
      alert(`Couldn't save answers: ${e.code || ""} ${e.message || ""}`);
    }
  };

  const handleSubmit = async () => {
    if (submitted) return;

    // validate all answered (only for manual submit; timeout skips this)
    const missing = questions.filter((q) => !(q.id in answers));
    if (missing.length > 0) {
      const first = missing[0];
      document
        .getElementById(`q-${first.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      alert(`Please answer all questions. Missing: ${missing.length}`);
      return;
    }

    clearInterval(timerRef.current);
    const result = buildResult();
    await persistResult(result, { timedOut: false, timeLimitSec, timeLeftSec });
    setScore(result.ok);
    setSubmitted(true);
  };

  const handleTimeout = async () => {
    // time up — treat unanswered as wrong & reveal all
    setTimedOut(true);
    const result = buildResult();
    await persistResult(result, { timedOut: true, timeLimitSec, timeLeftSec: 0 });
    setScore(result.ok);
    setSubmitted(true);
  };

  // --- Render guards ---
  if (!authReady) {
    return (
      <div className="quiz-root">
        <header className="quiz-topbar">
          <div className="quiz-title">Loading auth…</div>
        </header>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="quiz-root">
        <header className="quiz-topbar">
          <div className="quiz-title">Please login to view the quiz</div>
        </header>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="quiz-root">
        <header className="quiz-topbar">
          <div className="quiz-title">Loading quiz…</div>
        </header>
      </div>
    );
  }

  // --- Main UI ---
  return (
    <div className="quiz-root">
      {/* Top bar */}
      <header className="quiz-topbar">
        <div className="quiz-title">Fitness Basics Quiz</div>
        <div className="quiz-meta">
          <span className="pill">Questions: {total}</span>
          <span className="pill pill-muted">Answered: {answeredCount}</span>

          {/* ⏳ Timer on the right */}
          <span className={`pill pill-timer ${timeLeftSec <= 30 ? "danger" : timeLeftSec <= 60 ? "warn" : ""}`}>
            ⏳ {fmt(timeLeftSec)}
          </span>

          {submitted && (
            <span className="pill" style={{ background: "rgba(34,197,94,.2)" }}>
              Score: {score}/{total} ({total ? Math.round((score / total) * 100) : 0}
              %)
            </span>
          )}
        </div>
      </header>

      {/* Progress */}
      <div className="quiz-progress-wrap">
        <div className="quiz-progress">
          <div
            className="quiz-progress-bar"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="quiz-progress-text">{progressPct}% completed</div>
      </div>

      {/* Questions */}
      <main className="quiz-main">
        {questions.map((q, i) => {
          const chosen = answers[q.id];

          const isCorrect =
            submitted &&
            typeof q.correctIndex === "number" &&
            chosen === q.correctIndex;

          const isWrong =
            submitted &&
            typeof q.correctIndex === "number" &&
            ((typeof chosen === "number" && chosen !== q.correctIndex) ||
              (timedOut && typeof chosen !== "number")); // timeout -> unanswered treated wrong

          return (
            <article key={q.id} id={`q-${q.id}`} className="question-card">
              <div className="q-head">
                <div className="q-index">{i + 1}</div>
                <h2 className="q-text">{q.text}</h2>
              </div>

              <div className="q-options">
                {q.options.map((opt, idx) => {
                  const checked = answers[q.id] === idx;

                  // post-submit state style
                  let extraClass = "";
                  if (submitted) {
                    if (idx === q.correctIndex) extraClass = "option-correct";
                    else if (checked && idx !== q.correctIndex) extraClass = "option-wrong";
                  } else if (checked) {
                    extraClass = "option-checked";
                  }

                  return (
                    <label
                      key={`${q.id}-${idx}`}
                      className={`option ${extraClass} ${(submitted || timedOut || timeLeftSec <= 0) ? "disabled" : ""}`}
                      onClick={() => handlePick(q.id, idx)}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={checked}
                        onChange={() => handlePick(q.id, idx)}
                        disabled={submitted || timedOut || timeLeftSec <= 0}
                      />
                      <span className="option-dot" />
                      <span className="option-text">{opt}</span>
                    </label>
                  );
                })}
              </div>

              {submitted && (
                <div className="q-feedback">
                  {isCorrect ? (
                    <span className="ok">✅ Correct</span>
                  ) : isWrong ? (
                    <span className="bad">
                      ❌ Wrong — Correct:{" "}
                      <strong>
                        {typeof q.correctIndex === "number"
                          ? q.options[q.correctIndex]
                          : "-"}
                      </strong>
                    </span>
                  ) : (
                    <span className="bad">❌ Not answered</span>
                  )}
                </div>
              )}
            </article>
          );
        })}

        <div className="spacer" />
      </main>

      {/* Submit bar */}
      <div className="submit-bar">
        <div className="submit-meta">
          Answered {answeredCount} / {total}
        </div>

        {!submitted ? (
          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={timeLeftSec <= 0}
          >
            Submit Answers
          </button>
        ) : (
          <div className="submit-actions">
            <div className="submit-meta">
              {timedOut ? "Time up ⏰ — Saved to Firebase ✅" : "Saved to Firebase ✅"}
            </div>
            <Link to="/" className="home-btn">Back to Home</Link>
          </div>
        )}
      </div>
    </div>
  );
}
