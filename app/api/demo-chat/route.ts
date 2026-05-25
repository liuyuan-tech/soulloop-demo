import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { applyCreditTransaction } from "@/lib/credits/apply-credit-transaction";
import {
  getReadingMode,
  normalizeReadingMode,
  normalizeReadingTopic,
  type ReadingModeId,
  type ReadingTopicId,
} from "@/lib/readings/options";

type SoulLoopProfile = {
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  gender?: string;
  currentFocus?: string;
  relationshipStatus?: string;
  careerStatus?: string;
  preferredLanguage?: string;
};

type SymbolicLens = {
  topic: string;
  readingMode: ReadingModeId;
  modeLabel: string;
  bagua: string[];
  elements: string[];
  ziwei: string[];
  modeMarkers: string[];
  crossValidation: string[];
  focus: string;
  interpretation: string;
};

type DemoChatRequest = {
  topic?: string;
  question?: string;
  readingMode?: string;
  language?: string;
  tone?: string;
  depth?: string;
};

type DatabaseProfileRow = {
  birth_date?: string | null;
  birth_time?: string | null;
  birth_place?: string | null;
  gender?: string | null;
  current_focus?: string | null;
  relationship_status?: string | null;
  career_status?: string | null;
  preferred_language?: string | null;
};

type RecentMessageRow = {
  topic?: string | null;
  question?: string | null;
  created_at?: string | null;
};

const STANDARD_READING_COST = 8;

function normalizeLabel(value?: string) {
  if (!value) return "not provided";

  const map: Record<string, string> = {
    female: "Female",
    male: "Male",
    non_binary: "Non-binary",
    other: "Other",

    love: "Love / Relationship",
    career: "Career",
    money: "Money",
    self: "Self",
    relationship: "Relationship",
    daily_energy: "Daily Energy",
    decision: "Decision",
    self_growth: "Self-Growth",
    general: "General",

    single: "Single",
    dating: "Dating",
    in_relationship: "In a relationship",
    complicated: "Complicated",
    married: "Married",
    separated: "Separated",

    student: "Student",
    employed: "Employed",
    founder: "Founder / Entrepreneur",
    freelancer: "Freelancer",
    job_seeking: "Job seeking",
    transition: "In transition",

    same: "Same as the user's question",
    english: "English",
    chinese: "Chinese",
  };

  return map[value] || value;
}

function validateProfile(profile?: SoulLoopProfile | null) {
  if (!profile) {
    return "Profile is required before generating a SoulLoop reading.";
  }

  if (!profile.birthDate) {
    return "Birth date is required before generating a SoulLoop reading.";
  }

  if (!profile.birthTime) {
    return "Birth time is required before generating a SoulLoop reading.";
  }

  if (!profile.gender) {
    return "Gender is required before generating a SoulLoop reading.";
  }

  if (!profile.currentFocus) {
    return "Current focus is required before generating a SoulLoop reading.";
  }

  if (!profile.relationshipStatus) {
    return "Relationship status is required before generating a SoulLoop reading.";
  }

  if (!profile.preferredLanguage) {
    return "Preferred language is required before generating a SoulLoop reading.";
  }

  return "";
}

function detectLanguage(text: string, languageChoice = "same") {
  if (languageChoice === "chinese") {
    return {
      languageInstruction:
        "用户选择中文。你必须全程使用中文回答，包括所有标题。不要输出英文。",
      headings: {
        conclusion: "一句话结论",
        why: "为什么是这个答案",
        resonance: "为什么会击中你",
        action: "今日行动",
        avoid: "今日禁忌",
        alternative: "另一种可能",
        cross: "多模式交叉验证",
        disclaimer: "免责声明",
      },
    };
  }

  if (languageChoice === "english") {
    return {
      languageInstruction:
        "The user selected English. You must answer entirely in English, including all headings. Do not output Chinese.",
      headings: {
        conclusion: "One-Sentence Answer",
        why: "Why This Answer",
        resonance: "Why It May Feel Personal",
        action: "Today's Action",
        avoid: "Today's Avoidance",
        alternative: "Another Possibility",
        cross: "Multi-Mode Cross-Check",
        disclaimer: "Disclaimer",
      },
    };
  }

  const chineseRegex = /[\u4e00-\u9fff]/;

  if (chineseRegex.test(text)) {
    return {
      languageInstruction:
        "用户使用中文提问。你必须全程使用中文回答，包括所有标题。不要输出英文。",
      headings: {
        conclusion: "一句话结论",
        why: "为什么是这个答案",
        resonance: "为什么会击中你",
        action: "今日行动",
        avoid: "今日禁忌",
        alternative: "另一种可能",
        cross: "多模式交叉验证",
        disclaimer: "免责声明",
      },
    };
  }

  return {
    languageInstruction:
      "The user asked in English. You must answer entirely in English, including all headings. Do not output Chinese.",
    headings: {
      conclusion: "One-Sentence Answer",
      why: "Why This Answer",
      resonance: "Why It May Feel Personal",
      action: "Today's Action",
      avoid: "Today's Avoidance",
      alternative: "Another Possibility",
      cross: "Multi-Mode Cross-Check",
      disclaimer: "Disclaimer",
    },
  };
}

