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

type Choice = {
  value: string;
  label: string;
  hint?: string;
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

const genderChoices: Choice[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "other", label: "Other" },
];

const focusChoices: Choice[] = [
  { value: "love", label: "Love", hint: "恋爱、吸引、亲密关系" },
  { value: "career", label: "Career", hint: "方向、机会、工作节奏" },
  { value: "money", label: "Money", hint: "财富、风险、资源管理" },
  { value: "decision", label: "Decision", hint: "选择、时机、下一步" },
  { value: "self_growth", label: "Self", hint: "自我、习惯、内在模式" },
  { value: "relationship", label: "Relationship", hint: "沟通、边界、修复" },
];

const relationshipChoices: Choice[] = [
  { value: "single", label: "Single" },
  { value: "dating", label: "Dating" },
  { value: "in_relationship", label: "In relationship" },
  { value: "complicated", label: "Complicated" },
  { value: "married", label: "Married" },
  { value: "separated", label: "Separated" },
];

const careerChoices: Choice[] = [
  { value: "", label: "Prefer not to say" },
  { value: "student", label: "Student" },
  { value: "employed", label: "Employed" },
  { value: "founder", label: "Founder" },
  { value: "freelancer", label: "Freelancer" },
  { value: "job_seeking", label: "Job seeking" },
  { value: "transition", label: "In transition" },
];

const languageChoices: Choice[] = [
  { value: "same", label: "Same as question" },
  { value: "english", label: "English" },
  { value: "chinese", label: "中文" },
];

const years = Array.from({ length: 151 }, (_, index) => String(1950 + index));
const months = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0")
);
const days = Array.from({ length: 31 }, (_, index) =>
  String(index + 1).padStart(2, "0")
);
const hours = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0")
);
const minutes = ["00", "15", "30", "45"];

const stepTitles = [
  "Gender",
  "Birth time",
  "Birthplace",
  "Life theme",
  "Situation",
  "Language",
];

function splitBirthDate(birthDate: string) {
  const [year, month, day] = birthDate.split("-");

  return {
    year: year || "",
    month: month || "",
    day: day || "",
  };
}

function splitBirthTime(birthTime: string) {
  const [hour, minute] = birthTime.split(":");

  return {
    hour: hour || "",
    minute: minute || "",
  };
}

