import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  CircleAlert,
  Clock3,
  Leaf,
  LoaderCircle,
  LogOut,
  LockKeyhole,
  Sprout,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  apiRequest,
  getFriendlyError,
  isNewCodeLongEnough,
  UnauthorizedError,
} from "@/lib/somastep-api";

type Screen = "restoring" | "login" | "change-code" | "dashboard";

type LoginResponse = {
  token: string;
  must_change: boolean;
};

type ChangeCodeResponse = {
  token: string;
};

type ParentProfile = {
  parent_name: string;
  child_name: string;
  preferred_name: string;
  grade: string | number;
  subjects: string[];
  extras: string[];
  minutes_balance: number;
};

type LessonTopic = {
  topic: string;
  understood: boolean;
};

type Lesson = {
  date: string;
  topics: LessonTopic[];
};

const SESSION_TOKEN_KEY = "somastep-token";
const MUST_CHANGE_KEY = "somastep-must-change";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "SomaStep | Parent learning dashboard" },
      {
        name: "description",
        content: "A clear, encouraging view of your child’s learning journey with SomaStep.",
      },
      { property: "og:title", content: "SomaStep | Parent learning dashboard" },
      {
        property: "og:description",
        content: "Follow your child’s learning progress, lessons, and remaining study time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Home() {
  const [screen, setScreen] = useState<Screen>("restoring");
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loginError, setLoginError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");

  useEffect(() => {
    const savedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const mustChange = sessionStorage.getItem(MUST_CHANGE_KEY) === "true";

    if (!savedToken) {
      setScreen("login");
      return;
    }

    setToken(savedToken);
    setScreen(mustChange ? "change-code" : "dashboard");
  }, []);

  useEffect(() => {
    if (screen !== "dashboard" || !token) return;

    let isActive = true;
    setDashboardLoading(true);
    setDashboardError(null);

    Promise.all([
      apiRequest<ParentProfile>("/api/me", { token }),
      apiRequest<Lesson[]>("/api/lessons", { token }),
    ])
      .then(([parent, lessonRows]) => {
        if (!isActive) return;
        setProfile(parent);
        setLessons(
          [...lessonRows].sort((first, second) => {
            return new Date(second.date).getTime() - new Date(first.date).getTime();
          }),
        );
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        if (error instanceof UnauthorizedError) {
          clearSavedSession();
          setToken(null);
          setLoginError("Your session has expired. Please sign in again.");
          setScreen("login");
          return;
        }
        setDashboardError(getFriendlyError(error));
      })
      .finally(() => {
        if (isActive) setDashboardLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [retryCount, screen, token]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");

    try {
      const result = await apiRequest<LoginResponse>("/api/login", {
        method: "POST",
        body: { username, password },
      });
      sessionStorage.setItem(SESSION_TOKEN_KEY, result.token);
      sessionStorage.setItem(MUST_CHANGE_KEY, String(result.must_change));
      setToken(result.token);
      setPassword("");
      setScreen(result.must_change ? "change-code" : "dashboard");
    } catch (error) {
      setLoginError(`That didn’t work. ${getFriendlyError(error)}`);
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleChangeCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeError("");

    if (!isNewCodeLongEnough(newCode)) {
      setCodeError("Choose a code with at least 8 characters.");
      return;
    }
    if (newCode !== confirmCode) {
      setCodeError("Those codes don’t match yet. Please check and try again.");
      return;
    }
    if (!token) {
      clearSavedSession();
      setScreen("login");
      return;
    }

    setCodeBusy(true);
    try {
      const result = await apiRequest<ChangeCodeResponse>("/api/change-password", {
        method: "POST",
        token,
        body: { new_password: newCode },
      });
      sessionStorage.setItem(SESSION_TOKEN_KEY, result.token);
      sessionStorage.setItem(MUST_CHANGE_KEY, "false");
      setToken(result.token);
      setNewCode("");
      setConfirmCode("");
      setScreen("dashboard");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        clearSavedSession();
        setToken(null);
        setLoginError("Your session has expired. Please sign in again.");
        setScreen("login");
      } else {
        setCodeError(getFriendlyError(error));
      }
    } finally {
      setCodeBusy(false);
    }
  }

  function handleLogout() {
    clearSavedSession();
    setToken(null);
    setProfile(null);
    setLessons([]);
    setLoginError("");
    setPassword("");
    setScreen("login");
  }

  if (screen === "dashboard") {
    return (
      <Dashboard
        profile={profile}
        lessons={lessons}
        loading={dashboardLoading}
        error={dashboardError}
        onRetry={() => setRetryCount((count) => count + 1)}
        onLogout={handleLogout}
      />
    );
  }

  const isChangingCode = screen === "change-code" && token !== null;

  return (
    <main className="auth-page">
      <div className="auth-frame">
        <section className="auth-welcome" aria-label="Welcome to SomaStep">
          <div>
            <SomaLogo inverse />
            <p className="auth-eyebrow">A little progress, every day</p>
            <h1 className="auth-welcome-title">
              Learning grows with <span>every step.</span>
            </h1>
            <p className="auth-welcome-copy">
              Keep the little wins close. SomaStep brings your child’s lessons, interests, and
              learning time together in one calm place.
            </p>
          </div>
          <div className="welcome-note">
            <span className="welcome-note-icon" aria-hidden="true">
              <Leaf size={17} />
            </span>
            <span>Rooted in curiosity. Growing with confidence.</span>
          </div>
        </section>

        <section className="auth-form-panel">
          {screen === "restoring" ? (
            <div className="auth-loading" role="status">
              <LoaderCircle className="animate-spin text-brand" size={24} />
              <span>Opening your SomaStep space…</span>
            </div>
          ) : isChangingCode ? (
            <form className="auth-form" onSubmit={handleChangeCode}>
              <div className="form-heading">
                <p className="form-eyebrow">One quick step</p>
                <h2>Choose a new code</h2>
                <p>Set a private code for next time. It needs at least 8 characters.</p>
              </div>

              <div className="field-group">
                <Label htmlFor="new-code">New code</Label>
                <div className="input-with-icon">
                  <LockKeyhole className="field-icon" size={17} aria-hidden="true" />
                  <Input
                    id="new-code"
                    name="new_password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={newCode}
                    onChange={(event) => setNewCode(event.target.value)}
                    minLength={8}
                    required
                    disabled={codeBusy}
                  />
                </div>
              </div>

              <div className="field-group">
                <Label htmlFor="confirm-code">Confirm new code</Label>
                <div className="input-with-icon">
                  <LockKeyhole className="field-icon" size={17} aria-hidden="true" />
                  <Input
                    id="confirm-code"
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Type your new code again"
                    value={confirmCode}
                    onChange={(event) => setConfirmCode(event.target.value)}
                    required
                    disabled={codeBusy}
                  />
                </div>
              </div>

              {codeError ? <p className="form-error" role="alert">{codeError}</p> : null}

              <Button type="submit" className="form-submit" disabled={codeBusy}>
                {codeBusy ? "Saving your new code…" : "Save new code"}
                {codeBusy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
              </Button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="form-heading">
                <p className="form-eyebrow">Parent sign in</p>
                <h2>Welcome back</h2>
                <p>Sign in to see the small steps adding up.</p>
              </div>

              <div className="field-group">
                <Label htmlFor="username">Username</Label>
                <div className="input-with-icon">
                  <UserRound className="field-icon" size={17} aria-hidden="true" />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="Your username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                    disabled={loginBusy}
                  />
                </div>
              </div>

              <div className="field-group">
                <Label htmlFor="password">Code</Label>
                <div className="input-with-icon">
                  <LockKeyhole className="field-icon" size={17} aria-hidden="true" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your access code"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={loginBusy}
                  />
                </div>
              </div>

              {loginError ? <p className="form-error" role="alert">{loginError}</p> : null}

              <Button type="submit" className="form-submit" disabled={loginBusy}>
                {loginBusy ? "Signing you in…" : "Sign in"}
                {loginBusy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
              </Button>
              <p className="form-footnote">Your child’s learning space is just ahead.</p>
            </form>
          )}
        </section>
      </div>
      <p className="auth-footer">SomaStep · Growing together, one lesson at a time</p>
    </main>
  );
}

function Dashboard({
  profile,
  lessons,
  loading,
  error,
  onRetry,
  onLogout,
}: {
  profile: ParentProfile | null;
  lessons: Lesson[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="dashboard-page">
      <header className="dashboard-topbar">
        <div className="topbar-inner">
          <SomaLogo />
          <div className="topbar-actions">
            <span className="parent-greeting">
              {profile ? `Welcome, ${profile.parent_name}` : "Your family space"}
            </span>
            <Button type="button" variant="outline" className="logout-button" onClick={onLogout}>
              <LogOut size={16} />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-intro">
          <div>
            <p className="dashboard-eyebrow">Your learning snapshot</p>
            <h1>Every step is progress.</h1>
            <p className="dashboard-intro-copy">
              A little look at what your child has been learning lately.
            </p>
          </div>
          <div className="intro-mark" aria-hidden="true">
            <Sprout size={25} />
          </div>
        </div>

        {loading ? (
          <div className="dashboard-loading" role="status">
            <LoaderCircle className="animate-spin text-brand" size={24} />
            <div>
              <strong>Gathering your latest updates</strong>
              <span>Your child’s learning story is on its way.</span>
            </div>
          </div>
        ) : error ? (
          <div className="dashboard-error" role="alert">
            <span className="error-icon" aria-hidden="true">
              <CircleAlert size={20} />
            </span>
            <div>
              <h2>We couldn’t load your dashboard</h2>
              <p>{error}</p>
            </div>
            <Button type="button" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : profile ? (
          <div className="dashboard-grid">
            <div className="dashboard-column">
              <ChildCard profile={profile} />
              <section className="ai-report-panel" aria-labelledby="report-title">
                <div className="ai-report-icon" aria-hidden="true">
                  <Leaf size={19} />
                </div>
                <div className="ai-report-copy">
                  <div className="ai-report-heading">
                    <h2 id="report-title">AI progress report</h2>
                    <Badge variant="outline" className="coming-soon-badge">
                      Coming soon
                    </Badge>
                  </div>
                  <p>A thoughtful summary of your child’s learning will be here soon.</p>
                </div>
              </section>
            </div>
            <LearningHistory lessons={lessons} />
          </div>
        ) : null}
      </main>
    </div>
  );
}

function ChildCard({ profile }: { profile: ParentProfile }) {
  const childName = profile.preferred_name || profile.child_name;

  return (
    <section className="child-card" aria-labelledby="child-card-title">
      <div className="child-card-heading">
        <div className="child-avatar" aria-hidden="true">
          {childName.trim().charAt(0).toLocaleUpperCase() || <Sprout size={21} />}
        </div>
        <div>
          <p className="card-eyebrow">Your learner</p>
          <h2 id="child-card-title">{childName}</h2>
          <p className="child-grade">Class {profile.grade}</p>
        </div>
      </div>

      <div className="minutes-panel">
        <div className="minutes-copy">
          <span className="minutes-label">Learning time</span>
          <div className="minutes-number-row">
            <strong>{Number(profile.minutes_balance).toLocaleString("en-KE")}</strong>
            <span>minutes left</span>
          </div>
        </div>
        <span className="minutes-icon" aria-hidden="true">
          <Clock3 size={22} />
        </span>
      </div>

      <ChipGroup label="Subjects" items={profile.subjects} />
      <ChipGroup label="After class" items={profile.extras} />
    </section>
  );
}

function ChipGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="chip-group">
      <h3>{label}</h3>
      {items.length > 0 ? (
        <div className="chip-list">
          {items.map((item) => (
            <Badge key={`${label}-${item}`} variant="secondary" className="subject-chip">
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="chip-empty">Nothing added yet</p>
      )}
    </div>
  );
}

function LearningHistory({ lessons }: { lessons: Lesson[] }) {
  return (
    <section className="history-panel" aria-labelledby="history-title">
      <div className="history-heading">
        <div>
          <p className="card-eyebrow">A look back</p>
          <h2 id="history-title">Learning history</h2>
        </div>
        <span className="history-count">
          {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
        </span>
      </div>

      {lessons.length === 0 ? (
        <div className="history-empty">
          <span className="empty-icon" aria-hidden="true">
            <BookOpenCheck size={23} />
          </span>
          <h3>The story starts here</h3>
          <p>Completed lessons and the topics your child is exploring will show up here.</p>
        </div>
      ) : (
        <ol className="lesson-timeline">
          {lessons.map((lesson, lessonIndex) => (
            <li className="lesson-entry" key={`${lesson.date}-${lessonIndex}`}>
              <span className="timeline-node" aria-hidden="true" />
              <div className="lesson-content">
                <time className="lesson-date" dateTime={lesson.date}>
                  {formatLessonDate(lesson.date)}
                </time>
                <div className="lesson-topics">
                  {lesson.topics.map((topic, topicIndex) => (
                    <div className="topic-row" key={`${topic.topic}-${topicIndex}`}>
                      <span className="topic-name">{topic.topic}</span>
                      <span
                        className={
                          topic.understood
                            ? "topic-status status-good"
                            : "topic-status status-practice"
                        }
                      >
                        {topic.understood ? <Check size={13} /> : <Clock3 size={13} />}
                        {topic.understood ? "Understood" : "Needs practice"}
                      </span>
                    </div>
                  ))}
                  {lesson.topics.length === 0 ? (
                    <p className="topic-empty">No topics were recorded for this lesson.</p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function SomaLogo({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`soma-logo${inverse ? " soma-logo-inverse" : ""}`}>
      <span className="soma-logo-icon" aria-hidden="true">
        <BookOpenCheck size={19} strokeWidth={2.1} />
      </span>
      <span>SomaStep</span>
    </div>
  );
}

function formatLessonDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function clearSavedSession() {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(MUST_CHANGE_KEY);
}