function getTopicInstruction(topic: string) {
  const map: Record<string, string> = {
    love:
      "The user is asking about love or relationships. Focus on emotional patterns, communication, boundaries, attachment, timing, and self-respect. Do not promise reunion, marriage, or a specific romantic outcome.",
    career:
      "The user is asking about career. Focus on timing, capability, preparation, decision quality, risk awareness, and value creation. Do not guarantee success or failure.",
    money:
      "The user is asking about money or wealth. Focus on discipline, skills, long-term value creation, risk control, patience, and opportunity awareness. Do not provide investment advice or promise wealth.",
    self:
      "The user is asking about the self. Focus on self-understanding, habits, identity, emotional patterns, inner conflict, and grounded self-development.",
    decision:
      "The user is asking about a decision. Help compare tensions, timing, risks, and next steps. Do not make the decision for the user.",
    relationship:
      "The user is asking about a relationship dynamic. Focus on communication, mutual expectations, boundaries, roles, repair, and emotional safety. Do not promise reconciliation or a fixed outcome.",
    general:
      "The user is asking a general life question. Give a balanced symbolic reflection with practical guidance.",
  };

  return map[topic] || map.general;
}

function getToneInstruction(tone: string) {
  const map: Record<string, string> = {
    gentle: "Use a gentle, comforting, emotionally supportive tone.",
    direct: "Use a direct, clear, honest tone while staying kind.",
    mystical:
      "Use a more mystical and symbolic tone, but do not become vague, frightening, or fatalistic.",
    practical: "Use a practical, grounded tone with minimal mystical language.",
    "premium-balanced":
      "Use a premium balanced tone: warm, elegant, lightly mystical, emotionally intelligent, and practical.",
  };

  return map[tone] || map["premium-balanced"];
}

function getDepthInstruction(depth: string) {
  const map: Record<string, string> = {
    quick:
      "Keep the answer short. English: 180-300 words. Chinese: 300-500 Chinese characters.",
    standard:
      "Keep the answer balanced and useful. English: 350-600 words. Chinese: 500-900 Chinese characters.",
    deep:
      "Give a more detailed reading. English: 700-1000 words. Chinese: 1000-1500 Chinese characters.",
  };

  return map[depth] || map.standard;
}

function getModeMarkers(mode: ReadingModeId, topic: ReadingTopicId) {
  const tarotMarkers: Record<ReadingTopicId, string[]> = {
    love: ["Two of Cups", "The Moon", "Temperance"],
    career: ["The Chariot", "Eight of Pentacles", "Three of Wands"],
    money: ["Four of Pentacles", "Six of Pentacles", "Wheel of Fortune"],
    self: ["The Hermit", "The Star", "Temperance"],
    decision: ["Justice", "The Hanged Man", "Two of Swords"],
    relationship: ["The Lovers", "Six of Cups", "Strength"],
  };

  const colorMarkers: Record<ReadingTopicId, string[]> = {
    love: ["Blue: attachment and empathy", "Gold: security needs"],
    career: ["Green: analysis and mastery", "Gold: structure and follow-through"],
    money: ["Gold: resource discipline", "Orange: opportunity appetite"],
    self: ["Blue: emotional depth", "Green: self-observation"],
    decision: ["Green: clarity", "Orange: action", "Gold: risk boundary"],
    relationship: ["Blue: connection", "Gold: trust", "Orange: autonomy"],
  };

  const dailyMarkers: Record<ReadingTopicId, string[]> = {
    love: ["Reminder: do not chase ambiguity", "Action: make one clear bid"],
    career: ["Reminder: momentum needs structure", "Action: finish one visible task"],
    money: ["Reminder: value before velocity", "Action: review one spending pattern"],
    self: ["Reminder: name the feeling first", "Action: choose one stabilizing habit"],
    decision: ["Reminder: pressure is not clarity", "Action: define the next reversible step"],
    relationship: ["Reminder: repair beats performance", "Action: ask one clean question"],
  };

  if (mode === "tarot") return tarotMarkers[topic];
  if (mode === "color_personality") return colorMarkers[topic];
  if (mode === "daily_loop") return dailyMarkers[topic];

  return ["I Ching-style timing", "Bagua position", "Five Elements balance"];
}

