/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import "./quizstart.css";
import { db } from "../../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  increment,
} from "firebase/firestore";

/* Map Firestore letter to index */
const letterToIndex = (L) =>
  ({ A: 0, B: 1, C: 2, D: 3 }[(L || "").toUpperCase()] ?? null);

/* Convert Firestore doc -> local question shape */
function docToQuestion(docu) {
  const d = docu.data();
  return {
    id: d.id || docu.id,
    day: Number(d.day) || 0,
    text: d.question || "",
    options: [d.optionA, d.optionB, d.optionC, d.optionD].map((x) => x ?? ""),
    correctIndex: letterToIndex(d.correctOption),
    // exact spelling kept:
    perQuestionPoints:
      typeof d.ponits_for_this_question === "number"
        ? d.ponits_for_this_question
        : null,
    // optional fallback (if admin propagated):
    timeLimitMinutes:
      typeof d.timeLimitMinutes === "number" ? d.timeLimitMinutes : null,
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

/* YYYY-MM-DD for one-attempt-per-day & per-day exercise path */
const getDayKey = () => new Date().toISOString().slice(0, 10);

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

  // counts/points
  const [scoreCount, setScoreCount] = useState(0); // number of correct answers
  const [pointsEarned, setPointsEarned] = useState(0); // sum of points on correct
  const [maxPoints, setMaxPoints] = useState(20); // from day settings

  // which day’s quiz is running (inferred from published docs)
  const [activeDay, setActiveDay] = useState(null);

  // one-per-day lock
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [prevResult, setPrevResult] = useState(null);

  // timer
  const [timeLimitSec, setTimeLimitSec] = useState(10 * 60); // default 10 mins
  const [timeLeftSec, setTimeLeftSec] = useState(10 * 60);
  const timerRef = useRef(null);

  // Auth subscribe
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Load attempt status, questions, day settings
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // A) already finished today?
        const dayKey = getDayKey();
        const ansRef = doc(db, "quizAnswers", `${user.uid}_${dayKey}`);
        const ansSnap = await getDoc(ansRef);
        if (ansSnap.exists()) {
          setAlreadyDone(true);
          setSubmitted(true);
          setPrevResult(ansSnap.data());
          setLoading(false);
          return; // stop here
        }

        // B) load published questions
        const qy = query(
          collection(db, "quizQuestions"),
          where("published", "==", true)
        );
        const snap = await getDocs(qy);
        const items = [];
        snap.forEach((docu) => items.push(docToQuestion(docu)));

        // infer active day (most frequent day among published)
        const dayCounts = {};
        for (const q of items) dayCounts[q.day] = (dayCounts[q.day] || 0) + 1;
        const pickedDay =
          Object.keys(dayCounts).length > 0
            ? Number(
                Object.keys(dayCounts).sort(
                  (a, b) => dayCounts[b] - dayCounts[a]
                )[0]
              )
            : null;

        const itemsForDay =
          pickedDay != null ? items.filter((q) => q.day === pickedDay) : items;

        setQuestions(itemsForDay);
        setActiveDay(pickedDay);

        // C) load per-day settings
        let maxPts = 20;
        let timeLimitMins = 10;

        if (pickedDay != null) {
          const cfgSnap = await getDoc(
            doc(db, "quizDaySettings", `day_${pickedDay}`)
          );
          if (cfgSnap.exists()) {
            const v = cfgSnap.data();
            if (typeof v?.maxPoints === "number") maxPts = v.maxPoints;
            if (typeof v?.timeLimitMinutes === "number")
              timeLimitMins = v.timeLimitMinutes;
          } else {
            // fallback: if a question doc has timeLimitMinutes
            const qWithTL = itemsForDay.find(
              (q) => typeof q.timeLimitMinutes === "number"
            );
            if (qWithTL) timeLimitMins = qWithTL.timeLimitMinutes;
          }
        }

        setMaxPoints(maxPts);
        setTimeLimitSec(timeLimitMins * 60);
        setTimeLeftSec(timeLimitMins * 60);
      } catch (err) {
        console.error("Load quiz failed:", err);
        alert("Couldn't load quiz. Check Firestore rules/connection.");
      } finally {
        setLoading(false);
      }
    })();
  }, [authReady, user]);

  // Start / run countdown
  useEffect(() => {
    if (loading) return;
    if (submitted) return;
    if (alreadyDone) return;
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
  }, [loading, submitted, alreadyDone, questions.length, timeLimitSec]);

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

  // fallback if question docs don’t have per-question points
  const perQuestionPoints =
    total > 0 && typeof questions[0]?.perQuestionPoints === "number"
      ? questions[0].perQuestionPoints
      : maxPoints / Math.max(total, 1);

  const handlePick = (qid, idx) => {
    if (submitted || timedOut || timeLeftSec <= 0 || alreadyDone) return; // locked
    setAnswers((prev) => ({ ...prev, [qid]: idx }));
  };

  // Calculate correct count & points
  const buildResult = () => {
    let ok = 0;
    let pts = 0;

    const details = questions.map((q, i) => {
      const chosenIndex = answers[q.id];
      const correct =
        typeof q.correctIndex === "number" && q.correctIndex === chosenIndex;
      if (correct) {
        ok += 1;
        const p =
          typeof q.perQuestionPoints === "number"
            ? q.perQuestionPoints
            : perQuestionPoints;
        pts += p;
      }
      return {
        qNo: i + 1,
        id: q.id,
        day: q.day,
        question: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        correctText:
          typeof q.correctIndex === "number" ? q.options[q.correctIndex] : null,
        chosenIndex:
          typeof chosenIndex === "number" ? chosenIndex : null,
        chosenText:
          typeof chosenIndex === "number" ? q.options[chosenIndex] : null,
        isCorrect: !!correct,
        // keep exact field spelling for reference:
        ponits_for_this_question:
          typeof q.perQuestionPoints === "number"
            ? q.perQuestionPoints
            : perQuestionPoints,
      };
    });

    const maxPts =
      typeof maxPoints === "number" ? maxPoints : ok * perQuestionPoints;

    // You showed integer points in examples; round to int:
    const ptsRounded = Math.round(pts);
    const pctByPoints = maxPts > 0 ? Math.round((ptsRounded / maxPts) * 100) : 0;

    return { ok, pts: ptsRounded, maxPts, pctByPoints, details };
  };

  // Save points under exercises/quiz/days/<YYYY-MM-DD> and increment finalScore
  const saveExercisePointsAndIncrement = async (points) => {
    if (!user?.uid) return;
    const dayKey = getDayKey();

    // 1) users/<uid>/exercises/quiz/days/<YYYY-MM-DD>
    const dayRef = doc(
      db,
      "users",
      user.uid,
      "exercises",
      "quiz",
      "days",
      dayKey
    );
    await setDoc(
      dayRef,
      {
        date: dayKey, // string "2025-11-22"
        points: points, // number
        savedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 2) users/<uid> -> finalScore += points
    const userRef = doc(db, "users", user.uid);
    await setDoc(
      userRef,
      {
        finalScore: increment(points),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  // Save attempt to quizAnswers + exercise path + increment finalScore
  const persistResult = async (
    { ok, pts, maxPts, pctByPoints, details },
    extra = {}
  ) => {
    try {
      const dayKey = getDayKey();
      const answerDocId = `${user?.uid || "anon"}_${dayKey}`;

      // quizAnswers/<uid>_<date>
      await setDoc(
        doc(db, "quizAnswers", answerDocId),
        {
          title: "Fitness Basics Quiz",
          createdAt: serverTimestamp(),
          finishedAt: serverTimestamp(),
          userId: user?.uid || null,
          dayKey,
          activeDay: activeDay ?? null,
          totalQuestions: total,
          correctCount: ok,
          pointsEarned: pts,
          maxPoints: maxPts,
          pointsPercent: pctByPoints,
          timeLimitSec,
          timeLeftSec: extra.timedOut ? 0 : extra.timeLeftSec ?? 0,
          timeSpentSec:
            timeLimitSec - (extra.timedOut ? 0 : extra.timeLeftSec ?? 0),
          timedOut: !!extra.timedOut,
          answers: details,
        },
        { merge: false }
      );

      // exercises/quiz/days/<date> + increment finalScore
      await saveExercisePointsAndIncrement(pts);
    } catch (e) {
      console.error("Saving answers failed:", e);
      alert(`Couldn't save answers: ${e?.code || ""} ${e?.message || ""}`);
    }
  };

  const handleSubmit = async () => {
    if (submitted || alreadyDone) return;

    // ensure all answered (manual submit only)
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
    setScoreCount(result.ok);
    setPointsEarned(result.pts);
    setSubmitted(true);
  };

  const handleTimeout = async () => {
    // time up — treat unanswered as wrong & reveal all
    setTimedOut(true);
    const result = buildResult();
    await persistResult(result, {
      timedOut: true,
      timeLimitSec,
      timeLeftSec: 0,
    });
    setScoreCount(result.ok);
    setPointsEarned(result.pts);
    setSubmitted(true);
  };

  // ---------- RENDER GUARDS ----------
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

  // If already finished today, show message + points summary (if available)
  if (alreadyDone) {
    const pct =
      typeof prevResult?.pointsPercent === "number"
        ? prevResult.pointsPercent
        : typeof prevResult?.percentage === "number"
        ? prevResult.percentage
        : null;

    const showPts =
      typeof prevResult?.pointsEarned === "number" &&
      typeof prevResult?.maxPoints === "number";

    return (
      <div className="quiz-root">
        <header className="quiz-topbar">
          <div className="quiz-title">Fitness Basics Quiz</div>
          <div className="quiz-meta">
            <span className="pill">You have already finished today’s quiz ✅</span>
            {showPts ? (
              <span
                className="pill"
                style={{ background: "rgba(34,197,94,.2)" }}
              >
                Points: {prevResult.pointsEarned}/{prevResult.maxPoints} (
                {pct}%)
              </span>
            ) : pct != null ? (
              <span
                className="pill"
                style={{ background: "rgba(34,197,94,.2)" }}
              >
                Score: {prevResult?.correct}/{prevResult?.total} ({pct}%)
              </span>
            ) : null}
          </div>
        </header>

        <div style={{ padding: "2rem" }}>
          <p>Come back tomorrow for the next quiz.</p>
          <Link to="/" className="home-btn">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // ---------- MAIN UI ----------
  const perQ = perQuestionPoints;

  return (
    <div className="quiz-root">
      {/* Top bar */}
      <header className="quiz-topbar">
        <div className="quiz-title">
          Fitness Basics Quiz{activeDay ? ` — Day ${activeDay}` : ""}
        </div>
        <div className="quiz-meta">
          <span className="pill">Questions: {total}</span>
          <span className="pill pill-muted">Answered: {answeredCount}</span>
          <span className="pill">Max: {maxPoints}</span>
          <span className="pill">1 Q = {perQ}</span>
          {/* ⏳ Timer on the right */}
          <span
            className={`pill pill-timer ${
              timeLeftSec <= 30 ? "danger" : timeLeftSec <= 60 ? "warn" : ""
            }`}
          >
            ⏳ {fmt(timeLeftSec)}
          </span>
          {submitted && (
            <>
              <span
                className="pill"
                style={{ background: "rgba(34,197,94,.2)" }}
              >
                Correct: {scoreCount}/{total}
              </span>
              <span
                className="pill"
                style={{ background: "rgba(34,197,94,.2)" }}
              >
                Points: {pointsEarned}/{maxPoints}
              </span>
            </>
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
                    else if (checked && idx !== q.correctIndex)
                      extraClass = "option-wrong";
                  } else if (checked) {
                    extraClass = "option-checked";
                  }

                  return (
                    <label
                      key={`${q.id}-${idx}`}
                      className={`option ${extraClass} ${
                        submitted || timedOut || timeLeftSec <= 0
                          ? "disabled"
                          : ""
                      }`}
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
              {timedOut
                ? "Time up ⏰ — Saved to Firebase ✅"
                : "Saved to Firebase ✅"}
            </div>
            <Link to="/" className="home-btn">
              Back to Home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