function buildBirthDate(year: string, month: string, day: string) {
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function buildBirthTime(hour: string, minute: string) {
  if (!hour || !minute) return "";
  return `${hour}:${minute}`;
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

function isProfileComplete(profile: SoulLoopProfile) {
  return Boolean(
    profile.birthDate &&
      isValidBirthDate(profile.birthDate) &&
      profile.birthTime &&
      profile.gender &&
      profile.currentFocus &&
      profile.relationshipStatus &&
      profile.preferredLanguage
  );
}

function validateProfile(profile: SoulLoopProfile) {
  if (!profile.gender) return "Please select your gender.";
  if (!profile.birthDate) return "Please select your birth date.";
  if (!isValidBirthDate(profile.birthDate)) {
    return "Please select a valid birth date.";
  }
  if (!profile.birthTime) return "Please enter your birth time.";
  if (!profile.currentFocus) return "Please choose your current focus.";
  if (!profile.relationshipStatus)
    return "Please select your relationship status.";
  if (!profile.preferredLanguage) return "Please select your preferred language.";

  return "";
}

function choiceLabel(choices: Choice[], value: string, fallback = "Required") {
  return choices.find((choice) => choice.value === value)?.label || fallback;
}

function ChoiceGrid({
  value,
  choices,
  onChange,
}: {
  value: string;
  choices: Choice[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {choices.map((choice) => {
        const active = value === choice.value;

        return (
          <button
            key={choice.value || "empty"}
            type="button"
            onClick={() => onChange(choice.value)}
            className={`min-h-20 rounded-2xl border p-4 text-left transition ${
              active
                ? "border-[#f8f4ea]/60 bg-[#f8f4ea] text-[#11100d]"
                : "border-[#f8f4ea]/10 bg-[#0d0e0b] text-[#f8f4ea] hover:bg-[#f8f4ea]/8"
            }`}
          >
            <span className="block text-lg font-semibold">{choice.label}</span>
            {choice.hint && (
              <span
                className={`mt-2 block text-sm ${
                  active ? "text-[#11100d]/55" : "text-[#f8f4ea]/42"
                }`}
              >
                {choice.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<SoulLoopProfile>(defaultProfile);
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthHour, setBirthHour] = useState("");
  const [birthMinute, setBirthMinute] = useState("");
  const [calendarType, setCalendarType] = useState<"solar" | "lunar">("solar");
  const [birthplaceRegion, setBirthplaceRegion] =
    useState<"china" | "overseas">("china");
  const [quickBirthInput, setQuickBirthInput] = useState("");

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(0);

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
        setEmail(user.email || user.phone || "");

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
          setModalOpen(true);
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

          const timeParts = splitBirthTime(loadedProfile.birthTime);
          setBirthHour(timeParts.hour);
          setBirthMinute(timeParts.minute);

          setCreditsBalance(
            typeof data.credits_balance === "number"
              ? data.credits_balance
              : null
          );

          setModalOpen(!isProfileComplete(loadedProfile));
        } else {
          setModalOpen(true);
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
        setModalOpen(true);
      }
    }

    loadProfile();
  }, [router]);

  const completionItems = useMemo(
    () => [
      Boolean(profile.gender),
      Boolean(profile.birthDate && isValidBirthDate(profile.birthDate)),
      Boolean(profile.birthTime),
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

  const stepReady = useMemo(() => {
    if (step === 0) return Boolean(profile.gender);
    if (step === 1) {
      return Boolean(
        profile.birthDate &&
          isValidBirthDate(profile.birthDate) &&
          profile.birthTime
      );
    }
    if (step === 2) return true;
    if (step === 3) return Boolean(profile.currentFocus);
    if (step === 4) return Boolean(profile.relationshipStatus);
    if (step === 5) return Boolean(profile.preferredLanguage);
    return false;
  }, [profile, step]);

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

  function updateBirthTime(part: "hour" | "minute", value: string) {
    const nextHour = part === "hour" ? value : birthHour;
    const nextMinute = part === "minute" ? value : birthMinute;

    setBirthHour(nextHour);
    setBirthMinute(nextMinute);

    const nextBirthTime = buildBirthTime(nextHour, nextMinute);

    setProfile((prev) => ({
      ...prev,
      birthTime: nextBirthTime,
    }));

    setSaved(false);
    setError("");
  }

  function applyQuickBirthInput() {
    const normalized = quickBirthInput.replace(/\D/g, "");

    if (normalized.length !== 12) {
      setError("Quick input format should be YYYYMMDDHHMM, e.g. 199306241200.");
      return;
    }

    const nextYear = normalized.slice(0, 4);
    const nextMonth = normalized.slice(4, 6);
    const nextDay = normalized.slice(6, 8);
    const nextHour = normalized.slice(8, 10);
    const nextMinute = normalized.slice(10, 12);
    const nextBirthDate = buildBirthDate(nextYear, nextMonth, nextDay);

    if (!isValidBirthDate(nextBirthDate)) {
      setError("Quick input contains an invalid date.");
      return;
    }

    setBirthYear(nextYear);
    setBirthMonth(nextMonth);
    setBirthDay(nextDay);
    setBirthHour(nextHour);
    setBirthMinute(nextMinute);
    setProfile((prev) => ({
      ...prev,
      birthDate: nextBirthDate,
      birthTime: buildBirthTime(nextHour, nextMinute),
    }));
    setError("");
    setSaved(false);
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
      setModalOpen(false);

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

  function renderStep() {
    if (step === 0) {
      return (
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[#f1d691]">
            Step 1
          </p>
          <h2 className="mt-3 text-3xl font-semibold">Choose your gender</h2>
          <p className="mt-3 text-sm leading-6 text-[#f8f4ea]/50">
            Used only for more natural wording. It does not determine your
            result.
          </p>
          <div className="mt-6">
            <ChoiceGrid
              value={profile.gender}
              choices={genderChoices}
              onChange={(value) => updateProfile("gender", value)}
            />
          </div>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[#f1d691]">
            Step 2
          </p>
          <h2 className="mt-3 text-3xl font-semibold">Set birth time</h2>

          <div className="mt-6 flex w-full rounded-full bg-[#2a2926] p-1">
            {[
              ["solar", "Solar"],
              ["lunar", "Lunar"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCalendarType(value as "solar" | "lunar")}
                className={`flex-1 rounded-full px-4 py-3 font-semibold ${
                  calendarType === value
                    ? "bg-[#f8f4ea] text-[#11100d]"
                    : "text-[#f8f4ea]/48"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              value={quickBirthInput}
              onChange={(event) => {
                setQuickBirthInput(event.target.value);
                setError("");
              }}
              placeholder="Quick input: 199306241200"
              className="rounded-2xl border border-[#f8f4ea]/10 bg-[#0d0e0b] p-4 text-[#f8f4ea] outline-none placeholder:text-[#f8f4ea]/32"
            />
            <button
              type="button"
              onClick={applyQuickBirthInput}
              className="rounded-full border border-[#f8f4ea]/18 px-5 py-3 font-semibold text-[#f8f4ea]"
            >
              Apply
            </button>
          </div>

          <div className="mt-5 grid grid-cols-5 gap-3">
            <select
              value={birthYear}
              onChange={(event) => updateBirthDate("year", event.target.value)}
              className="rounded-2xl border border-[#f8f4ea]/10 bg-[#0d0e0b] p-4 text-[#f8f4ea] outline-none"
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
              onChange={(event) => updateBirthDate("month", event.target.value)}
              className="rounded-2xl border border-[#f8f4ea]/10 bg-[#0d0e0b] p-4 text-[#f8f4ea] outline-none"
            >
              <option value="">MM</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>

            <select
              value={birthDay}
              onChange={(event) => updateBirthDate("day", event.target.value)}
              className="rounded-2xl border border-[#f8f4ea]/10 bg-[#0d0e0b] p-4 text-[#f8f4ea] outline-none"
            >
              <option value="">DD</option>
              {days.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>

            <select
              value={birthHour}
              onChange={(event) => updateBirthTime("hour", event.target.value)}
              className="rounded-2xl border border-[#f8f4ea]/10 bg-[#0d0e0b] p-4 text-[#f8f4ea] outline-none"
            >
              <option value="">HH</option>
              {hours.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}
                </option>
              ))}
            </select>

            <select
              value={birthMinute}
              onChange={(event) => updateBirthTime("minute", event.target.value)}
              className="rounded-2xl border border-[#f8f4ea]/10 bg-[#0d0e0b] p-4 text-[#f8f4ea] outline-none"
            >
              <option value="">MM</option>
              {minutes.map((minute) => (
                <option key={minute} value={minute}>
                  {minute}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-4 rounded-2xl border border-[#f8f4ea]/10 bg-[#0d0e0b] p-4 text-center text-lg font-semibold">
            {profile.birthDate || "YYYY-MM-DD"} {profile.birthTime || "HH:MM"}
          </p>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[#f1d691]">
            Step 3
          </p>
          <h2 className="mt-3 text-3xl font-semibold">Add birthplace</h2>
          <p className="mt-3 text-sm leading-6 text-[#f8f4ea]/50">
            Optional, but useful when users expect a more grounded reading.
          </p>

          <div className="mt-6 flex rounded-full bg-[#2a2926] p-1">
            {[
              ["china", "China"],
              ["overseas", "Overseas"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setBirthplaceRegion(value as "china" | "overseas")
                }
                className={`flex-1 rounded-full px-4 py-3 font-semibold ${
                  birthplaceRegion === value
                    ? "bg-[#f8f4ea] text-[#11100d]"
                    : "text-[#f8f4ea]/48"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            value={profile.birthPlace}
            onChange={(event) => updateProfile("birthPlace", event.target.value)}
            placeholder={
              birthplaceRegion === "china"
                ? "上海市 上海"
                : "San Francisco, CA"
            }
            className="mt-5 w-full rounded-2xl border border-[#f8f4ea]/10 bg-[#0d0e0b] p-4 text-center text-lg font-semibold text-[#f8f4ea] outline-none placeholder:text-[#f8f4ea]/35"
          />
        </div>
      );
    }

    if (step === 3) {
      return (
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[#f1d691]">
            Step 4
          </p>
          <h2 className="mt-3 text-3xl font-semibold">What is the theme?</h2>
          <p className="mt-3 text-sm leading-6 text-[#f8f4ea]/50">
            This becomes the default lens when you enter SoulLoop.
          </p>
          <div className="mt-6">
            <ChoiceGrid
              value={profile.currentFocus}
              choices={focusChoices}
              onChange={(value) => updateProfile("currentFocus", value)}
            />
          </div>
        </div>
      );
    }

    if (step === 4) {
      return (
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[#f1d691]">
            Step 5
          </p>
          <h2 className="mt-3 text-3xl font-semibold">Current situation</h2>
          <div className="mt-6">
            <p className="mb-3 text-sm text-[#f8f4ea]/50">
              Relationship status
            </p>
            <ChoiceGrid
              value={profile.relationshipStatus}
              choices={relationshipChoices}
              onChange={(value) => updateProfile("relationshipStatus", value)}
            />
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm text-[#f8f4ea]/50">
              Career status optional
            </p>
            <ChoiceGrid
              value={profile.careerStatus}
              choices={careerChoices}
              onChange={(value) => updateProfile("careerStatus", value)}
            />
          </div>
        </div>
      );
    }

    return (
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-[#f1d691]">
          Step 6
        </p>
        <h2 className="mt-3 text-3xl font-semibold">Preferred language</h2>
        <p className="mt-3 text-sm leading-6 text-[#f8f4ea]/50">
          This controls the default answer language.
        </p>
        <div className="mt-6">
          <ChoiceGrid
            value={profile.preferredLanguage}
            choices={languageChoices}
            onChange={(value) => updateProfile("preferredLanguage", value)}
          />
        </div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-[#090b0a] px-6 py-16 text-[#f8f4ea]">
        <section className="mx-auto max-w-3xl">
          <div className="rounded-lg border border-[#f8f4ea]/10 bg-[#f8f4ea]/5 p-8">
            <p className="text-[#f8f4ea]/60">
              Loading your SoulLoop profile...
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090b0a] px-6 py-10 text-[#f8f4ea]">
      <section className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-[#f8f4ea]/50">
            ← Back to Home
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-[#f8f4ea]/50 underline"
          >
            Log out
          </button>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-[#c9a64d]/35 bg-[#c9a64d]/10 px-4 py-2 text-sm text-[#f1d691]">
              SoulLoop Profile
            </p>

            <h1 className="max-w-3xl text-5xl font-semibold leading-tight md:text-6xl">
              Create a clean symbolic profile.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#f8f4ea]/60">
              Each field is collected in a focused modal step so the experience
              feels calm, premium, and fast.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-[#f8f4ea]/10 bg-[#f8f4ea]/5 p-5">
                <p className="text-sm text-[#f8f4ea]/40">Signed in as</p>
                <p className="mt-2 break-all font-semibold">{email || "—"}</p>
              </div>

              <div className="rounded-lg border border-[#f8f4ea]/10 bg-[#f8f4ea]/5 p-5">
                <p className="text-sm text-[#f8f4ea]/40">Credits</p>
                <p className="mt-2 text-3xl font-semibold">
                  {creditsBalance === null ? "—" : creditsBalance}
                </p>
              </div>

              <div className="rounded-lg border border-[#f8f4ea]/10 bg-[#f8f4ea]/5 p-5">
                <p className="text-sm text-[#f8f4ea]/40">Readiness</p>
                <p className="mt-2 text-3xl font-semibold">
                  {completionPercent}%
                </p>
              </div>
            </div>

            <div className="mt-8 max-w-3xl">
              <div className="h-2 overflow-hidden rounded-full bg-[#f8f4ea]/10">
                <div
                  className="h-full rounded-full bg-[#f1d691] transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="rounded-full bg-[#f8f4ea] px-8 py-4 font-semibold text-[#11100d]"
              >
                {completionPercent === 100 ? "Edit Profile" : "Create Profile"}
              </button>

              <Link
                href="/chat"
                className="rounded-full border border-[#f8f4ea]/18 px-8 py-4 text-center font-semibold text-[#f8f4ea]"
              >
                Enter SoulLoop
              </Link>
            </div>
          </div>

          <aside className="rounded-lg border border-[#f8f4ea]/10 bg-[#f8f4ea]/6 p-6">
            <p className="text-sm uppercase tracking-[0.18em] text-[#f8f4ea]/35">
              Profile Preview
            </p>

            <div className="mt-5 grid gap-4 text-sm">
              {[
                ["Gender", choiceLabel(genderChoices, profile.gender)],
                [
                  "Birth",
                  profile.birthDate || profile.birthTime
                    ? `${profile.birthDate || "Date"} ${profile.birthTime || "Time"}`
                    : "Required",
                ],
                ["Birthplace", profile.birthPlace || "Optional"],
                ["Theme", choiceLabel(focusChoices, profile.currentFocus)],
                [
                  "Relationship",
                  choiceLabel(relationshipChoices, profile.relationshipStatus),
                ],
                [
                  "Career",
                  choiceLabel(careerChoices, profile.careerStatus, "Optional"),
                ],
                [
                  "Language",
                  choiceLabel(languageChoices, profile.preferredLanguage),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 border-b border-[#f8f4ea]/8 pb-3 last:border-b-0"
                >
                  <span className="text-[#f8f4ea]/42">{label}</span>
                  <span className="text-right font-medium">{value}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-md">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-[#f8f4ea]/12 bg-[#1a1a18] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.58)] md:p-9">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-4xl font-semibold">Create profile</h1>
                <p className="mt-2 text-sm text-[#f8f4ea]/45">
                  {stepTitles[step]} · {step + 1} of {stepTitles.length}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#f8f4ea]/12 text-2xl text-[#f8f4ea]/55"
                aria-label="Close profile modal"
              >
                ×
              </button>
            </div>

            <div className="mb-7 grid grid-cols-6 gap-2">
              {stepTitles.map((title, index) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => setStep(index)}
                  aria-label={`Go to ${title}`}
                  className={`h-2 rounded-full ${
                    index <= step ? "bg-[#f1d691]" : "bg-[#f8f4ea]/12"
                  }`}
                />
              ))}
            </div>

            <div className="min-h-[360px]">{renderStep()}</div>

            {error && (
              <div className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm leading-6 text-red-100">
                {error}
              </div>
            )}

            {saved && (
              <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-100">
                Profile saved. Entering SoulLoop...
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setStep((value) => Math.max(value - 1, 0))}
                disabled={step === 0 || saving}
                className="rounded-full border border-[#f8f4ea]/12 px-8 py-4 font-semibold text-[#f8f4ea] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>

              {step < stepTitles.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((value) => Math.min(value + 1, 5))}
                  disabled={!stepReady || saving}
                  className="rounded-full bg-[#f8f4ea] px-8 py-4 font-semibold text-[#11100d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving || !isProfileComplete(profile)}
                  className="rounded-full bg-[#f8f4ea] px-8 py-4 font-semibold text-[#11100d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Confirm"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