function getModeInstruction(mode: ReadingModeId, topic: ReadingTopicId) {
  const topicLabel = normalizeLabel(topic);

  const map: Record<ReadingModeId, string> = {
    eastern_wisdom:
      "Use Eastern Wisdom as the main included mode. Lean on I Ching-style timing, Bagua movement/stillness, Yin-Yang balance, Five Elements, and Zi Wei Dou Shu-style life themes. Do not claim a real hexagram or chart was calculated.",
    tarot:
      `Use Tarot as a paid enhanced pack for ${topicLabel}. Use the provided tarot archetypes as a symbolic spread, then cross-check them with the Eastern Wisdom baseline. Do not claim that physical cards were shuffled or drawn.`,
    color_personality:
      `Use Color Personality as a paid enhanced pack for ${topicLabel}. Translate the user's question into color-style motivation, stress response, communication needs, and decision bias, then cross-check with the Eastern Wisdom baseline. Do not claim this is a clinical personality diagnosis.`,
    daily_loop:
      `Use Daily Loop as a paid enhanced pack for ${topicLabel}. Make the answer feel like a daily personalized guidance loop: today's reminder, today's action, today's avoidance, and one evening check-in. Cross-check the daily message with the Eastern Wisdom baseline.`,
  };

  return map[mode];
}

function getCrossValidation({
  mode,
  topic,
  lens,
}: {
  mode: ReadingModeId;
  topic: ReadingTopicId;
  lens: Pick<SymbolicLens, "bagua" | "elements" | "ziwei">;
}) {
  const modeLabel = getReadingMode(mode).label;
  const topicLabel = normalizeLabel(topic);
  const baseline = `Eastern Wisdom baseline: ${lens.bagua[0]} and ${lens.elements[0]} frame the ${topicLabel} question through timing, balance, and grounded action.`;

  if (mode === "eastern_wisdom") {
    return [
      baseline,
      `Zi Wei-style theme: ${lens.ziwei[0]} adds a life-pattern lens without treating the profile as fate.`,
      "Practical check: the answer should leave the user with one calm next step, not dependency.",
    ];
  }

  return [
    baseline,
    `${modeLabel} pack: the selected mode adds a second symbolic language for the same question.`,
    "Common thread: when both modes point to the same tension, emphasize that overlap as the most reliable reflection.",
  ];
}

