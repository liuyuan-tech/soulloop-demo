"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type SymbolicLens = {
  topic?: string;
  bagua?: string[];
  elements?: string[];
  ziwei?: string[];
  focus?: string;
  interpretation?: string;
};

type MessageRow = {
  id: string;
  topic: string | null;
  question: string;
  answer: string;
  lens: SymbolicLens | null;
  language: string | null;
  tone: string | null;
  depth: string | null;
  credits_used: number;
  model_used: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatFileDate(value: string) {
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "reading";
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markdownToSimpleHtml(markdown: string) {
  const escaped = escapeHtml(markdown);

  return escaped
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/((?:<li>[\s\S]*?<\/li>)+)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />");
}

function buildLensHtml(lens: SymbolicLens | null) {
  if (!lens) {
    return `<p class="muted">No symbolic lens recorded.</p>`;
  }

  const bagua = lens.bagua || [];
  const elements = lens.elements || [];
  const ziwei = lens.ziwei || [];

  const tagHtml = (items: string[]) =>
    items.length
      ? items.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")
      : `<span class="muted">Not recorded</span>`;

  return `
    <div class="lens-grid">
      <div class="lens-box">
        <div class="small-label">Topic</div>
        <div class="lens-title">${escapeHtml(lens.topic || "SoulLoop Reading")}</div>
      </div>

      <div class="lens-box">
        <div class="small-label">Bagua Lens</div>
        <div class="tags">${tagHtml(bagua)}</div>
      </div>

      <div class="lens-box">
        <div class="small-label">Five Elements</div>
        <div class="tags">${tagHtml(elements)}</div>
      </div>

      <div class="lens-box">
        <div class="small-label">Zi Wei Themes</div>
        <div class="tags">${tagHtml(ziwei)}</div>
      </div>
    </div>

    ${
      lens.focus
        ? `<div class="focus-box"><div class="small-label">Reading Focus</div><p>${escapeHtml(
            lens.focus
          )}</p></div>`
        : ""
    }

    ${
      lens.interpretation
        ? `<div class="focus-box"><div class="small-label">Lens Interpretation</div><p>${escapeHtml(
            lens.interpretation
          )}</p></div>`
        : ""
    }
  `;
}

async function exportReadingToPdf(message: MessageRow) {
  const lens = message.lens || null;
  const safeDate = formatFileDate(message.created_at);
  const fileName = `soulloop-reading-${safeDate}.pdf`;

  const container = document.createElement("div");

  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.background = "#ffffff";
  container.style.color = "#171722";
  container.style.fontFamily =
    "Arial, 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', sans-serif";
  container.style.padding = "48px";
  container.style.boxSizing = "border-box";

  container.innerHTML = `
    <style>
      .report {
        width: 100%;
        background: #ffffff;
        color: #171722;
      }

      .brand {
        font-size: 14px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #73738a;
        margin-bottom: 16px;
      }

      .title {
        font-size: 34px;
        line-height: 1.15;
        font-weight: 800;
        margin: 0;
        color: #101020;
      }

      .subtitle {
        margin-top: 14px;
        font-size: 15px;
        line-height: 1.7;
        color: #5f5f76;
      }

      .meta {
        margin-top: 28px;
        padding: 20px;
        border: 1px solid #e7e7ef;
        border-radius: 18px;
        background: #f7f7fb;
      }

      .small-label {
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #7a7a92;
        margin-bottom: 8px;
      }

      .question {
        font-size: 20px;
        line-height: 1.55;
        font-weight: 700;
        color: #171722;
        margin: 0;
      }

      .meta-row {
        margin-top: 12px;
        font-size: 13px;
        color: #68687e;
      }

      .section {
        margin-top: 30px;
        page-break-inside: avoid;
      }

      .section-title {
        font-size: 18px;
        font-weight: 800;
        color: #101020;
        margin-bottom: 14px;
      }

      .lens-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .lens-box,
      .focus-box {
        border: 1px solid #e7e7ef;
        border-radius: 16px;
        padding: 16px;
        background: #fbfbfe;
      }

      .focus-box {
        margin-top: 12px;
      }

      .lens-title {
        font-size: 16px;
        font-weight: 700;
        color: #171722;
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .tag {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        background: #eeeeF7;
        color: #303044;
        font-size: 12px;
        margin-right: 6px;
        margin-bottom: 6px;
      }

      .reading {
        font-size: 15px;
        line-height: 1.8;
        color: #242438;
      }

      .reading h1 {
        font-size: 22px;
        margin: 26px 0 12px;
        color: #101020;
      }

      .reading h2 {
        font-size: 19px;
        margin: 22px 0 10px;
        color: #101020;
      }

      .reading h3 {
        font-size: 17px;
        margin: 18px 0 8px;
        color: #101020;
      }

      .reading p {
        margin: 0 0 14px;
      }

      .reading ul {
        margin: 8px 0 16px 22px;
        padding: 0;
      }

      .reading li {
        margin-bottom: 8px;
      }

      .muted {
        color: #7a7a92;
        font-size: 13px;
      }

      .footer {
        margin-top: 40px;
        padding-top: 18px;
        border-top: 1px solid #e7e7ef;
        font-size: 12px;
        line-height: 1.7;
        color: #7a7a92;
      }
    </style>

    <div class="report">
      <div class="brand">SoulLoop</div>
      <h1 class="title">SoulLoop Reading Report</h1>
      <p class="subtitle">
        A personalized symbolic reading inspired by Eastern wisdom, Bagua, Five Elements,
        Yin-Yang balance, and reflective self-discovery.
      </p>

      <div class="meta">
        <div class="small-label">User Question</div>
        <p class="question">${escapeHtml(message.question)}</p>
        <div class="meta-row">
          Generated: ${escapeHtml(formatDate(message.created_at))}
          ${
            message.topic
              ? ` · Topic: ${escapeHtml(message.topic)}`
              : ""
          }
          · Cost: ${message.credits_used} credits
        </div>
      </div>

      <div class="section">
        <div class="section-title">Symbolic Lens</div>
        ${buildLensHtml(lens)}
      </div>

      <div class="section">
        <div class="section-title">SoulLoop Reading</div>
        <div class="reading">
          <p>${markdownToSimpleHtml(message.answer)}</p>
        </div>
      </div>

      <div class="footer">
        SoulLoop is for entertainment and self-reflection only. This report is not medical,
        legal, financial, psychological, or professional advice.
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

export default function HistoryPage() {
  const router = useRouter();

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          setError(`Session error: ${sessionError.message}`);
          setLoading(false);
          return;
        }

        if (!session?.user) {
          router.push("/login");
          return;
        }

        const { data, error } = await supabase
          .from("messages")
          .select(
            "id,topic,question,answer,lens,language,tone,depth,credits_used,model_used,input_tokens,output_tokens,created_at"
          )
          .order("created_at", { ascending: false });

        if (error) {
          setError(`History load error: ${error.message}`);
          setLoading(false);
          return;
        }

        setMessages((data || []) as MessageRow[]);
        setLoading(false);
      } catch (error) {
        console.error("LOAD_HISTORY_ERROR:", error);

        setError(
          error instanceof Error
            ? `Failed to load history: ${error.message}`
            : "Failed to load history."
        );

        setLoading(false);
      }
    }

    loadHistory();
  }, [router]);

  async function handleExportPdf(message: MessageRow) {
    setExportingId(message.id);

    try {
      await exportReadingToPdf(message);
    } catch (error) {
      console.error("EXPORT_PDF_ERROR:", error);

      setError(
        error instanceof Error
          ? `Failed to export PDF: ${error.message}`
          : "Failed to export PDF."
      );
    } finally {
      setExportingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
        <section className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-white/60">Loading your SoulLoop history...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-sm text-white/50">
            ← Back to Home
          </Link>

          <div className="flex gap-4 text-sm">
            <Link href="/chat" className="text-white/60 underline">
              Ask SoulLoop
            </Link>
            <Link href="/credits" className="text-white/60 underline">
              Credits
            </Link>
            <Link href="/profile" className="text-white/60 underline">
              Profile
            </Link>
          </div>
        </div>

        <div className="mt-10">
          <p className="mb-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
            SoulLoop History
          </p>

          <h1 className="text-5xl font-bold md:text-6xl">Your Readings</h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/60">
            Review your past questions, symbolic lenses, generated readings, and
            credit usage. You can also export each reading as a PDF report.
          </p>
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {!error && messages.length === 0 && (
          <div className="mt-8 rounded-[32px] border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-semibold">No readings yet</h2>
            <p className="mt-3 leading-7 text-white/60">
              Once you generate a SoulLoop reading, it will appear here.
            </p>

            <Link
              href="/chat"
              className="mt-6 inline-block rounded-full bg-white px-8 py-4 font-semibold text-black"
            >
              Generate your first reading
            </Link>
          </div>
        )}

        <div className="mt-8 space-y-5">
          {messages.map((message) => {
            const expanded = expandedId === message.id;
            const lens = message.lens || {};

            return (
              <article
                key={message.id}
                className="rounded-[32px] border border-white/10 bg-white/5 p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-white/35">
                      {formatDate(message.created_at)}
                    </p>

                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      {message.question}
                    </h2>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {message.topic && (
                        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white/65">
                          Topic: {message.topic}
                        </span>
                      )}

                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white/65">
                        Cost: {message.credits_used} credits
                      </span>

                      {message.model_used && (
                        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white/65">
                          Model: {message.model_used}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
                    <button
                      onClick={() =>
                        setExpandedId(expanded ? null : message.id)
                      }
                      className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white"
                    >
                      {expanded ? "Hide Reading" : "View Reading"}
                    </button>

                    <button
                      onClick={() => handleExportPdf(message)}
                      disabled={exportingId === message.id}
                      className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {exportingId === message.id
                        ? "Exporting..."
                        : "Export PDF"}
                    </button>
                  </div>
                </div>

                {lens.topic && (
                  <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
                    <p className="text-sm uppercase tracking-[0.18em] text-white/35">
                      Symbolic Lens
                    </p>

                    <h3 className="mt-2 text-xl font-semibold text-white">
                      {lens.topic}
                    </h3>

                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="mb-2 text-sm text-white/35">Bagua</p>
                        <div className="flex flex-wrap gap-2">
                          {(lens.bagua || []).map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-sm text-white/35">
                          Five Elements
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(lens.elements || []).map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-sm text-white/35">
                          Zi Wei Themes
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(lens.ziwei || []).map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {lens.focus && (
                      <p className="mt-4 leading-7 text-white/60">
                        {lens.focus}
                      </p>
                    )}
                  </div>
                )}

                {expanded && (
                  <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-6">
                    <div className="mb-4 text-sm uppercase tracking-[0.18em] text-white/35">
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
                      {message.answer}
                    </ReactMarkdown>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}