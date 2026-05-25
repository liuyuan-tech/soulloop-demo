export const READING_TOPICS = [
  {
    id: "love",
    label: "Love",
    description: "Romance, attraction, longing, and emotional timing.",
    examples: [
      "Will this connection become warmer?",
      "Why am I still thinking about them?",
      "What should I understand about my love life now?",
    ],
  },
  {
    id: "career",
    label: "Career",
    description: "Work direction, capability, timing, and next moves.",
    examples: [
      "Should I change my job?",
      "What is blocking my career growth?",
      "What should I focus on at work this month?",
    ],
  },
  {
    id: "money",
    label: "Money",
    description: "Resource flow, discipline, value creation, and risk.",
    examples: [
      "How should I think about money right now?",
      "What is my wealth pattern this month?",
      "Where should I be more careful financially?",
    ],
  },
  {
    id: "self",
    label: "Self",
    description: "Identity, habits, inner tension, and self-understanding.",
    examples: [
      "Why do I feel stuck lately?",
      "What part of myself needs attention?",
      "What is my next self-growth lesson?",
    ],
  },
  {
    id: "decision",
    label: "Decision",
    description: "Choice points, tradeoffs, timing, and grounded action.",
    examples: [
      "Should I move forward or wait?",
      "How do I compare these two choices?",
      "What am I not seeing in this decision?",
    ],
  },
  {
    id: "relationship",
    label: "Relationship",
    description: "Friends, family, partners, boundaries, and communication.",
    examples: [
      "What is the pattern between us?",
      "How should I handle this relationship?",
      "What boundary would help me most now?",
    ],
  },
] as const;

export type ReadingTopicId = (typeof READING_TOPICS)[number]["id"];

export const READING_MODES = [
  {
    id: "eastern_wisdom",
    label: "Eastern Wisdom",
    shortLabel: "Eastern",
    status: "Included",
    unlockCost: 0,
    creditCost: 8,
    description:
      "I Ching-style timing, Bagua, Yin-Yang, Five Elements, and life-theme reflection.",
  },
  {
    id: "tarot",
    label: "Tarot",
    shortLabel: "Tarot",
    status: "Paid Pack",
    unlockCost: 80,
    creditCost: 12,
    description:
      "A tarot-style archetype spread cross-checked with the Eastern wisdom baseline.",
  },
  {
    id: "color_personality",
    label: "Color Personality",
    shortLabel: "Color",
    status: "Paid Pack",
    unlockCost: 80,
    creditCost: 12,
    description:
      "A color-personality lens for motivation, stress style, communication, and decision bias.",
  },
  {
    id: "daily_loop",
    label: "Daily Loop",
    shortLabel: "Daily",
    status: "Paid Pack",
    unlockCost: 50,
    creditCost: 10,
    description:
      "A daily Co-Star-style loop with today's reminder, action, avoidance, and evening check-in.",
  },
] as const;

export type ReadingModeId = (typeof READING_MODES)[number]["id"];

export function normalizeReadingTopic(value?: string): ReadingTopicId {
  if (value === "self_growth" || value === "daily_energy" || value === "general") {
    return "self";
  }

  const match = READING_TOPICS.find((item) => item.id === value);
  return match?.id || "self";
}

export function normalizeReadingMode(value?: string): ReadingModeId {
  const match = READING_MODES.find((item) => item.id === value);
  return match?.id || "eastern_wisdom";
}

export function getReadingTopic(value?: string) {
  const normalized = normalizeReadingTopic(value);
  return READING_TOPICS.find((item) => item.id === normalized) || READING_TOPICS[3];
}

export function getReadingMode(value?: string) {
  const normalized = normalizeReadingMode(value);
  return READING_MODES.find((item) => item.id === normalized) || READING_MODES[0];
}