function getSymbolicLens({
  topic,
  readingMode,
  question,
  profile,
}: {
  topic: string;
  readingMode: ReadingModeId;
  question: string;
  profile?: SoulLoopProfile | null;
}): SymbolicLens {
  const q = question.toLowerCase();
  const effectiveTopic = normalizeReadingTopic(topic || profile?.currentFocus);
  const mode = getReadingMode(readingMode);
  const withMode = (
    lens: Omit<
      SymbolicLens,
      "readingMode" | "modeLabel" | "modeMarkers" | "crossValidation"
    >
  ): SymbolicLens => ({
    ...lens,
    readingMode,
    modeLabel: mode.label,
    modeMarkers: getModeMarkers(readingMode, effectiveTopic),
    crossValidation: getCrossValidation({
      mode: readingMode,
      topic: effectiveTopic,
      lens,
    }),
  });

  if (
    effectiveTopic === "relationship" ||
    q.includes("friend") ||
    q.includes("family") ||
    q.includes("boundary") ||
    q.includes("communication") ||
    q.includes("between us")
  ) {
    return withMode({
      topic: "Relationship",
      bagua: ["Dui 兑", "Kun 坤", "Gen 艮"],
      elements: ["Metal 金", "Earth 土", "Water 水"],
      ziwei: ["Tian Liang 天梁", "Tai Yin 太阴", "Tian Ji 天机"],
      focus:
        "communication, mutual expectation, emotional safety, repair, and boundaries",
      interpretation:
        "This reading uses Dui for communication, Kun for care and receptivity, and Gen for boundaries. Tian Liang and Tai Yin-style themes help frame trust, repair, and emotional memory without forcing a fixed relationship outcome.",
    });
  }

  if (
    effectiveTopic === "love" ||
    q.includes("ex") ||
    q.includes("love") ||
    q.includes("relationship") ||
    q.includes("crush") ||
    q.includes("marry") ||
    q.includes("marriage")
  ) {
    return withMode({
      topic: "Love / Relationship",
      bagua: ["Dui 兑", "Kan 坎", "Li 离"],
      elements: ["Water 水", "Fire 火", "Metal 金"],
      ziwei: ["Tai Yin 太阴", "Tian Ji 天机", "Tan Lang 贪狼"],
      focus:
        "emotional timing, communication, attraction, uncertainty, and boundaries",
      interpretation:
        "This reading uses Dui for communication and attraction, Kan for emotional uncertainty, and Li for visibility and passion. Tai Yin and Tian Ji-style themes help frame memory, attachment, and repeated thinking without promising a fixed romantic outcome.",
    });
  }

  if (
    effectiveTopic === "career" ||
    q.includes("job") ||
    q.includes("career") ||
    q.includes("quit") ||
    q.includes("business") ||
    q.includes("startup") ||
    q.includes("promotion")
  ) {
    return withMode({
      topic: "Career",
      bagua: ["Zhen 震", "Gen 艮", "Qian 乾", "Xun 巽"],
      elements: ["Wood 木", "Earth 土", "Metal 金"],
      ziwei: ["Tian Ji 天机", "Wu Qu 武曲", "Zi Wei 紫微"],
      focus:
        "movement, preparation, structure, execution, leadership, and timing",
      interpretation:
        "This reading uses Zhen for movement and new beginnings, Gen for pause and preparation, Qian for leadership, and Xun for gradual influence. Wu Qu and Tian Ji-style themes help frame discipline, strategy, and career direction.",
    });
  }

  if (
    effectiveTopic === "money" ||
    q.includes("money") ||
    q.includes("rich") ||
    q.includes("wealth") ||
    q.includes("income") ||
    q.includes("invest") ||
    q.includes("profit")
  ) {
    return withMode({
      topic: "Money / Wealth",
      bagua: ["Xun 巽", "Dui 兑", "Kun 坤", "Qian 乾"],
      elements: ["Earth 土", "Metal 金", "Water 水"],
      ziwei: ["Wu Qu 武曲", "Tian Fu 天府", "Tan Lang 贪狼"],
      focus:
        "resource accumulation, discipline, opportunity flow, value exchange, and risk control",
      interpretation:
        "This reading uses Earth for the ability to hold resources, Metal for discipline and value judgment, and Water for opportunity flow and risk. Wu Qu and Tian Fu-style themes help frame wealth as execution, structure, and accumulation rather than guaranteed fortune.",
    });
  }

  if (
    q.includes("dream") ||
    q.includes("nightmare") ||
    q.includes("sleep")
  ) {
    return withMode({
      topic: "Dream",
      bagua: ["Kan 坎", "Li 离", "Gen 艮"],
      elements: ["Water 水", "Fire 火", "Earth 土"],
      ziwei: ["Tai Yin 太阴", "Tian Ji 天机"],
      focus:
        "subconscious emotion, memory, hidden fear, symbolic visibility, and inner boundaries",
      interpretation:
        "This reading uses Kan for the subconscious and emotional depth, Li for images and visibility, and Gen for stillness and boundaries. Tai Yin and Tian Ji-style themes help interpret dreams as emotional symbols, not predictions.",
    });
  }

  if (
    effectiveTopic === "decision" ||
    q.includes("should i") ||
    q.includes("choose") ||
    q.includes("decision") ||
    q.includes("move forward") ||
    q.includes("wait")
  ) {
    return withMode({
      topic: "Decision",
      bagua: ["Zhen 震", "Gen 艮", "Xun 巽", "Qian 乾"],
      elements: ["Wood 木", "Metal 金", "Earth 土"],
      ziwei: ["Tian Ji 天机", "Po Jun 破军", "Zi Wei 紫微"],
      focus:
        "action versus stillness, strategy, risk boundary, preparation, and timing",
      interpretation:
        "This reading uses Zhen for the urge to act, Gen for the wisdom of pausing, Xun for gradual movement, and Qian for decisive direction. Tian Ji and Po Jun-style themes help frame change without forcing a single answer.",
    });
  }

  if (
    effectiveTopic === "self" ||
    q.includes("stuck") ||
    q.includes("growth") ||
    q.includes("purpose") ||
    q.includes("lost") ||
    q.includes("anxious")
  ) {
    return withMode({
      topic: "Self-Growth",
      bagua: ["Gen 艮", "Kun 坤", "Kan 坎", "Li 离"],
      elements: ["Earth 土", "Water 水", "Fire 火"],
      ziwei: ["Tai Yin 太阴", "Tian Liang 天梁", "Tian Ji 天机"],
      focus:
        "inner stability, emotional safety, self-awareness, repair, and clarity",
      interpretation:
        "This reading uses Gen for stillness, Kun for support and grounding, Kan for emotional depth, and Li for clarity. Tai Yin and Tian Liang-style themes help frame emotional repair, maturity, and self-understanding.",
    });
  }

  return withMode({
    topic: "General",
    bagua: ["Qian 乾", "Kun 坤", "Kan 坎"],
    elements: ["Yin-Yang 阴阳", "Earth 土", "Water 水"],
    ziwei: ["Zi Wei 紫微", "Tian Fu 天府", "Tian Ji 天机"],
    focus:
      "balance, timing, self-cultivation, stability, uncertainty, and grounded action",
    interpretation:
      "This reading uses Qian and Kun to frame active and receptive forces, Kan to represent uncertainty, and Earth-Water themes to balance grounding with flow. Zi Wei and Tian Fu-style themes help frame life direction and resource awareness.",
  });
}

