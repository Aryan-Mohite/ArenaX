import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import SEO from "../components/SEO";
import DailiesSidebar from "../components/dailies/DailiesSidebar";
import QuizLobby from "../components/dailies/QuizLobby";
import QuizArena from "../components/dailies/QuizArena";
import QuizResults from "../components/dailies/QuizResults";
import { ErrorMessage } from "../components/UI";
import {
  getMyDailiesGames,
  getGameLobby,
  startDailyQuiz,
  answerQuestion,
  forfeitOnBlur,
} from "../services/dailyQuizService";

// view: 'lobby' | 'quiz' | 'results'
export default function Dailies() {
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState(null);

  const [selectedGame, setSelectedGame] = useState(null);
  const [view, setView] = useState("lobby");

  const [lobby, setLobby] = useState(null);
  const [lobbyLoading, setLobbyLoading] = useState(false);

  const [sessionId, setSessionId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [results, setResults] = useState(null);
  const [streak, setStreak] = useState(null);

  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const sidebarRef = useRef(null);
  const mainRef = useRef(null);

  // ─── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    getMyDailiesGames()
      .then((res) => {
        const list = res.data.games || [];
        setGames(list);
        if (list.length > 0) selectGame(list[0]);
      })
      .catch(() => setGamesError(true))
      .finally(() => setGamesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Staggered HUD entrance — sidebar and main arena slide in from opposite
  // sides per the Dailies page-transition spec.
  //
  // NOTE: deliberately no `filter: blur()` here. The sidebar renders a
  // dozen+ rounded, object-cover game thumbnails, and animating blur across
  // a container with that many clipped raster images causes visible
  // repaint flicker in Chromium as it promotes/demotes compositing layers
  // each frame. Opacity + transform alone is just as smooth and GPU-cheap.
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power4.out", duration: 0.6 } });
    if (sidebarRef.current) {
      gsap.set(sidebarRef.current, { force3D: true });
      tl.fromTo(
        sidebarRef.current,
        { xPercent: -8, opacity: 0 },
        { xPercent: 0, opacity: 1 },
        0,
      );
    }
    if (mainRef.current) {
      gsap.set(mainRef.current, { force3D: true });
      tl.fromTo(
        mainRef.current,
        { xPercent: 3, opacity: 0, scale: 0.985 },
        { xPercent: 0, opacity: 1, scale: 1 },
        0.12,
      );
    }
  }, []);

  const refreshSidebar = useCallback(() => {
    getMyDailiesGames()
      .then((res) => setGames(res.data.games || []))
      .catch(() => {});
  }, []);

  const selectGame = (game) => {
    setSelectedGame(game);
    setView("lobby");
    setActionError(null);
    setLobbyLoading(true);
    getGameLobby(game.game_id)
      .then((res) => setLobby(res.data))
      .catch(() => setActionError("Couldn't load today's stats for this game."))
      .finally(() => setLobbyLoading(false));
  };

  const handleStart = () => {
    if (!selectedGame) return;
    setStarting(true);
    setActionError(null);
    startDailyQuiz(selectedGame.game_id)
      .then((res) => {
        const data = res.data;
        if (data.status === "already_completed") {
          setResults({ ...data.results, total_questions: 5 });
          setStreak(null);
          setView("results");
        } else {
          setSessionId(data.session_id);
          setQuestion(data.question);
          setView("quiz");
        }
      })
      .catch((err) => {
        setActionError(err.response?.data?.message || "Couldn't start today's quiz. Try again.");
      })
      .finally(() => setStarting(false));
  };

  const handleAnswer = (selectedOption) => {
    if (submitting || !sessionId) return;
    setSubmitting(true);
    answerQuestion(sessionId, selectedOption)
      .then((res) => applySubmitResult(res.data))
      .catch((err) => setActionError(err.response?.data?.message || "Couldn't submit your answer."))
      .finally(() => setSubmitting(false));
  };

  const handleBlur = () => {
    if (submitting || !sessionId) return;
    setSubmitting(true);
    forfeitOnBlur(sessionId)
      .then((res) => applySubmitResult(res.data))
      .catch(() => {})
      .finally(() => setSubmitting(false));
  };

  const applySubmitResult = (data) => {
    if (data.status === "completed") {
      setResults(data.results);
      setStreak(data.streak);
      setView("results");
      refreshSidebar();
    } else {
      setQuestion(data.question);
    }
  };

  const handlePlayAnotherGame = () => {
    setSelectedGame(null);
    setView("lobby");
  };

  return (
    <div
      className="dailies-page flex flex-col lg:flex-row min-h-screen"
      style={{ background: "linear-gradient(160deg, #020617 0%, #0d1120 55%, #05070d 100%)" }}
    >
      <SEO title="Dailies | ArenaX" description="Test your game knowledge with a daily 5-question quiz. Build your streak and climb the leaderboard." />

      <Link
        to="/"
        className="fixed top-4 left-4 z-50 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-black/80 border shadow-lg backdrop-blur-md transition-colors"
        style={{ borderColor: "rgba(255,70,85,0.3)", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,70,85,0.7)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,70,85,0.3)")}
      >
        <span aria-hidden="true">←</span> Back to Home
      </Link>

      <div ref={sidebarRef}>
        <DailiesSidebar
          games={games}
          loading={gamesLoading}
          error={gamesError}
          selectedGameId={selectedGame?.game_id}
          onSelect={selectGame}
        />
      </div>

      <div ref={mainRef} className="flex-1 flex flex-col">
        {actionError && (
          <div className="px-6 pt-4">
            <ErrorMessage message={actionError} />
          </div>
        )}

        {!selectedGame && !gamesLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm px-6 text-center">
            {games.length === 0
              ? "Add games to your library to unlock Dailies."
              : "Pick a game from the sidebar to see today's quiz."}
          </div>
        ) : selectedGame ? (
          <>
            {view === "lobby" && (
              <QuizLobby
                game={selectedGame}
                lobby={lobby}
                loading={lobbyLoading}
                starting={starting}
                onStart={handleStart}
                onViewLeaderboard={() => {
                  setResults({
                    correct_count: lobby?.today_status?.correct_count,
                    total_time_ms: lobby?.today_status?.total_time_ms,
                    total_questions: 5,
                  });
                  setStreak(null);
                  setView("results");
                }}
              />
            )}

            {view === "quiz" && question && (
              <QuizArena
                key={question.question_id}
                question={question}
                onAnswer={handleAnswer}
                onBlur={handleBlur}
                submitting={submitting}
              />
            )}

            {view === "results" && results && (
              <QuizResults
                game={selectedGame}
                sessionId={sessionId}
                results={results}
                streak={streak}
                onPlayAnotherGame={handlePlayAnotherGame}
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
