"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

type SoulLoopProfile = {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  gender: string;
  currentFocus: string;
  relationshipStatus: string;
  careerStatus: string;
  preferredLanguage: string;
};

type LoadingStep = {
  title: string;
  description: string;
  icon: string;
};

const loadingSteps: LoadingStep[] = [
  {
    icon: "◐",
    title: "读取个人档案",
    description: "载入你的出生信息、当前关注领域与个人语境。",
  },
  {
    icon: "☯",
    title: "校准问题主题",
    description: "识别你的提问方向，并匹配适合的解读框架。",
  },
  {
    icon: "☰",
    title: "推演八卦象征",
    description: "分析问题中的动静、进退、关系张力与时机感。",
  },
  {
    icon: "✦",
    title: "平衡五行脉络",
    description: "整理木、火、土、金、水之间的象征关系。",
  },
  {
    icon: "✺",
    title: "生成 SoulLoop 解读",
    description: "融合个人背景、命理象征与现实建议。",
  },
];

const focusLabels: Record<string, string> = {
  love: "Love / Relationship",
  career: "Career",
  money: "Money",
  daily_energy: "Daily Energy",
  decision: "Decision",
  self_growth: "Self-Growth",
  general: "General",
};

const relationshipLabels: Record<string, string> = {
  single: "Single",
  dating: "Dating",
  in_relationship: "In a relationship",
  complicated: "Complicated",
  married: "Married",
  separated: "Separated",
};

const careerLabels: Record<string, string> = {
  student: "Student",
  employed: "Employed",
  founder: "Founder / Entrepreneur",
  freelancer: "Freelancer",
  job_seeking: "Job seeking",
  transition: "In transition",
};

const languageLabels: Record<string, string> = {
  same: "Same as question",
  english: "English",
  chinese: "中文",
};

