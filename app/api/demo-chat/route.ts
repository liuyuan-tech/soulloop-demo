import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { applyCreditTransaction } from "@/lib/credits/apply-credit-transaction";

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
  bagua: string[];
  elements: string[];
  ziwei: string[];
  focus: string;
  interpretation: string;
};

type DemoChatRequest = {
  topic?: string;
  question?: string;
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
        energy: "能量主题",
        symbolic: "命理象征",
        profile: "个人背景映射",
        meaning: "这意味着什么",
        guidance: "给你的建议",
        avoid: "需要避免",
        reflection: "反思问题",
        disclaimer: "免责声明",
      },
    };
  }

  if (languageChoice === "english") {
    return {
      languageInstruction:
        "The user selected English. You must answer entirely in English, including all headings. Do not output Chinese.",
      headings: {
        energy: "Energy Theme",
        symbolic: "Symbolic Pattern",
        profile: "Personal Context Mapping",
        meaning: "What This Means",
        guidance: "Guidance",
        avoid: "What to Avoid",
        reflection: "Reflection Question",
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
        energy: "能量主题",
        symbolic: "命理象征",
        profile: "个人背景映射",
        meaning: "这意味着什么",
        guidance: "给你的建议",
        avoid: "需要避免",
        reflection: "反思问题",
        disclaimer: "免责声明",
      },
    };
  }

  return {
    languageInstruction:
      "The user asked in English. You must answer entirely in English, including all headings. Do not output Chinese.",
    headings: {
      energy: "Energy Theme",
      symbolic: "Symbolic Pattern",
      profile: "Personal Context Mapping",
      meaning: "What This Means",
      guidance: "Guidance",
      avoid: "What to Avoid",
      reflection: "Reflection Question",
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
    dream:
      "The user is asking about a dream. Interpret it as an emotional and symbolic reflection, not as a literal prediction.",
    daily_energy:
      "The user wants daily energy guidance. Keep it practical, reflective, and action-oriented.",
    decision:
      "The user is asking about a decision. Help compare tensions, timing, risks, and next steps. Do not make the decision for the user.",
    self_growth:
      "The user is asking about personal growth. Focus on emotional clarity, habits, inner patterns, and grounded next steps.",
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

function getSymbolicLens({
  topic,
  question,
  profile,
}: {
  topic: string;
  question: string;
  profile?: SoulLoopProfile | null;
}): SymbolicLens {
  const q = question.toLowerCase();
  const effectiveTopic = topic || profile?.currentFocus || "general";

  if (
    effectiveTopic === "love" ||
    q.includes("ex") ||
    q.includes("love") ||
    q.includes("relationship") ||
    q.includes("crush") ||
    q.includes("marry") ||
    q.includes("marriage")
  ) {
    return {
      topic: "Love / Relationship",
      bagua: ["Dui 兑", "Kan 坎", "Li 离"],
      elements: ["Water 水", "Fire 火", "Metal 金"],
      ziwei: ["Tai Yin 太阴", "Tian Ji 天机", "Tan Lang 贪狼"],
      focus:
        "emotional timing, communication, attraction, uncertainty, and boundaries",
      interpretation:
        "This reading uses Dui for communication and attraction, Kan for emotional uncertainty, and Li for visibility and passion. Tai Yin and Tian Ji-style themes help frame memory, attachment, and repeated thinking without promising a fixed romantic outcome.",
    };
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
    return {
      topic: "Career",
      bagua: ["Zhen 震", "Gen 艮", "Qian 乾", "Xun 巽"],
      elements: ["Wood 木", "Earth 土", "Metal 金"],
      ziwei: ["Tian Ji 天机", "Wu Qu 武曲", "Zi Wei 紫微"],
      focus:
        "movement, preparation, structure, execution, leadership, and timing",
      interpretation:
        "This reading uses Zhen for movement and new beginnings, Gen for pause and preparation, Qian for leadership, and Xun for gradual influence. Wu Qu and Tian Ji-style themes help frame discipline, strategy, and career direction.",
    };
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
    return {
      topic: "Money / Wealth",
      bagua: ["Xun 巽", "Dui 兑", "Kun 坤", "Qian 乾"],
      elements: ["Earth 土", "Metal 金", "Water 水"],
      ziwei: ["Wu Qu 武曲", "Tian Fu 天府", "Tan Lang 贪狼"],
      focus:
        "resource accumulation, discipline, opportunity flow, value exchange, and risk control",
      interpretation:
        "This reading uses Earth for the ability to hold resources, Metal for discipline and value judgment, and Water for opportunity flow and risk. Wu Qu and Tian Fu-style themes help frame wealth as execution, structure, and accumulation rather than guaranteed fortune.",
    };
  }

  if (
    effectiveTopic === "dream" ||
    q.includes("dream") ||
    q.includes("nightmare") ||
    q.includes("sleep")
  ) {
    return {
      topic: "Dream",
      bagua: ["Kan 坎", "Li 离", "Gen 艮"],
      elements: ["Water 水", "Fire 火", "Earth 土"],
      ziwei: ["Tai Yin 太阴", "Tian Ji 天机"],
      focus:
        "subconscious emotion, memory, hidden fear, symbolic visibility, and inner boundaries",
      interpretation:
        "This reading uses Kan for the subconscious and emotional depth, Li for images and visibility, and Gen for stillness and boundaries. Tai Yin and Tian Ji-style themes help interpret dreams as emotional symbols, not predictions.",
    };
  }

  if (
    effectiveTopic === "decision" ||
    q.includes("should i") ||
    q.includes("choose") ||
    q.includes("decision") ||
    q.includes("move forward") ||
    q.includes("wait")
  ) {
    return {
      topic: "Decision",
      bagua: ["Zhen 震", "Gen 艮", "Xun 巽", "Qian 乾"],
      elements: ["Wood 木", "Metal 金", "Earth 土"],
      ziwei: ["Tian Ji 天机", "Po Jun 破军", "Zi Wei 紫微"],
      focus:
        "action versus stillness, strategy, risk boundary, preparation, and timing",
      interpretation:
        "This reading uses Zhen for the urge to act, Gen for the wisdom of pausing, Xun for gradual movement, and Qian for decisive direction. Tian Ji and Po Jun-style themes help frame change without forcing a single answer.",
    };
  }

  if (
    effectiveTopic === "self_growth" ||
    q.includes("stuck") ||
    q.includes("growth") ||
    q.includes("purpose") ||
    q.includes("lost") ||
    q.includes("anxious")
  ) {
    return {
      topic: "Self-Growth",
      bagua: ["Gen 艮", "Kun 坤", "Kan 坎", "Li 离"],
      elements: ["Earth 土", "Water 水", "Fire 火"],
      ziwei: ["Tai Yin 太阴", "Tian Liang 天梁", "Tian Ji 天机"],
      focus:
        "inner stability, emotional safety, self-awareness, repair, and clarity",
      interpretation:
        "This reading uses Gen for stillness, Kun for support and grounding, Kan for emotional depth, and Li for clarity. Tai Yin and Tian Liang-style themes help frame emotional repair, maturity, and self-understanding.",
    };
  }

  return {
    topic: "General",
    bagua: ["Qian 乾", "Kun 坤", "Kan 坎"],
    elements: ["Yin-Yang 阴阳", "Earth 土", "Water 水"],
    ziwei: ["Zi Wei 紫微", "Tian Fu 天府", "Tian Ji 天机"],
    focus:
      "balance, timing, self-cultivation, stability, uncertainty, and grounded action",
    interpretation:
      "This reading uses Qian and Kun to frame active and receptive forces, Kan to represent uncertainty, and Earth-Water themes to balance grounding with flow. Zi Wei and Tian Fu-style themes help frame life direction and resource awareness.",
  };
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

function buildPrompt({
  topic,
  question,
  language,
  tone,
  depth,
  profile,
  lens,
}: {
  topic: string;
  question: string;
  language: string;
  tone: string;
  depth: string;
  profile: SoulLoopProfile;
  lens: SymbolicLens;
}) {
  const lang = detectLanguage(question, language);
  const topicInstruction = getTopicInstruction(topic);
  const toneInstruction = getToneInstruction(tone);
  const depthInstruction = getDepthInstruction(depth);
  const profileContext = formatProfile(profile);

  return `
You are SoulLoop, an AI symbolic reflection guide inspired by Eastern wisdom, Bagua symbolism, I Ching-style thinking, Yin-Yang balance, Five Elements, Zi Wei Dou Shu-style life-theme reflection, and practical self-discovery.

USER QUESTION:
${question}

USER PROFILE PROVIDED BY THE USER:
${profileContext}

IMPORTANT PROFILE USAGE INSTRUCTION:
You must use the user's provided profile as soft context when shaping the reading.

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
Use phrases like:
- "Given the context you shared..."
- "With your current focus in mind..."
- "Your profile suggests this reading may be most useful when viewed through..."
- "Because you marked your relationship status as..."
- "Because your current focus is..."

USER SELECTED TOPIC:
${topic}

SOULLOOP SYMBOLIC LENS:
Topic: ${lens.topic}
Bagua Lens: ${lens.bagua.join(", ")}
Five Elements: ${lens.elements.join(", ")}
Zi Wei Themes: ${lens.ziwei.join(", ")}
Reading Focus: ${lens.focus}
Lens Interpretation: ${lens.interpretation}

TOPIC-SPECIFIC GUIDANCE:
${topicInstruction}

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
Use the user profile only to personalize the tone, context, and relevance of the reading.
Do not claim that you have calculated a real chart from the user's birth date, birth time, or birth place.
Do not make deterministic claims based on birth information, gender, relationship status, or career status.
If profile fields are present, weave the most relevant ones naturally into the reading.
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

OUTPUT FORMAT:
# ${lang.headings.energy}
Write 1-2 short sentences using an Eastern wisdom tone.

# ${lang.headings.symbolic}
Explain the situation through the SoulLoop Symbolic Lens.
Use the provided Bagua Lens, Five Elements, Zi Wei Themes, Reading Focus, and Lens Interpretation.
Do not claim a real chart, hexagram, or divination was calculated.

# ${lang.headings.profile}
Use the saved user profile as soft context.
Mention the most relevant profile details, such as birth date/time as symbolic timing context, current focus, gender, relationship status, career status, and preferred language if relevant.
Keep this section grounded and non-deterministic.

# ${lang.headings.meaning}
Directly address the user's question with symbolic reflection and practical clarity.

# ${lang.headings.guidance}
Give 3 practical bullet points.

# ${lang.headings.avoid}
Give 2 bullet points.

# ${lang.headings.reflection}
Give 1 thoughtful question.

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
    const creditsUsed = STANDARD_READING_COST;

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

    const topic = body.topic || profile.currentFocus || "general";
    const language = body.language || profile.preferredLanguage || "same";

    const lens = getSymbolicLens({
      topic,
      question,
      profile,
    });

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
      question,
      language,
      tone,
      depth,
      profile,
      lens,
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
              "You are SoulLoop, a safe symbolic reflection assistant. You must follow the user's selected language. Never provide deterministic predictions or professional advice. Never claim that you actually cast a hexagram or calculated a metaphysical chart. You must use the user's provided profile as soft personalization context.",
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
        reason: "standard_reading",
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
