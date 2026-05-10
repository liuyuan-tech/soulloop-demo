"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

const defaultProfile: SoulLoopProfile = {
  birthDate: "",
  birthTime: "",
  birthPlace: "",
  gender: "",
  currentFocus: "self_growth",
  relationshipStatus: "",
  careerStatus: "",
  preferredLanguage: "same",
};

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
  same: "Same as my question",
  english: "English",
  chinese: "中文",
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<SoulLoopProfile>(defaultProfile);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("soulloop_profile");

    if (stored) {
      try {
        setProfile(JSON.parse(stored));
      } catch {
        setProfile(defaultProfile);
      }
    }
  }, []);

  const completionItems = useMemo(
    () => [
      Boolean(profile.birthDate),
      Boolean(profile.currentFocus),
      Boolean(profile.preferredLanguage),
      Boolean(profile.relationshipStatus || profile.careerStatus),
    ],
    [profile]
  );

  const completionPercent = useMemo(() => {
    const completed = completionItems.filter(Boolean).length;
    return Math.round((completed / completionItems.length) * 100);
  }, [completionItems]);

  function updateProfile(field: keyof SoulLoopProfile, value: string) {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSaved(false);
    setError("");
  }

  function saveProfile() {
    if (!profile.birthDate) {
      setError("Please enter your birth date before continuing.");
      return;
    }

    if (!profile.currentFocus) {
      setError("Please choose your current focus before continuing.");
      return;
    }

    localStorage.setItem("soulloop_profile", JSON.stringify(profile));
    setSaved(true);
    setError("");

    setTimeout(() => {
      router.push("/chat");
    }, 700);
  }

  function clearProfile() {
    localStorage.removeItem("soulloop_profile");
    setProfile(defaultProfile);
    setSaved(false);
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-12 text-white">
      <section className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-white/50">
          ← Back to Home
        </Link>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
              SoulLoop Profile
            </p>

            <h1 className="max-w-3xl text-5xl font-bold leading-tight md:text-6xl">
              Set up your symbolic profile first
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">
              SoulLoop uses your profile to personalize your readings before you
              enter the question experience. Your profile is stored locally in
              this browser during the MVP stage.
            </p>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                    Profile Completion
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {completionPercent}% ready
                  </p>
                </div>

                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/20 text-lg font-bold">
                  {completionPercent}%
                </div>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>

              <p className="mt-4 text-sm leading-6 text-white/50">
                Required fields: Birth Date and Current Focus. Optional fields
                improve personalization but are not required.
              </p>
            </div>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                How SoulLoop uses your profile
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {[
                  [
                    "Birth date",
                    "Used as a symbolic timing reference for rhythm, life phase, and personal context. SoulLoop does not calculate a real BaZi or Zi Wei chart in this MVP.",
                  ],
                  [
                    "Current focus",
                    "Used to select the main reading lens, such as love, career, money, decision-making, or self-growth.",
                  ],
                  [
                    "Relationship / career status",
                    "Used to make guidance feel more grounded in your real situation instead of giving generic advice.",
                  ],
                  [
                    "Preferred language",
                    "Used to decide whether SoulLoop replies in English, Chinese, or the same language as your question.",
                  ],
                ].map(([title, text]) => (
                  <div
                    key={title}
                    className="rounded-3xl border border-white/10 bg-black/20 p-5"
                  >
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="mt-3 text-sm leading-7 text-white/55">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
            <div className="grid gap-5">
              <div>
                <label className="mb-3 block text-sm font-medium text-white/70">
                  Birth Date required
                </label>
                <input
                  type="date"
                  value={profile.birthDate}
                  onChange={(e) => updateProfile("birthDate", e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
                />
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-white/70">
                  Birth Time optional
                </label>
                <input
                  type="time"
                  value={profile.birthTime}
                  onChange={(e) => updateProfile("birthTime", e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
                />
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-white/70">
                  Birth Place optional
                </label>
                <input
                  type="text"
                  value={profile.birthPlace}
                  onChange={(e) => updateProfile("birthPlace", e.target.value)}
                  placeholder="e.g. Shanghai, Tokyo, San Francisco"
                  className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-white/70">
                  Gender optional
                </label>
                <select
                  value={profile.gender}
                  onChange={(e) => updateProfile("gender", e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-white/70">
                  Current Focus required
                </label>
                <select
                  value={profile.currentFocus}
                  onChange={(e) =>
                    updateProfile("currentFocus", e.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
                >
                  <option value="love">Love / Relationship</option>
                  <option value="career">Career</option>
                  <option value="money">Money</option>
                  <option value="daily_energy">Daily Energy</option>
                  <option value="decision">Decision</option>
                  <option value="self_growth">Self-Growth</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-white/70">
                  Relationship Status optional
                </label>
                <select
                  value={profile.relationshipStatus}
                  onChange={(e) =>
                    updateProfile("relationshipStatus", e.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="single">Single</option>
                  <option value="dating">Dating</option>
                  <option value="in_relationship">In a relationship</option>
                  <option value="complicated">Complicated</option>
                  <option value="married">Married</option>
                  <option value="separated">Separated</option>
                </select>
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-white/70">
                  Career Status optional
                </label>
                <select
                  value={profile.careerStatus}
                  onChange={(e) =>
                    updateProfile("careerStatus", e.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="student">Student</option>
                  <option value="employed">Employed</option>
                  <option value="founder">Founder / Entrepreneur</option>
                  <option value="freelancer">Freelancer</option>
                  <option value="job_seeking">Job seeking</option>
                  <option value="transition">In transition</option>
                </select>
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-white/70">
                  Preferred Language
                </label>
                <select
                  value={profile.preferredLanguage}
                  onChange={(e) =>
                    updateProfile("preferredLanguage", e.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
                >
                  <option value="same">Same as my question</option>
                  <option value="english">English</option>
                  <option value="chinese">中文</option>
                </select>
              </div>
            </div>

            <div className="mt-7 rounded-[28px] border border-white/10 bg-black/20 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                Profile Preview
              </p>

              <div className="mt-4 grid gap-3 text-sm text-white/65">
                <div className="flex justify-between gap-4">
                  <span className="text-white/40">Birth Date</span>
                  <span>{profile.birthDate || "Not provided"}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-white/40">Birth Time</span>
                  <span>{profile.birthTime || "Optional"}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-white/40">Birth Place</span>
                  <span>{profile.birthPlace || "Optional"}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-white/40">Focus</span>
                  <span>
                    {focusLabels[profile.currentFocus] || profile.currentFocus}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-white/40">Relationship</span>
                  <span>
                    {profile.relationshipStatus
                      ? relationshipLabels[profile.relationshipStatus] ||
                        profile.relationshipStatus
                      : "Optional"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-white/40">Career</span>
                  <span>
                    {profile.careerStatus
                      ? careerLabels[profile.careerStatus] ||
                        profile.careerStatus
                      : "Optional"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-white/40">Language</span>
                  <span>
                    {languageLabels[profile.preferredLanguage] ||
                      profile.preferredLanguage}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            {saved && (
              <div className="mt-5 rounded-2xl border border-green-400/20 bg-green-400/10 p-4 text-sm text-green-200">
                Profile saved. Entering SoulLoop...
              </div>
            )}

            <div className="mt-7 flex flex-col gap-4">
              <button
                onClick={saveProfile}
                className="rounded-full bg-white px-8 py-4 font-semibold text-black"
              >
                Save & Enter SoulLoop
              </button>

              <button
                onClick={clearProfile}
                className="rounded-full border border-white/20 px-8 py-4 font-semibold text-white"
              >
                Clear Profile
              </button>

              <Link
                href="/"
                className="rounded-full border border-white/20 px-8 py-4 text-center font-semibold text-white"
              >
                Back to Home
              </Link>
            </div>

            <p className="mt-6 text-sm leading-6 text-white/40">
              Other public pages can be viewed without a profile, but SoulLoop
              readings require this setup step.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}