export default function ChatPage() {
  const [topic, setTopic] = useState("general");
  const [language, setLanguage] = useState("same");
  const [tone] = useState("premium-balanced");
  const [depth] = useState("standard");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState<SoulLoopProfile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("soulloop_profile");

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SoulLoopProfile;

        const isProfileComplete =
          Boolean(parsed.birthDate) && Boolean(parsed.currentFocus);

        if (isProfileComplete) {
          setProfile(parsed);
          setTopic(parsed.currentFocus || "general");
          setLanguage(parsed.preferredLanguage || "same");
        } else {
          setProfile(null);
        }
      } catch {
        setProfile(null);
      }
    }

    setProfileChecked(true);
  }, []);

  useEffect(() => {
    if (!loading) {
      setCurrentLoadingStep(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentLoadingStep((prev) => {
        if (prev >= loadingSteps.length - 1) return prev;
        return prev + 1;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [loading]);

  async function handleAsk() {
    if (!question.trim()) return;

    if (!profile) {
      setAnswer("Please complete your SoulLoop profile before asking.");
      return;
    }

    setLoading(true);
    setAnswer("");
    setCurrentLoadingStep(0);

    try {
      const response = await fetch("/api/demo-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          question,
          language,
          tone,
          depth,
          profile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAnswer(data.error || "Something went wrong.");
        return;
      }

      setAnswer(data.answer);
    } catch {
      setAnswer("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const examples = [
    "Will my ex come back?",
    "Should I change my job?",
    "What is my energy this week?",
    "Why do I feel stuck lately?",
  ];

  const progressPercent = useMemo(() => {
    return Math.round(((currentLoadingStep + 1) / loadingSteps.length) * 100);
  }, [currentLoadingStep]);

  if (!profileChecked) {
    return (
      <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
        <section className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-white/60">Checking your SoulLoop profile...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
        <section className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm text-white/50">
            ← Back to Home
          </Link>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="mb-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
              Profile Required
            </p>

            <h1 className="text-4xl font-bold">
              Set up your SoulLoop profile first
            </h1>

            <p className="mt-4 leading-8 text-white/60">
              SoulLoop uses your profile to personalize symbolic readings.
              Please complete your basic profile before using Chat.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/profile"
                className="rounded-full bg-white px-8 py-4 text-center font-semibold text-black"
              >
                Set Up Profile
              </Link>

              <Link
                href="/"
                className="rounded-full border border-white/20 px-8 py-4 text-center font-semibold text-white"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm text-white/50">
          ← Back to Home
        </Link>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <h1 className="text-5xl font-bold md:text-6xl">Ask SoulLoop</h1>

            <p className="mt-4 max-w-2xl text-lg leading-8 text-white/60">
              Ask your question. SoulLoop will shape the reading with your saved
              profile and symbolic Eastern wisdom lens.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.18em] text-white/35">
                Profile Summary
              </p>

              <Link href="/profile" className="text-sm text-white/70 underline">
                Edit
              </Link>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-white/40">Focus</span>
                <span className="text-right text-white/75">
                  {focusLabels[profile.currentFocus] || profile.currentFocus}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/40">Birth</span>
                <span className="text-right text-white/75">
                  {profile.birthDate}
                  {profile.birthTime ? ` · ${profile.birthTime}` : ""}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/40">Place</span>
                <span className="text-right text-white/75">
                  {profile.birthPlace || "Not provided"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/40">Relationship</span>
                <span className="text-right text-white/75">
                  {profile.relationshipStatus
                    ? relationshipLabels[profile.relationshipStatus] ||
                      profile.relationshipStatus
                    : "Not provided"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/40">Career</span>
                <span className="text-right text-white/75">
                  {profile.careerStatus
                    ? careerLabels[profile.careerStatus] ||
                      profile.careerStatus
                    : "Not provided"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/40">Language</span>
                <span className="text-right text-white/75">
                  {languageLabels[profile.preferredLanguage] ||
                    profile.preferredLanguage}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-6">
          <p className="mb-4 text-lg font-medium text-white/80">
            What would you like to ask?
          </p>

          <div className="mb-5 flex flex-wrap gap-3">
            {examples.map((item) => (
              <button
                key={item}
                onClick={() => setQuestion(item)}
                className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
              >
                {item}
              </button>
            ))}
          </div>

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question here..."
            className="min-h-44 w-full resize-none rounded-[28px] border border-white/10 bg-black/20 p-5 text-lg text-white outline-none placeholder:text-white/30"
          />

          <button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            className="mt-5 rounded-full bg-white px-10 py-4 text-lg font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Calculating Reading..." : "Generate Reading"}
          </button>
        </div>

        {loading && (
          <div className="mt-8 rounded-[32px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                  SoulLoop Reading Engine
                </div>

                <h2 className="mt-4 text-3xl font-bold">
                  命理解读演算中
                </h2>

                <p className="mt-3 max-w-2xl leading-7 text-white/60">
                  正在融合你的个人档案、问题主题、八卦象征、五行脉络与紫微主题，生成本次解读。
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5 md:w-[300px]">
                <p className="text-sm uppercase tracking-[0.18em] text-white/35">
                  Current Stage
                </p>

                <div className="mt-4 flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                    {loadingSteps[currentLoadingStep].icon}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold">
                      {loadingSteps[currentLoadingStep].title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-white/55">
                      {loadingSteps[currentLoadingStep].description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex justify-between text-sm text-white/45">
                <span>Reading Progress</span>
                <span>{progressPercent}%</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white transition-all duration-700"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-5">
              {loadingSteps.map((step, index) => {
                const isDone = index < currentLoadingStep;
                const isActive = index === currentLoadingStep;

                return (
                  <div
                    key={step.title}
                    className={`rounded-2xl border p-3 text-sm ${
                      isActive
                        ? "border-white/20 bg-white/10"
                        : isDone
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                        : "border-white/10 bg-black/15 text-white/45"
                    }`}
                  >
                    <div className="mb-2 text-lg">
                      {isDone ? "✓" : step.icon}
                    </div>
                    <p className="font-medium">{step.title}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {answer && !loading && (
          <div className="mt-8 rounded-[32px] border border-white/10 bg-white/5 p-8 leading-8 text-white/80">
            <div className="mb-4 text-sm uppercase tracking-[0.2em] text-white/40">
              SoulLoop Reading
            </div>

            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h2 className="mb-4 mt-8 text-2xl font-bold text-white first:mt-0">
                    {children}
                  </h2>
                ),
                h2: ({ children }) => (
                  <h3 className="mb-3 mt-6 text-xl font-semibold text-white">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="mb-5 text-lg leading-8 text-white/75">
                    {children}
                  </p>
                ),
                li: ({ children }) => (
                  <li className="mb-2 ml-4 list-disc text-lg text-white/75">
                    {children}
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-white">
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="text-white/90">{children}</em>
                ),
              }}
            >
              {answer}
            </ReactMarkdown>
          </div>
        )}

        <p className="mt-8 text-sm text-white/40">
          SoulLoop is for entertainment and self-reflection only.
        </p>
      </section>
    </main>
  );
}