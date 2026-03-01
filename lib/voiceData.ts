/**
 * lib/voiceData.ts
 * Canonical source of truth for all voice definitions in the Lyric app.
 * All surfaces (composer UI, worker extension, API routes) import from here.
 *
 * ⚠️  HUME TOKEN CAVEAT: curated emotion humeToken values in palette.emotionGroups
 * are directionally correct but must be verified against exact Hume Expressions API
 * token keys before production use.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceId =
  | "morgan-anchor"
  | "nova-intimist"
  | "atlas-guide"
  | "riven-narrator"
  | "hex-wildcard"

export interface VariantConfig {
  /** Canonical Hume-registered intent name */
  intent: string
  /** Hume custom voice model ID */
  humeModelId: string
}

/**
 * Discriminated union:
 *  - "variant"  → routes via humeModelId lookup (Layer 1: Base Posture)
 *  - "emotion"  → sends as Hume `description` field  (Layer 2: Script Direction)
 */
export interface PaletteItem {
  label: string
  /** For type "variant": the intent string. For type "emotion": the humeToken. */
  value: string
  type: "variant" | "emotion"
  /** Hume Expressions API token key. Only present when type === "emotion". ⚠️ verify */
  humeToken?: string
}

export interface EmotionGroup {
  label: string
  items: PaletteItem[]
}

export interface VoicePalette {
  emotionGroups: EmotionGroup[]
}

export interface VoiceDefinition {
  id: VoiceId
  /** Display title, e.g. "Morgan · The Anchor" */
  title: string
  /** Short archetype label, e.g. "The Anchor" */
  archetype: string
  /** One-line positioning copy */
  blurb: string
  /** Edition label, e.g. "Edition 01 · Morgan" */
  edition: string
  /** Use-case verticals for UI tagging */
  verticals: string[]
  /** Ordered list of canonical Hume intent names */
  intents: string[]
  /** Intent to use when none is specified */
  defaultIntent: string
  /** intent → { intent, humeModelId } */
  variants: Record<string, VariantConfig>
  /** CSS gradient start color */
  gradientFrom: string
  /** CSS gradient end color */
  gradientTo: string
  /** R2 URL for the preview sample audio */
  sampleUrl: string
  /** Organized palette for the composer UI */
  palette: VoicePalette
  /** Deployment guardrail — describes off-label usage that degrades the voice */
  guardrail: string
}

// ---------------------------------------------------------------------------
// Voice definitions
// ---------------------------------------------------------------------------

