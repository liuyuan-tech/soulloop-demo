"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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

const genderLabels: Record<string, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  other: "Other",
};

const years = Array.from({ length: 201 }, (_, index) => String(1900 + index));
const months = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0")
);
const days = Array.from({ length: 31 }, (_, index) =>
  String(index + 1).padStart(2, "0")
);

function splitBirthDate(birthDate: string) {
  if (!birthDate) {
    return {
      year: "",
      month: "",
      day: "",
    };
  }

  const [year, month, day] = birthDate.split("-");

  return {
    year: year || "",
    month: month || "",
    day: day || "",
  };
}

function buildBirthDate(year: string, month: string, day: string) {
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function isValidBirthDate(birthDate: string) {
  if (!birthDate) return false;

  const [yearText, monthText, dayText] = birthDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function validateProfile(profile: SoulLoopProfile) {
  if (!profile.birthDate) return "Please select your birth date.";
  if (!isValidBirthDate(profile.birthDate)) {
    return "Please select a valid birth date.";
  }
  if (!profile.birthTime) return "Please enter your birth time.";
  if (!profile.gender) return "Please select your gender.";
  if (!profile.currentFocus) return "Please choose your current focus.";
  if (!profile.relationshipStatus)
    return "Please select your relationship status.";
  if (!profile.preferredLanguage) return "Please select your preferred language.";

  return "";
}

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<SoulLoopProfile>(defaultProfile);
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setPageLoading(true);
      setError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          setError(`Session error: ${sessionError.message}`);
          setPageLoading(false);
          return;
        }

        const user = session?.user;

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);
        setEmail(user.email || "");

        const { data, error } = await supabase
          .from("profiles")
          .select(
            "birth_date,birth_time,birth_place,gender,current_focus,relationship_status,career_status,preferred_language,credits_balance"
          )
          .eq("id", user.id)
          .single();

        if (error) {
          setError(`Profile load error: ${error.message}`);
          setPageLoading(false);
          return;
        }

        if (data) {
          const loadedProfile: SoulLoopProfile = {
            birthDate: data.birth_date || "",
            birthTime: data.birth_time || "",
            birthPlace: data.birth_place || "",
            gender: data.gender || "",
            currentFocus: data.current_focus || "self_growth",
            relationshipStatus: data.relationship_status || "",
            careerStatus: data.career_status || "",
            preferredLanguage: data.preferred_language || "same",
          };

          setProfile(loadedProfile);

          const dateParts = splitBirthDate(loadedProfile.birthDate);
          setBirthYear(dateParts.year);
          setBirthMonth(dateParts.month);
          setBirthDay(dateParts.day);

          setCreditsBalance(
            typeof data.credits_balance === "number"
              ? data.credits_balance
              : null
          );
        }

        setPageLoading(false);
      } catch (error) {
        console.error("LOAD_PROFILE_ERROR:", error);

        setError(
          error instanceof Error
            ? `Failed to load profile: ${error.message}`
            : "Failed to load profile. Please check your Supabase connection."
        );

        setPageLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const completionItems = useMemo(
    () => [
      Boolean(profile.birthDate && isValidBirthDate(profile.birthDate)),
      Boolean(profile.birthTime),
      Boolean(profile.gender),
      Boolean(profile.currentFocus),
      Boolean(profile.relationshipStatus),
      Boolean(profile.preferredLanguage),
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

  function updateBirthDate(part: "year" | "month" | "day", value: string) {
    const nextYear = part === "year" ? value : birthYear;
    const nextMonth = part === "month" ? value : birthMonth;
    const nextDay = part === "day" ? value : birthDay;

    setBirthYear(nextYear);
    setBirthMonth(nextMonth);
    setBirthDay(nextDay);

    const nextBirthDate = buildBirthDate(nextYear, nextMonth, nextDay);

    setProfile((prev) => ({
      ...prev,
      birthDate: nextBirthDate,
    }));

    setSaved(false);
    setError("");
  }

  async function saveProfile() {
    if (!userId) {
      setError("Please log in before saving your profile.");
      return;
    }

    const validationError = validateProfile(profile);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          birth_date: profile.birthDate,
          birth_time: profile.birthTime,
          birth_place: profile.birthPlace || null,
          gender: profile.gender,
          current_focus: profile.currentFocus,
          relationship_status: profile.relationshipStatus,
          career_status: profile.careerStatus || null,
          preferred_language: profile.preferredLanguage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        setError(`Profile save error: ${error.message}`);
        return;
      }

      setSaved(true);

      setTimeout(() => {
        router.push("/chat");
      }, 700);
    } catch (error) {
      console.error("SAVE_PROFILE_ERROR:", error);

      setError(
        error instanceof Error
          ? `Failed to save profile: ${error.message}`
          : "Failed to save profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
        <section className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-white/60">Loading your SoulLoop profile...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-12 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-white/50">
            ← Back to Home
          </Link>

          <button
            onClick={handleLogout}
            className="text-sm text-white/50 underline"
          >
            Log out
          </button>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
              SoulLoop Profile
            </p>

            <h1 className="max-w-3xl text-5xl font-bold leading-tight md:text-6xl">
              Complete your symbolic profile
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">
              SoulLoop uses your required profile fields to personalize your
              symbolic reading. Your account stores your profile, credits, and
              reading history across devices.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                <p className="text-white/35">Signed in as</p>
                <p className="mt-1 break-all text-white">{email}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                <p className="text-white/35">Credits Balance</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {creditsBalance === null ? "—" : creditsBalance}
                </p>
              </div>
            </div>

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
                Required fields: Birth Date, Birth Time, Gender, Current Focus,
                Relationship Status, and Preferred Language.
              </p>
            </div>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                How SoulLoop uses your profile
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {[
                  [
                    "Birth date & time",
                    "Used as symbolic timing context for rhythm, life phase, and personal reference.",
                  ],
                  [
                    "Gender",
                    "Used only to personalize wording and context. SoulLoop does not make deterministic claims from gender.",
                  ],
                  [
                    "Current focus",
                    "Used to select the main reading lens, such as love, career, money, decision-making, or self-growth.",
                  ],
                  [
                    "Relationship status",
                    "Used to make emotional and practical guidance more grounded in your current situation.",
                  ],
                  [
                    "Preferred language",
                    "Used to decide whether SoulLoop replies in English, Chinese, or the same language as your question.",
                  ],
                  [
                    "Birth place / career status",
                    "Optional fields that can make your reading feel more contextual, but they are not required.",
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

                <div className="grid grid-cols-3 gap-3">
                  <select
                    value={birthYear}
                    onChange={(e) => updateBirthDate("year", e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
                  >
                    <option value="">Year</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  <select
                    value={birthMonth}
                    onChange={(e) => updateBirthDate("month", e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
                  >
                    <option value="">Month</option>
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>

                  <select
                    value={birthDay}
                    onChange={(e) => updateBirthDate("day", e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
                  >
                    <option value="">Day</option>
                    {days.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                {profile.birthDate && !isValidBirthDate(profile.birthDate) && (
                  <p className="mt-3 text-sm text-red-200">
                    Please select a valid calendar date.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-white/70">
                  Birth Time required
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
                  Gender required
                </label>
                <select
                  value={profile.gender}
                  onChange={(e) => updateProfile("gender", e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
                >
                  <option value="">Select gender</option>
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
                  Relationship Status required
                </label>
                <select
                  value={profile.relationshipStatus}
                  onChange={(e) =>
                    updateProfile("relationshipStatus", e.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
                >
                  <option value="">Select relationship status</option>
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
                  onChange={(e) => updateProfile("careerStatus", e.target.value)}
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
                  Preferred Language required
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
                  <span>{profile.birthDate || "Required"}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-white/40">Birth Time</span>
                  <span>{profile.birthTime || "Required"}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-white/40">Birth Place</span>
                  <span>{profile.birthPlace || "Optional"}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-white/40">Gender</span>
                  <span>{genderLabels[profile.gender] || "Required"}</span>
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
                      : "Required"}
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
                      profile.preferredLanguage ||
                      "Required"}
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
                disabled={saving}
                className="rounded-full bg-white px-8 py-4 font-semibold text-black disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save & Enter SoulLoop"}
              </button>

              <Link
                href="/"
                className="rounded-full border border-white/20 px-8 py-4 text-center font-semibold text-white"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}