function formatProfile(profile?: SoulLoopProfile | null) {
  if (!profile) {
    return "No saved user profile was provided.";
  }

  return `
Birth date: ${profile.birthDate || "not provided"}
Birth time: ${profile.birthTime || "not provided"}
Birth place: ${profile.birthPlace || "not provided"}
Gender: ${normalizeLabel(profile.gender)}
Current focus: ${normalizeLabel(profile.currentFocus)}
Relationship status: ${normalizeLabel(profile.relationshipStatus)}
Career status: ${normalizeLabel(profile.careerStatus)}
Preferred language: ${normalizeLabel(profile.preferredLanguage)}
`;
}

function formatRecentHistory(messages: RecentMessageRow[]) {
  if (!messages.length) {
    return "No previous SoulLoop questions were found for this user.";
  }

  return messages
    .map((message, index) => {
      const topic = normalizeLabel(message.topic || "general");
      const question = (message.question || "").replace(/\s+/g, " ").trim();
      return `${index + 1}. ${topic}: ${question || "Untitled question"}`;
    })
    .join("\n");
}

function buildPrompt({
  topic,
  readingMode,
  question,
  language,
  tone,
  depth,
  profile,
  lens,
  recentHistory,
}: {
  topic: string;
  readingMode: ReadingModeId;
  question: string;
  language: string;
  tone: string;
  depth: string;
  profile: SoulLoopProfile;
  lens: SymbolicLens;
  recentHistory: RecentMessageRow[];
}) {
  const lang = detectLanguage(question, language);
  const topicInstruction = getTopicInstruction(topic);
  const toneInstruction = getToneInstruction(tone);
  const depthInstruction = getDepthInstruction(depth);
  const normalizedTopic = normalizeReadingTopic(topic);
  const normalizedMode = normalizeReadingMode(readingMode);
  const mode = getReadingMode(normalizedMode);
  const modeInstruction = getModeInstruction(normalizedMode, normalizedTopic);
  const profileContext = formatProfile(profile);
  const historyContext = formatRecentHistory(recentHistory);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return `
You are SoulLoop, an AI symbolic self-discovery guide. The product model is inspired by Co-Star's daily personalized language: concise, emotionally intelligent, relationship-aware, repeatable, and highly personal. SoulLoop blends Eastern wisdom with optional paid reading packs such as Tarot, Color Personality, and Daily Loop.

USER QUESTION:
${question}

USER PROFILE PROVIDED BY THE USER:
${profileContext}

RECENT USER HISTORY:
${historyContext}

TODAY'S DATE CONTEXT:
${today}

IMPORTANT PROFILE USAGE INSTRUCTION:
You must use the user's provided profile and recent question history as soft context when shaping the reading.

The user's profile fields mean:
- Birth date: use as symbolic timing context and life-stage reference.
- Birth time: use as symbolic time-of-day context and rhythm reference.
- Birth place: if provided, use only as light contextual background.
- Gender: use only to personalize wording and context. Do not make deterministic claims from gender.
- Current focus: use as the primary domain lens for the reading.
- Relationship status: use to ground emotional and relationship-related guidance.
- Career status: if provided, use to ground practical guidance.
- Preferred language: respect the selected output language rule.

Do not ignore the profile.
Do not overstate the profile.
Do not say you calculated a real BaZi chart, Zi Wei chart, astrology chart, or birth chart from these details.
Do not claim the user's birth data proves anything.
Do not infer or mention zodiac signs, sun signs, moon signs, ascendants, star signs, or astrology placements from the birth date or birth time. SoulLoop does not currently have an Astrology mode.
Use phrases like:
- "Given the context you shared..."
- "With your current focus in mind..."
- "Your profile suggests this reading may be most useful when viewed through..."
- "Because you marked your relationship status as..."
- "Because your current focus is..."

USER SELECTED TOPIC:
${topic}

USER SELECTED READING MODE:
${mode.label} (${mode.status}, ${mode.creditCost} credits)

SOULLOOP SYMBOLIC LENS:
Topic: ${lens.topic}
Reading Mode: ${lens.modeLabel}
Bagua Lens: ${lens.bagua.join(", ")}
Five Elements: ${lens.elements.join(", ")}
Zi Wei Themes: ${lens.ziwei.join(", ")}
Mode Markers: ${lens.modeMarkers.join(", ")}
Cross-Validation Inputs: ${lens.crossValidation.join(" | ")}
Reading Focus: ${lens.focus}
Lens Interpretation: ${lens.interpretation}

TOPIC-SPECIFIC GUIDANCE:
${topicInstruction}

MODE-SPECIFIC GUIDANCE:
${modeInstruction}

LANGUAGE RULE:
${lang.languageInstruction}

TONE RULE:
${toneInstruction}

DEPTH RULE:
${depthInstruction}

DEFAULT SYMBOLIC FRAMEWORKS:
Use the following Eastern wisdom frameworks as background lenses when forming the answer:

- Bagua symbolism:
  Change, position, movement, stillness, inner/outer dynamics, and the relationship between opposing forces.

- I Ching-style reflection:
  Timing, transformation, restraint, gradual progress, situational awareness, and the wisdom of adapting to change.

- Yin-Yang balance:
  The tension between action and waiting, softness and firmness, inner desire and outer reality, openness and protection.

- Five Elements:
  Wood as growth and direction.
  Fire as passion and visibility.
  Earth as stability and nourishment.
  Metal as discipline and refinement.
  Water as flow, intuition, and uncertainty.

- Zi Wei Dou Shu-style reflection:
  Personality tendencies, life themes, relationship patterns, career direction, emotional timing, and long-term cycles.

Important boundary:
You are not actually calculating a chart, casting a hexagram, generating a BaZi chart, or generating a Zi Wei Dou Shu chart.
These frameworks are used only as symbolic lenses to help the user reflect.

PERSONALIZATION RULE:
Use the user profile and recent history only to personalize the tone, context, and relevance of the reading.
Do not claim that you have calculated a real chart from the user's birth date, birth time, or birth place.
Do not make deterministic claims based on birth information, gender, relationship status, or career status.
Do not infer zodiac signs, Western astrology signs, Chinese zodiac signs, or astrology placements from profile data.
If profile fields are present, weave the most relevant ones naturally into the reading.
If recent history is present, reference recurring themes softly, without revealing private history in a way that feels invasive.
When using profile information, phrase it softly, such as:
- "Given the context you shared..."
- "With your current focus in mind..."
- "Because you marked your relationship status as..."
- "Your saved profile suggests this reading may be most useful when viewed through..."
Never say:
- "Your birth chart proves..."
- "Your destiny shows..."
- "Because you were born at this time, this will happen..."

CORE TASK:
Respond to the user's question as a symbolic reflection, not as a factual prediction.
You should help the user think more clearly, feel emotionally grounded, and identify practical next steps.
Use the SoulLoop Symbolic Lens as the primary professional interpretation structure for the answer.
Use the user's profile as personalization context throughout the answer.
Make the answer feel specific enough that the user understands why this answer belongs to this question, this profile, this topic, this mode, and this moment.

IMPORTANT SAFETY RULES:
- Do not claim certainty.
- Do not say something will definitely happen or definitely not happen.
- Do not promise wealth, love, marriage, reunion, success, failure, or any fixed future outcome.
- Do not predict death, illness, pregnancy, disasters, legal outcomes, or exact financial gains/losses.
- Do not provide medical, legal, financial, psychological, or professional advice.
- Do not create fear, dependency, urgency, or superstition-based pressure.
- Do not tell the user that they must pay, act immediately, or follow the reading to avoid negative outcomes.

STRICT METAPHYSICS BOUNDARY:
- Do not claim that you have actually cast an I Ching hexagram.
- Do not claim that you have actually generated a Zi Wei Dou Shu chart.
- Do not claim that you have actually calculated a BaZi chart.
- Do not claim that you have actually performed divination.
- Do not fabricate specific hexagram numbers, changing lines, palaces, stars, stems, branches, heavenly stems, earthly branches, or chart placements.
- Do not say: "I have cast a hexagram for you", "your Zi Wei chart shows", "your BaZi indicates", "your destiny is fixed", or similar deterministic claims.
- You may say: "from an I Ching-style symbolic perspective", "through a Five Elements lens", "using Yin-Yang balance as a metaphor", or "in a Zi Wei Dou Shu-style life-theme reflection".
- Use these systems as symbolic interpretation frameworks only, not as literal fortune-telling calculations.

Frame everything as symbolic, reflective, and for entertainment/self-discovery only.

STYLE RULES:
- Be warm, calm, premium, and emotionally intelligent.
- Use a clear Eastern metaphysics flavor, drawing softly from Bagua, I Ching, Yin-Yang, Five Elements, and Zi Wei Dou Shu-style life pattern language.
- Do not overuse obscure terminology.
- If you use terms like Yin-Yang, Five Elements, Bagua, or Zi Wei, briefly explain them in plain language.
- Be direct enough to answer the user's actual question.
- Avoid long poetic paragraphs.
- Avoid excessive metaphors.
- Avoid vague generic advice that could apply to anyone.
- Use practical, grounded suggestions.
- If the user asks about wealth, career, or money, focus on habits, capability, patience, timing, value creation, and risk awareness.
- If the user asks about love, focus on relationship patterns, communication, emotional timing, boundaries, and self-respect.
- If the user asks about dreams, explain them as emotional symbols, not predictions.
- If the user asks a yes/no future question, do not answer yes or no directly. Give a balanced reflection.
- The first sentence must be direct, clear, and useful. Do not start with a long disclaimer.
- Use mode vocabulary visibly: cards for Tarot, color and motivation dimensions for Color Personality, daily reminder/action/avoidance for Daily Loop, and Eastern wisdom symbols for Eastern Wisdom.
- For paid modes, always cross-check the paid mode against the Eastern Wisdom baseline so the user feels the pack improved the answer quality.

OUTPUT FORMAT:
# ${lang.headings.conclusion}
Write exactly one concise sentence that gives the user's clearest answer without pretending certainty.

# ${lang.headings.why}
Explain why this is the answer.
Show the selected mode and its visible markers:
- Eastern Wisdom: mention Bagua, I Ching-style timing, Five Elements, or Zi Wei-style life theme.
- Tarot: mention the provided symbolic cards as archetypes, not as physically drawn cards.
- Color Personality: mention the color pattern and personality dimensions.
- Daily Loop: mention today's reminder, action, and avoidance.
Do not claim a real chart, hexagram, or divination was calculated.

# ${lang.headings.resonance}
Write the "this feels like me" paragraph.
Combine the user's exact question, saved profile details, recent question history if useful, birthday/time as symbolic context, current focus, relationship/career status, and preference signals.
Keep this grounded, non-deterministic, and emotionally intelligent.

# ${lang.headings.action}
Give 3 practical bullets for what to do today.

# ${lang.headings.avoid}
Give 2 bullets for what to avoid today.

# ${lang.headings.alternative}
Give one balanced alternative interpretation that reduces fatalism and helps the user keep agency.

# ${lang.headings.cross}
Give 2-3 bullets showing how the selected mode and Eastern Wisdom baseline agree or differ.
Name the common thread clearly.

# ${lang.headings.disclaimer}
Write one short sentence saying this is for entertainment and self-reflection only.

Return only the final answer. Do not explain your reasoning process.
`;
}