const voices: VoiceDefinition[] = [
  // ── Morgan · The Anchor ───────────────────────────────────────────────────
  {
    id: "morgan-anchor",
    title: "Morgan · The Anchor",
    archetype: "The Anchor",
    blurb:
      "Decisive authority for enterprise, finance, and high-trust brand narration.",
    edition: "Edition 01 · Morgan",
    verticals: ["Enterprise", "Finance", "Brand Narration", "Legal"],
    intents: ["Authoritative", "Warm", "Composed"],
    defaultIntent: "Authoritative",
    variants: {
      Authoritative: {
        intent: "Authoritative",
        humeModelId: "f797f571",
      },
      Warm: {
        intent: "Warm",
        humeModelId: "8fe6ed5f",
      },
      Composed: {
        intent: "Composed",
        humeModelId: "b56771ff",
      },
    },
    gradientFrom: "#C4977F",
    gradientTo: "#E8D5C4",
    sampleUrl:
      "https://pub-af25e52138fa41559b794877a8400712.r2.dev/Voices/edition01/Morgan%20(sample).wav",
    palette: {
      emotionGroups: [
        {
          label: "Tonal Variants",
          items: [
            { label: "Authoritative", value: "Authoritative", type: "variant" },
            { label: "Warm", value: "Warm", type: "variant" },
            { label: "Composed", value: "Composed", type: "variant" },
          ],
        },
        {
          label: "Emotional Range",
          items: [
            { label: "Calm", value: "calm", type: "emotion", humeToken: "calm" },
            { label: "Determined", value: "determined", type: "emotion", humeToken: "determined" },
            { label: "Focused", value: "focused", type: "emotion", humeToken: "focused" },
            { label: "Reflective", value: "reflective", type: "emotion", humeToken: "reflective" },
            { label: "Confident", value: "confident", type: "emotion", humeToken: "confident" },
            { label: "Serene", value: "serene", type: "emotion", humeToken: "serene" },
          ],
        },
      ],
    },
    guardrail:
      "Do not use for emotional support, therapy-adjacent content, or casual consumer entertainment. This voice commands respect — misuse dilutes the authority.",
  },

  // ── Nova · The Intimist ───────────────────────────────────────────────────
  {
    id: "nova-intimist",
    title: "Nova · The Intimist",
    archetype: "The Intimist",
    blurb:
      "Presence, emotional safety, and authentic care for wellness, coaching, and human-centered brands.",
    edition: "Edition 01 · Nova",
    verticals: ["Wellness", "Coaching", "Mental Health", "Consumer Apps"],
    intents: ["Compassionate", "Encouraging", "Calm"],
    defaultIntent: "Compassionate",
    variants: {
      Compassionate: {
        intent: "Compassionate",
        humeModelId: "23e809d3",
      },
      Encouraging: {
        intent: "Encouraging",
        humeModelId: "870ede85",
      },
      Calm: {
        intent: "Calm",
        humeModelId: "ea32502c",
      },
    },
    gradientFrom: "#A8B59A",
    gradientTo: "#D9DECD",
    sampleUrl:
      "https://pub-af25e52138fa41559b794877a8400712.r2.dev/Voices/edition01/Nova_calm%20(sample).wav",
    palette: {
      emotionGroups: [
        {
          label: "Tonal Variants",
          items: [
            { label: "Compassionate", value: "Compassionate", type: "variant" },
            { label: "Encouraging", value: "Encouraging", type: "variant" },
            { label: "Calm", value: "Calm", type: "variant" },
          ],
        },
        {
          label: "Emotional Range",
          items: [
            { label: "Excited", value: "excited", type: "emotion", humeToken: "excited" },
            { label: "Curious", value: "curious", type: "emotion", humeToken: "curious" },
            { label: "Confident", value: "confident", type: "emotion", humeToken: "confident" },
          ],
        },
      ],
    },
    guardrail:
      "Do not use for corporate authority, sales pressure, or competitive framing. This voice operates through safety and presence — it must never feel performative.",
  },

  // ── Atlas · The Guide ─────────────────────────────────────────────────────
  {
    id: "atlas-guide",
    title: "Atlas · The Guide",
    archetype: "The Guide",
    blurb:
      "Clarity, patience, and credibility for product walkthroughs, tutorials, and instructional content.",
    edition: "Edition 01 · Atlas",
    verticals: ["Product", "Education", "Tutorials", "Documentation"],
    intents: ["Patient", "Clear", "Supportive"],
    defaultIntent: "Patient",
    variants: {
      Patient: {
        intent: "Patient",
        humeModelId: "5aa01bac",
      },
      Clear: {
        intent: "Clear",
        humeModelId: "1031de39",
      },
      Supportive: {
        intent: "Supportive",
        humeModelId: "e5cba950",
      },
    },
    gradientFrom: "#9D9B92",
    gradientTo: "#CDC9BE",
    sampleUrl:
      "https://pub-af25e52138fa41559b794877a8400712.r2.dev/Voices/edition01/Atlas_sample.wav",
    palette: {
      emotionGroups: [
        {
          label: "Tonal Variants",
          items: [
            { label: "Patient", value: "Patient", type: "variant" },
            { label: "Clear", value: "Clear", type: "variant" },
            { label: "Supportive", value: "Supportive", type: "variant" },
          ],
        },
        {
          label: "Emotional Range",
          items: [
            { label: "Awe", value: "awe", type: "emotion", humeToken: "awe" },
            { label: "Determined", value: "determined", type: "emotion", humeToken: "determined" },
            { label: "Focused", value: "focused", type: "emotion", humeToken: "focused" },
            { label: "Calm", value: "calm", type: "emotion", humeToken: "calm" },
            { label: "Reflective", value: "reflective", type: "emotion", humeToken: "reflective" },
            { label: "Serious", value: "serious", type: "emotion", humeToken: "serious" },
          ],
        },
      ],
    },
    guardrail:
      "Do not use for entertainment narration, emotional storytelling, or opinion content. This voice explains — it must never editorialize.",
  },

  // ── Riven · The Narrator ──────────────────────────────────────────────────
  {
    id: "riven-narrator",
    title: "Riven · The Narrator",
    archetype: "The Narrator",
    blurb:
      "Depth, texture, and narrative weight for brand films, audiobooks, and documentary storytelling.",
    edition: "Edition 01 · Riven",
    verticals: ["Brand Films", "Audiobooks", "Documentary", "Storytelling"],
    intents: ["Intrigue", "Tension", "Wonder"],
    defaultIntent: "Intrigue",
    variants: {
      Intrigue: {
        intent: "Intrigue",
        humeModelId: "e74117b3",
      },
      Tension: {
        intent: "Tension",
        humeModelId: "8cb5756e",
      },
      Wonder: {
        intent: "Wonder",
        humeModelId: "e4435d9a",
      },
    },
    gradientFrom: "#9C8275",
    gradientTo: "#C8B8AD",
    sampleUrl:
      "https://pub-af25e52138fa41559b794877a8400712.r2.dev/Voices/edition01/Riven%20(sample).wav",
    palette: {
      emotionGroups: [
        {
          label: "Tonal Variants",
          items: [
            { label: "Intrigue", value: "Intrigue", type: "variant" },
            { label: "Tension", value: "Tension", type: "variant" },
            { label: "Wonder", value: "Wonder", type: "variant" },
          ],
        },
        {
          label: "Emotional Range",
          items: [
            { label: "Tense", value: "tense", type: "emotion", humeToken: "tense" },
            { label: "Melancholic", value: "melancholic", type: "emotion", humeToken: "melancholic" },
            { label: "Suspenseful", value: "suspenseful", type: "emotion", humeToken: "suspenseful" },
            { label: "Wistful", value: "wistful", type: "emotion", humeToken: "wistful" },
            { label: "Somber", value: "somber", type: "emotion", humeToken: "somber" },
          ],
        },
      ],
    },
    guardrail:
      "Do not use for transactional copy, instructional content, or upbeat brand moments. This voice carries weight — it must never feel light.",
  },

  // ── Hex · The Wildcard ────────────────────────────────────────────────────
  {
    id: "hex-wildcard",
    title: "Hex · The Wildcard",
    archetype: "The Wildcard",
    blurb:
      "Sharp wit for social campaigns, creator content, and bold brand voice.",
    edition: "Edition 01 · Hex",
    verticals: ["Social", "Creator", "Brand Voice", "Advertising"],
    intents: ["Playful", "Ironic", "Bold"],
    defaultIntent: "Playful",
    variants: {
      Playful: {
        intent: "Playful",
        humeModelId: "773e210a",
      },
      Ironic: {
        intent: "Ironic",
        humeModelId: "7b64105f",
      },
      Bold: {
        intent: "Bold",
        humeModelId: "0f5ab13e",
      },
    },
    gradientFrom: "#B87A5C",
    gradientTo: "#E5C4B3",
    sampleUrl:
      "https://pub-af25e52138fa41559b794877a8400712.r2.dev/Voices/edition01/Hex%20(sample).wav",
    palette: {
      emotionGroups: [
        {
          label: "Tonal Variants",
          items: [
            { label: "Playful", value: "Playful", type: "variant" },
            { label: "Ironic", value: "Ironic", type: "variant" },
            { label: "Bold", value: "Bold", type: "variant" },
          ],
        },
        {
          label: "Emotional Range",
          items: [
            { label: "Amused", value: "amused", type: "emotion", humeToken: "amused" },
            { label: "Excited", value: "excited", type: "emotion", humeToken: "excited" },
            { label: "Defiant", value: "defiant", type: "emotion", humeToken: "defiant" },
            { label: "Confident", value: "confident", type: "emotion", humeToken: "confident" },
            { label: "Proud", value: "proud", type: "emotion", humeToken: "proud" },
            { label: "Curious", value: "curious", type: "emotion", humeToken: "curious" },
          ],
        },
      ],
    },
    guardrail:
      "Do not use for sensitive topics, health content, legal or financial guidance, or brand trust moments. This voice disrupts — deploy only where disruption is the intent.",
  },
]

