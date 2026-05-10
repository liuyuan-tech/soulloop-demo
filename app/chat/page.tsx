"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function ChatPage() {
  const [topic, setTopic] = useState("love");
  const [language, setLanguage] = useState("same");
  const [tone, setTone] = useState("premium-balanced");
  const [depth, setDepth] = useState("standard");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    if (!question.trim()) return;

    setLoading(true);
    setAnswer("");

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

  const topicOptions = [
    { value: "love", label: "Love / Relationship" },
    { value: "career", label: "Career" },
    { value: "money", label: "Money" },
    { value: "dream", label: "Dream" },
    { value: "daily_energy", label: "Daily Energy" },
    { value: "decision", label: "Decision" },
    { value: "self_growth", label: "Self-Growth" },
    { value: "general", label: "Other" },
  ];

  const examples = [
    "Will my ex come back?",
    "Should I change my job?",
    "What does my dream about water mean?",
    "What is my energy this week?",
    "Why do I feel stuck lately?",
  ];

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-5xl">
        <a href="/" className="text-sm text-white/50">
          ← Back to Home
        </a>

        <h1 className="mt-10 text-5xl font-bold">Ask SoulLoop</h1>

        <p className="mt-4 text-white/60">
          Share a question and choose how you want SoulLoop to shape your
          symbolic reflection.
        </p>

        <div className="mt-8 grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 md:grid-cols-2">
          <div>
            <label className="mb-3 block text-sm font-medium text-white/70">
              1. What area do you want guidance on?
            </label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
            >
              {topicOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-white/70">
              2. What language should SoulLoop use?
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
            >
              <option value="same">Same as my question</option>
              <option value="english">English</option>
              <option value="chinese">中文</option>
            </select>
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-white/70">
              3. What tone do you prefer?
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
            >
              <option value="gentle">Gentle and comforting</option>
              <option value="direct">Direct and clear</option>
              <option value="mystical">More mystical</option>
              <option value="practical">More practical</option>
              <option value="premium-balanced">Premium balanced</option>
            </select>
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-white/70">
              4. How deep should the reading be?
            </label>
            <select
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
            >
              <option value="quick">Quick</option>
              <option value="standard">Standard</option>
              <option value="deep">Deep</option>
            </select>
          </div>
        </div>

        <div className="mt-8">
          <p className="mb-3 text-sm font-medium text-white/70">
            5. What would you like to ask?
          </p>

          <div className="mb-4 flex flex-wrap gap-3">
            {examples.map((item) => (
              <button
                key={item}
                onClick={() => setQuestion(item)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like guidance on today?"
              className="min-h-40 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-white outline-none placeholder:text-white/30"
            />

            <button
              onClick={handleAsk}
              disabled={loading}
              className="mt-4 rounded-full bg-white px-8 py-3 font-semibold text-black disabled:opacity-50"
            >
              {loading ? "Interpreting..." : "Generate Reading"}
            </button>
          </div>
        </div>

        {loading && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-white/60">
            Interpreting your question through SoulLoop...
          </div>
        )}

        {answer && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8 leading-8 text-white/80">
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