function mapDatabaseProfile(data: DatabaseProfileRow): SoulLoopProfile {
  return {
    birthDate: data.birth_date || "",
    birthTime: data.birth_time || "",
    birthPlace: data.birth_place || "",
    gender: data.gender || "",
    currentFocus: data.current_focus || "",
    relationshipStatus: data.relationship_status || "",
    careerStatus: data.career_status || "",
    preferredLanguage: data.preferred_language || "",
  };
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required. Please log in." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session. Please log in again." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as DemoChatRequest;

    const question = body.question?.trim();
    const tone = body.tone || "premium-balanced";
    const depth = body.depth || "standard";
    const readingMode = normalizeReadingMode(body.readingMode);
    const modeConfig = getReadingMode(readingMode);
    const creditsUsed = modeConfig.creditCost || STANDARD_READING_COST;

    if (!question) {
      return NextResponse.json(
        { error: "Question is required." },
        { status: 400 }
      );
    }

    if (question.length > 1000) {
      return NextResponse.json(
        { error: "Question is too long. Please keep it under 1000 characters." },
        { status: 400 }
      );
    }

    const { data: profileRow, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(
        "id,email,birth_date,birth_time,birth_place,gender,current_focus,relationship_status,career_status,preferred_language,credits_balance"
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profileRow) {
      return NextResponse.json(
        {
          error:
            profileError?.message ||
            "Profile not found. Please complete your profile first.",
        },
        { status: 400 }
      );
    }

    const profile = mapDatabaseProfile(profileRow);
    const profileValidationError = validateProfile(profile);

    if (profileValidationError) {
      return NextResponse.json(
        {
          error: profileValidationError,
        },
        { status: 400 }
      );
    }

    const currentCredits =
      typeof profileRow.credits_balance === "number"
        ? profileRow.credits_balance
        : 0;

    if (currentCredits < creditsUsed) {
      return NextResponse.json(
        {
          error: `Not enough credits. This reading costs ${creditsUsed} credits, but you only have ${currentCredits}.`,
          remainingCredits: currentCredits,
          code: "INSUFFICIENT_CREDITS",
        },
        { status: 402 }
      );
    }

    const topic = normalizeReadingTopic(body.topic || profile.currentFocus);
    const language = body.language || profile.preferredLanguage || "same";

    if (readingMode !== "eastern_wisdom") {
      const { data: entitlement, error: entitlementError } =
        await supabaseAdmin
          .from("reading_mode_entitlements")
          .select("id")
          .eq("user_id", user.id)
          .eq("mode", readingMode)
          .eq("status", "active")
          .maybeSingle();

      if (entitlementError) {
        return NextResponse.json(
          {
            error:
              "Reading mode entitlements are not ready. Please apply the latest Supabase migration.",
            code: "READING_MODE_ENTITLEMENTS_UNAVAILABLE",
            readingMode,
          },
          { status: 503 }
        );
      }

      if (!entitlement) {
        return NextResponse.json(
          {
            error: `${modeConfig.label} is a paid pack. Unlock it before generating this mode.`,
            code: "READING_MODE_LOCKED",
            readingMode,
            unlockCost: modeConfig.unlockCost,
            remainingCredits: currentCredits,
          },
          { status: 403 }
        );
      }
    }

    const lens = getSymbolicLens({
      topic,
      readingMode,
      question,
      profile,
    });

    const { data: recentHistory, error: historyError } = await supabaseAdmin
      .from("messages")
      .select("topic,question,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (historyError) {
      console.warn("RECENT_HISTORY_LOAD_WARNING:", historyError);
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing DEEPSEEK_API_KEY on server." },
        { status: 500 }
      );
    }

    const prompt = buildPrompt({
      topic,
      readingMode,
      question,
      language,
      tone,
      depth,
      profile,
      lens,
      recentHistory: (recentHistory || []) as RecentMessageRow[],
    });

    const modelResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are SoulLoop, a safe symbolic reflection assistant. You must follow the user's selected language and selected reading mode. Never provide deterministic predictions or professional advice. Never claim that you actually cast a hexagram, drew physical cards, diagnosed personality, or calculated a metaphysical chart. You must use the user's profile and recent history as soft personalization context.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.65,
        max_tokens: depth === "quick" ? 500 : depth === "deep" ? 1500 : 900,
      }),
    });

    if (!modelResponse.ok) {
      const errorText = await modelResponse.text();

      console.error("MODEL_API_ERROR:", {
        status: modelResponse.status,
        statusText: modelResponse.statusText,
        errorText,
      });

      return NextResponse.json(
        {
          error: `Model API error ${modelResponse.status}: ${errorText}`,
          remainingCredits: currentCredits,
        },
        { status: 500 }
      );
    }

    const modelData = await modelResponse.json();

    const answer =
      modelData?.choices?.[0]?.message?.content ||
      "No answer returned from model.";

    const inputTokens =
      typeof modelData?.usage?.prompt_tokens === "number"
        ? modelData.usage.prompt_tokens
        : null;

    const outputTokens =
      typeof modelData?.usage?.completion_tokens === "number"
        ? modelData.usage.completion_tokens
        : null;

    const { data: messageRow, error: messageError } = await supabaseAdmin
      .from("messages")
      .insert({
        user_id: user.id,
        topic,
        question,
        answer,
        lens,
        language,
        tone,
        depth,
        credits_used: creditsUsed,
        model_used: model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      })
      .select("id")
      .single();

    if (messageError || !messageRow) {
      console.error("MESSAGE_SAVE_ERROR:", messageError);

      return NextResponse.json(
        {
          error:
            "Reading was generated, but failed to save history. Credits were not deducted. Please try again.",
          remainingCredits: currentCredits,
        },
        { status: 500 }
      );
    }

    let remainingCredits = currentCredits - creditsUsed;

    try {
      const creditResult = await applyCreditTransaction({
        userId: user.id,
        amount: -creditsUsed,
        type: "usage",
        reason: `reading_${readingMode}`,
        messageId: messageRow.id,
      });

      if (typeof creditResult.creditsBalance === "number") {
        remainingCredits = creditResult.creditsBalance;
      }
    } catch (creditError) {
      console.error("CREDIT_TRANSACTION_ERROR:", creditError);

      return NextResponse.json(
        {
          error:
            "Reading was saved, but the atomic credit transaction failed. Please contact support.",
          remainingCredits: currentCredits,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      answer,
      lens,
      usage: modelData?.usage || null,
      creditsUsed,
      readingMode,
      remainingCredits,
      messageId: messageRow.id,
    });
  } catch (error) {
    console.error("DEMO_CHAT_ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Internal server error: ${error.message}`
            : "Internal server error: unknown error",
      },
      { status: 500 }
    );
  }
}
