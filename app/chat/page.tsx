"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabase/client";
import {
  getReadingMode,
  getReadingTopic,
  normalizeReadingTopic,
  READING_MODES,
  READING_TOPICS,
  type ReadingModeId,
  type ReadingTopicId,
} from "@/lib/readings/options";

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

type SymbolicLens = {
  topic: string;
  readingMode?: ReadingModeId;
  modeLabel?: string;
  bagua: string[];
  elements: string[];
  ziwei: string[];
  modeMarkers?: string[];
  crossValidation?: string[];
  focus: string;
  interpretation: string;
};

type LoadingStep = {
  title: string;
  description: string;
  icon: string;
};

type InsufficientCreditsState = {
  currentCredits: number;
  requiredCredits: number;
  message: string;
};

type EntitlementsResponse = {
  ownedModes?: ReadingModeId[];
  error?: string;
  code?: string;
};

const loadingSteps: LoadingStep[] = [
  {
    icon: "子",
    title: "读取个人档案",
    description: "载入你的出生信息、当前关注领域与个人语境。",
  },
  {
    icon: "辰",
    title: "校准出生时辰",
    description: "将生日、时辰与问题放进同一个时间参照里。",
  },
  {
    icon: "☰",
    title: "排布八卦象意",
    description: "观察问题里的动静、进退、关系张力与时机感。",
  },
  {
    icon: "金",
    title: "比对五行强弱",
    description: "整理木、火、土、金、水之间的象征平衡。",
  },
  {
    icon: "验",
    title: "交叉验证结论",
    description: "把所选玩法、历史语境与今日行动建议合并校验。",
  },
];

const loadingStepDelays = [720, 1680, 940, 2160, 1280];

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

const languageLabels: Record<string, string> = {
  same: "Same as question",
  english: "English",
  chinese: "中文",
};

const genderLabels: Record<string, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  other: "Other",
};

function isProfileComplete(profile: SoulLoopProfile | null) {
  if (!profile) return false;

  return Boolean(
    profile.birthDate &&
      profile.birthTime &&
      profile.gender &&
      profile.currentFocus &&
      profile.relationshipStatus &&
      profile.preferredLanguage
  );
}