// ---------------------------------------------------------------------------
// Display ordering
// ---------------------------------------------------------------------------

export const VOICE_ORDER: VoiceId[] = [
  "morgan-anchor",
  "nova-intimist",
  "atlas-guide",
  "riven-narrator",
  "hex-wildcard",
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Returns all voice definitions in canonical display order. */
export function getAllVoices(): VoiceDefinition[] {
  return VOICE_ORDER.map((id) => {
    const v = voices.find((v) => v.id === id)
    if (!v) throw new Error(`voiceData: unknown id "${id}" in VOICE_ORDER`)
    return v
  })
}

/** Returns a single voice definition by ID. Throws if not found. */
export function getVoice(id: VoiceId): VoiceDefinition {
  const v = voices.find((v) => v.id === id)
  if (!v) throw new Error(`voiceData: unknown voice id "${id}"`)
  return v
}

/**
 * Resolves the Hume model ID for a voice + intent pair.
 * Falls back to the voice's defaultIntent if `intent` is not found.
 *
 * @example
 *   resolveModelId("nova-intimist", "Calm")      // → "ea32502c"
 *   resolveModelId("nova-intimist", "unknown")   // → "23e809d3" (defaultIntent fallback)
 */
export function resolveModelId(voiceId: VoiceId, intent: string): string {
  const voice = getVoice(voiceId)
  const variant = voice.variants[intent] ?? voice.variants[voice.defaultIntent]
  if (!variant) {
    throw new Error(
      `voiceData: no variant found for voice "${voiceId}" intent "${intent}" (defaultIntent "${voice.defaultIntent}" also missing)`
    )
  }
  return variant.humeModelId
}