export default function ChatPage() {
  const [topic, setTopic] = useState<ReadingTopicId>("self");
  const [readingMode, setReadingMode] =
    useState<ReadingModeId>("eastern_wisdom");
  const [language, setLanguage] = useState("same");
  const [tone] = useState("premium-balanced");
  const [depth] = useState("standard");

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [lens, setLens] = useState<SymbolicLens | null>(null);
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState<SoulLoopProfile | null>(null);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [entitlementNotice, setEntitlementNotice] = useState("");
  const [ownedModes, setOwnedModes] = useState<ReadingModeId[]>([
    "eastern_wisdom",
  ]);
  const [insufficientCredits, setInsufficientCredits] =
    useState<InsufficientCreditsState | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setProfileChecked(false);
      setError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          setError(`Session error: ${sessionError.message}`);
          setProfileChecked(true);
          return;
        }

        const user = session?.user;

        if (!user) {
          setProfileChecked(true);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select(
            "birth_date,birth_time,birth_place,gender,current_focus,relationship_status,career_status,preferred_language,credits_balance"
          )
          .eq("id", user.id)
          .single();

        if (error) {
          setError(`Profile load error: ${error.message}`);
          setProfileChecked(true);
          return;
        }

        const mappedProfile: SoulLoopProfile = {
          birthDate: data.birth_date || "",
          birthTime: data.birth_time || "",
          birthPlace: data.birth_place || "",
          gender: data.gender || "",
          currentFocus: data.current_focus || "",
          relationshipStatus: data.relationship_status || "",
          careerStatus: data.career_status || "",
          preferredLanguage: data.preferred_language || "",
        };

        if (isProfileComplete(mappedProfile)) {
          setProfile(mappedProfile);
          setTopic(normalizeReadingTopic(mappedProfile.currentFocus));
          setLanguage(mappedProfile.preferredLanguage || "same");
          setCreditsBalance(
            typeof data.credits_balance === "number"
              ? data.credits_balance
              : null
          );

          const entitlementsResponse = await fetch(
            "/api/reading-modes/entitlements",
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );

          const entitlementsData =
            (await entitlementsResponse.json().catch(() => ({}))) as
              | EntitlementsResponse
              | Record<string, never>;

          if (Array.isArray(entitlementsData.ownedModes)) {
            setOwnedModes(entitlementsData.ownedModes);
          }

          if (entitlementsData.code) {
            setEntitlementNotice(
              "Paid mode unlocks need the latest Supabase migration before they can be used."
            );
          }
        } else {
          setProfile(null);
        }

        setProfileChecked(true);
      } catch (error) {
        console.error("CHAT_LOAD_PROFILE_ERROR:", error);

        setError(
          error instanceof Error
            ? `Failed to load profile: ${error.message}`
            : "Failed to load profile."
        );

        setProfileChecked(true);
      }
    }

    loadProfile();
  }, []);

  useEffect(() => {
    if (!loading) return;

    const delay = loadingStepDelays[currentLoadingStep] || 1200;
    const timeout = window.setTimeout(() => {
      setCurrentLoadingStep((prev) => {
        if (prev >= loadingSteps.length - 1) return prev;
        return prev + 1;
      });
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [currentLoadingStep, loading]);

  const selectedTopic = useMemo(() => getReadingTopic(topic), [topic]);
  const selectedMode = useMemo(() => getReadingMode(readingMode), [readingMode]);
  const selectedReadingCost = selectedMode.creditCost;
  const selectedModeOwned =
    readingMode === "eastern_wisdom" || ownedModes.includes(readingMode);

  async function handleAsk() {
    if (!question.trim()) return;

    if (!profile || !isProfileComplete(profile)) {
      setAnswer("Please complete your SoulLoop profile before asking.");
      return;
    }

    if (!selectedModeOwned) {
      setEntitlementNotice(
        `${selectedMode.label} is locked. Unlock it once for ${selectedMode.unlockCost} credits on the Credits page, then each reading in this mode costs ${selectedReadingCost} credits.`
      );
      return;
    }

    setLoading(true);
    setAnswer("");
    setLens(null);
    setError("");
    setInsufficientCredits(null);
    setCurrentLoadingStep(0);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        setAnswer("Please log in before generating a reading.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/demo-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          topic,
          readingMode,
          question,
          language,
          tone,
          depth,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "INSUFFICIENT_CREDITS") {
          const currentCredits =
            typeof data.remainingCredits === "number"
              ? data.remainingCredits
              : creditsBalance ?? 0;

          setCreditsBalance(currentCredits);
          setInsufficientCredits({
            currentCredits,
            requiredCredits: selectedReadingCost,
            message:
              data.error ||
              `Not enough credits. This ${selectedMode.label} reading costs ${selectedReadingCost} credits.`,
          });

          setAnswer("");
          return;
        }

        if (data.code === "READING_MODE_LOCKED") {
          setEntitlementNotice(
            data.error ||
              `${selectedMode.label} is locked. Unlock it on the Credits page.`
          );
          setAnswer("");
          return;
        }

        if (data.code === "READING_MODE_ENTITLEMENTS_UNAVAILABLE") {
          setEntitlementNotice(
            data.error ||
              "Paid mode unlocks need the latest Supabase migration before they can be used."
          );
          setAnswer("");
          return;
        }

        setAnswer(data.error || "Something went wrong.");
        return;
      }

      setAnswer(data.answer);
      setLens(data.lens || null);

      if (typeof data.remainingCredits === "number") {
        setCreditsBalance(data.remainingCredits);
      }
    } catch (error) {
      console.error("CHAT_REQUEST_ERROR:", error);
      setAnswer("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const examples = selectedTopic.examples;

  const progressPercent = useMemo(() => {
    return Math.round(((currentLoadingStep + 1) / loadingSteps.length) * 100);
  }, [currentLoadingStep]);

  const readingsLeft = useMemo(() => {
    if (typeof creditsBalance !== "number") return null;
    return Math.floor(creditsBalance / selectedReadingCost);
  }, [creditsBalance, selectedReadingCost]);

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
              Complete your SoulLoop profile first
            </h1>

            <p className="mt-4 leading-8 text-white/60">
              Birth Date, Birth Time, Gender, Current Focus, Relationship
              Status, and Preferred Language are required before using Chat.
            </p>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/profile"
                className="rounded-full bg-white px-8 py-4 text-center font-semibold text-black"
              >
                Complete Profile
              </Link>

              <Link
                href="/login"
                className="rounded-full border border-white/20 px-8 py-4 text-center font-semibold text-white"
              >
                Log In
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
              Ask a life question through SoulLoop&apos;s self-discovery modes:
              Eastern Wisdom by default, or enhanced Tarot, Color Personality,
              and Daily Loop packs.
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
                <span className="text-white/40">Credits</span>
                <span className="text-right font-semibold text-white">
                  {creditsBalance === null ? "—" : creditsBalance}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/40">Readings left</span>
                <span className="text-right font-semibold text-white">
                  {readingsLeft === null ? "—" : readingsLeft}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/40">Focus</span>
                <span className="text-right text-white/75">
                  {focusLabels[profile.currentFocus] || profile.currentFocus}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/40">Birth</span>
                <span className="text-right text-white/75">
                  {profile.birthDate} · {profile.birthTime}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/40">Gender</span>
                <span className="text-right text-white/75">
                  {genderLabels[profile.gender] || profile.gender}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/40">Relationship</span>
                <span className="text-right text-white/75">
                  {relationshipLabels[profile.relationshipStatus] ||
                    profile.relationshipStatus}
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

            <Link
              href="/credits"
              className="mt-5 block rounded-full border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white"
            >
              Buy Credits
            </Link>
          </div>
        </div>

        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                Question Theme
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {selectedTopic.label}
              </h2>
            </div>

            <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/60">
              {selectedMode.label} · {selectedReadingCost} credits
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {READING_TOPICS.map((item) => {
              const active = topic === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTopic(item.id);
                    setInsufficientCredits(null);
                  }}
                  aria-pressed={active}
                  className={`min-h-24 rounded-3xl border p-4 text-left transition ${
                    active
                      ? "border-white/40 bg-white text-black"
                      : "border-white/10 bg-black/20 text-white hover:bg-white/10"
                  }`}
                >
                  <span className="text-lg font-semibold">{item.label}</span>
                  <span
                    className={`mt-2 block text-sm leading-6 ${
                      active ? "text-black/60" : "text-white/50"
                    }`}
                  >
                    {item.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-[28px] border border-white/10 bg-black/20 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                  Reading Mode
                </p>
                <p className="mt-2 text-white/65">
                  Eastern Wisdom is included. Paid packs add a second symbolic
                  lens, stronger prompt structure, and a one-time unlock before
                  per-reading usage starts.
                </p>
              </div>

              <Link href="/credits" className="text-sm text-white/60 underline">
                Manage credits & packs
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {READING_MODES.map((item) => {
                const active = readingMode === item.id;
                const owned =
                  item.id === "eastern_wisdom" || ownedModes.includes(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setReadingMode(item.id);
                      setEntitlementNotice(
                        owned
                          ? ""
                          : `${item.label} is locked. Unlock it once for ${item.unlockCost} credits, then pay ${item.creditCost} credits per reading.`
                      );
                      setInsufficientCredits(null);
                    }}
                    aria-pressed={active}
                    className={`min-h-36 rounded-3xl border p-4 text-left transition ${
                      active
                        ? "border-emerald-200/50 bg-emerald-200/15 text-white"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{item.label}</span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          owned
                            ? "bg-white text-black"
                            : "border border-white/15 text-white/65"
                        }`}
                      >
                        {owned ? "Unlocked" : item.status}
                      </span>
                    </span>
                    <span className="mt-3 block text-sm leading-6 text-white/55">
                      {item.description}
                    </span>
                    {!owned && (
                      <span className="mt-3 block text-sm text-amber-100">
                        Unlock once: {item.unlockCost} credits
                      </span>
                    )}
                    <span className="mt-3 block text-sm font-semibold text-white/85">
                      {item.creditCost} credits per reading
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {entitlementNotice && (
            <div className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{entitlementNotice}</span>
                <Link
                  href="/credits"
                  className="shrink-0 rounded-full bg-white px-4 py-2 text-center font-semibold text-black"
                >
                  Open Credits
                </Link>
              </div>
            </div>
          )}

          <p className="mt-6 mb-4 text-lg font-medium text-white/80">
            What would you like to ask?
          </p>

          <div className="mb-5 flex flex-wrap gap-3">
            {examples.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setQuestion(item);
                  setInsufficientCredits(null);
                }}
                className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
              >
                {item}
              </button>
            ))}
          </div>

          <textarea
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setInsufficientCredits(null);
            }}
            placeholder="Type your question here..."
            className="min-h-44 w-full resize-none rounded-[28px] border border-white/10 bg-black/20 p-5 text-lg text-white outline-none placeholder:text-white/30"
          />

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleAsk}
              disabled={loading || !question.trim() || !selectedModeOwned}
              className="rounded-full bg-white px-10 py-4 text-lg font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Calculating Reading..."
                : selectedModeOwned
                  ? "Generate Reading"
                  : "Unlock Pack First"}
            </button>

            <p className="text-sm text-white/40">
              {selectedMode.label} costs {selectedReadingCost} credits per
              reading.
            </p>
          </div>
        </div>

        {insufficientCredits && !loading && (
          <div className="mt-8 rounded-[32px] border border-amber-300/20 bg-amber-300/10 p-6">
            <p className="mb-3 inline-block rounded-full border border-amber-200/20 px-4 py-2 text-sm text-amber-100">
              Not enough credits
            </p>

            <h2 className="text-3xl font-bold text-white">
              You need more credits to continue
            </h2>

            <p className="mt-4 max-w-2xl leading-8 text-white/65">
              {insufficientCredits.message}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-white/40">Current Balance</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {insufficientCredits.currentCredits}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-white/40">Required</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {insufficientCredits.requiredCredits}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-white/40">Readings Left</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {Math.floor(
                    insufficientCredits.currentCredits /
                      insufficientCredits.requiredCredits
                  )}
                </p>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/credits"
                className="rounded-full bg-white px-8 py-4 text-center font-semibold text-black"
              >
                Buy Credits
              </Link>

              <Link
                href="/history"
                className="rounded-full border border-white/20 px-8 py-4 text-center font-semibold text-white"
              >
                View Previous Readings
              </Link>
            </div>
          </div>
        )}

        {loading && (
          <div className="mt-8 rounded-[32px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                  SoulLoop Reading Engine
                </div>

                <h2 className="mt-4 text-3xl font-bold">
                  正在进行分段推演
                </h2>

                <p className="mt-3 max-w-2xl leading-7 text-white/60">
                  推演节奏会根据阶段自然停顿，避免把八字、八卦与五行分析伪装成机械匀速输出。
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
          </div>
        )}

        {lens && !loading && (
          <div className="mt-8 rounded-[32px] border border-white/10 bg-white/5 p-6">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                  SoulLoop Symbolic Lens
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  {lens.topic}
                </h2>
              </div>

              <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/60">
                {lens.modeLabel || selectedMode.label}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="mb-3 text-sm uppercase tracking-[0.18em] text-white/35">
                  Bagua Lens
                </p>
                <div className="flex flex-wrap gap-2">
                  {lens.bagua.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/75"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="mb-3 text-sm uppercase tracking-[0.18em] text-white/35">
                  Five Elements
                </p>
                <div className="flex flex-wrap gap-2">
                  {lens.elements.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/75"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="mb-3 text-sm uppercase tracking-[0.18em] text-white/35">
                  Zi Wei Themes
                </p>
                <div className="flex flex-wrap gap-2">
                  {lens.ziwei.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/75"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="mb-3 text-sm uppercase tracking-[0.18em] text-white/35">
                  Mode Markers
                </p>
                <div className="flex flex-wrap gap-2">
                  {(lens.modeMarkers || []).map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/75"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-white/35">
                Reading Focus
              </p>
              <p className="mt-3 leading-7 text-white/70">{lens.focus}</p>
              <p className="mt-3 text-sm leading-7 text-white/45">
                {lens.interpretation}
              </p>
            </div>

            {!!lens.crossValidation?.length && (
              <div className="mt-4 rounded-3xl border border-emerald-200/10 bg-emerald-200/5 p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-white/35">
                  Cross-Validation
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {lens.crossValidation.map((item) => (
                    <p
                      key={item}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/60"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            )}
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
