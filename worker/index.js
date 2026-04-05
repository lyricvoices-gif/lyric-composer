/**
 * Lyric Voice API Worker (Hume-only, Edition 01)
 *
 * Phase 2 Changes:
 * - VOICE_MODELS updated to canonical variant names (no legacy aliases)
 * - Riven Intrigue model ID fixed (was duplicate of Tension)
 * - Segments array support: per-segment intent routing + description acting instructions
 * - generateHumeMulti: single Hume call with multiple utterances (Hume handles concat)
 * - Backward compatibility fully preserved for mini composer global mode
 *
 * Phase 3 Changes:
 * - Plan-gated audio format: accepts `format` ("mp3" | "wav") from Next.js route
 * - Creator tier → MP3; Studio/Enterprise → WAV (lossless from Hume source)
 * - Content-Type response header is now format-aware
 *
 * Phase 4 Changes:
 * - Per-segment leading silence/filler trimming for WAV audio
 * - Detects and strips leading silence + short filler sounds (breaths, "um"s)
 *   from each segment before concatenation
 * - Preserves natural speech onset with small backoff
 * - Falls back gracefully for MP3 (frame-level trimming)
 *
 * Payload shapes supported:
 * - Global (mini composer): { voiceId, script, emotionalIntent, variant, direction }
 * - Inline (full composer): { voiceId, script, variant, direction, segments[], format? }
 */
var __defProp = Object.defineProperty
var __name = (target, value) =>
  __defProp(target, "name", { value, configurable: true })

// ---------------------------
// Voice routing config (Hume)
// ---------------------------
var VOICE_MODELS = {
  "morgan-anchor": {
    provider: "hume",
    intents: {
      Authoritative: { modelId: "f797f571-642e-45dd-ac11-cf8738259f04" },
      Warm:          { modelId: "8fe6ed5f-f9c6-4756-a411-a6411d51fea5" },
      Composed:      { modelId: "b56771ff-bc86-487e-a423-ebceb95b6325" },
    },
  },
  "nova-intimist": {
    provider: "hume",
    intents: {
      Compassionate: { modelId: "23e809d3-0e99-43e7-aa3a-0f9f180e5d43" },
      Encouraging:   { modelId: "870ede85-a74e-40f0-b513-3f79da9b609f" },
      Calm:          { modelId: "ea32502c-05fc-45aa-929d-0fa7d402007c" },
    },
  },
  "atlas-guide": {
    provider: "hume",
    intents: {
      Patient:    { modelId: "5aa01bac-19ee-48ea-be54-d71cba9e6d5b" },
      Clear:      { modelId: "1031de39-8adf-488b-9528-af60759d0dd3" },
      Supportive: { modelId: "e5cba950-cd44-491d-bf48-ebf833eb8eed" },
    },
  },
  "riven-narrator": {
    provider: "hume",
    intents: {
      Intrigue: { modelId: "e74117b3-623d-49a7-9351-be6b3f3a9598" },
      Tension:  { modelId: "8cb5756e-1e5d-4a09-bd81-13fde203e862" },
      Wonder:   { modelId: "e4435d9a-8fe6-4330-98b5-0b5f4a3a03d6" },
    },
  },
  "hex-wildcard": {
    provider: "hume",
    intents: {
      Playful: { modelId: "773e210a-62f5-49ab-bfb6-af00a111d0aa" },
      Ironic:  { modelId: "7b64105f-7d6f-4b0b-bc1d-2445bf11b2a3" },
      Bold:    { modelId: "0f5ab13e-27cb-499e-ae6b-eaeff3ef96dc" },
    },
  },
}

// ---------------------------
// Audio trimming utilities
// ---------------------------

/**
 * Trim leading silence and short filler sounds from a WAV audio buffer.
 *
 * Strategy:
 *  1. Skip initial silence (RMS below silenceThreshold)
 *  2. Check if the first sound burst is a short filler (<fillerMaxMs)
 *     followed by another quiet gap — if so, skip past it
 *  3. Back off ~10ms so we don't clip the speech onset
 *
 * Returns a new ArrayBuffer with trimmed WAV data.
 * If the input is not valid WAV or no trimming is needed, returns the original.
 */
function trimLeadingFillerWav(audioBuffer, opts = {}) {
  const {
    silenceThreshold = 0.008,
    speechThreshold  = 0.025,
    fillerMaxMs      = 400,
    maxScanMs        = 1500,
  } = opts

  const view = new DataView(audioBuffer)

  // Validate WAV header
  if (audioBuffer.byteLength < 44) return audioBuffer
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
  if (riff !== "RIFF") return audioBuffer

  const numChannels  = view.getUint16(22, true)
  const sampleRate   = view.getUint32(24, true)
  const bitsPerSample = view.getUint16(34, true)

  if (bitsPerSample !== 16 && bitsPerSample !== 24 && bitsPerSample !== 32) return audioBuffer

  // Find the "data" chunk
  let dataOffset = 12
  let dataSize = 0
  while (dataOffset < audioBuffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(dataOffset),
      view.getUint8(dataOffset + 1),
      view.getUint8(dataOffset + 2),
      view.getUint8(dataOffset + 3)
    )
    const chunkSize = view.getUint32(dataOffset + 4, true)
    if (chunkId === "data") {
      dataOffset += 8
      dataSize = chunkSize
      break
    }
    dataOffset += 8 + chunkSize
    // Align to even byte boundary
    if (dataOffset % 2 !== 0) dataOffset++
  }

  if (dataSize === 0) return audioBuffer

  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const totalSamples = Math.floor(dataSize / blockAlign)
  const windowSamples = Math.floor(sampleRate * 0.02) // 20ms window
  const maxScanSamples = Math.min(Math.floor((maxScanMs / 1000) * sampleRate), totalSamples)
  const fillerMaxSamples = Math.floor((fillerMaxMs / 1000) * sampleRate)

  // Read a sample value normalized to [-1, 1]
  function readSample(sampleIndex, channel) {
    const bytePos = dataOffset + sampleIndex * blockAlign + channel * bytesPerSample
    if (bytePos + bytesPerSample > audioBuffer.byteLength) return 0
    if (bitsPerSample === 16) {
      return view.getInt16(bytePos, true) / 32768
    } else if (bitsPerSample === 24) {
      const b0 = view.getUint8(bytePos)
      const b1 = view.getUint8(bytePos + 1)
      const b2 = view.getUint8(bytePos + 2)
      let val = (b2 << 16) | (b1 << 8) | b0
      if (val >= 0x800000) val -= 0x1000000
      return val / 8388608
    } else {
      // 32-bit
      return view.getInt32(bytePos, true) / 2147483648
    }
  }

  // Compute RMS for a window starting at sample index
  function rms(start) {
    let sum = 0
    const end = Math.min(start + windowSamples, totalSamples)
    const count = end - start
    if (count <= 0) return 0
    for (let i = start; i < end; i++) {
      // Average across channels
      let sampleSum = 0
      for (let ch = 0; ch < numChannels; ch++) {
        sampleSum += readSample(i, ch)
      }
      const avg = sampleSum / numChannels
      sum += avg * avg
    }
    return Math.sqrt(sum / count)
  }

  // Phase 1: skip leading silence
  let i = 0
  while (i < maxScanSamples && rms(i) < silenceThreshold) {
    i += windowSamples
  }

  // Phase 2: check if initial sound burst is a short filler
  const firstSoundStart = i
  while (i < maxScanSamples && (i - firstSoundStart) < fillerMaxSamples && rms(i) >= silenceThreshold) {
    i += windowSamples
  }

  if ((i - firstSoundStart) < fillerMaxSamples && i < maxScanSamples && rms(i) < silenceThreshold) {
    // This was a filler — skip the quiet gap after it
    while (i < maxScanSamples && rms(i) < silenceThreshold) {
      i += windowSamples
    }
  } else {
    // Not a filler — first sound was real speech
    i = firstSoundStart
  }

  // Only trim if we found sustained speech
  if (i <= 0 || i >= maxScanSamples || rms(i) < speechThreshold) {
    return audioBuffer
  }

  // Back off ~10ms to preserve natural onset
  const backoffSamples = Math.floor(sampleRate * 0.01)
  const trimStart = Math.max(0, i - backoffSamples)

  // Build new WAV with trimmed samples
  const newTotalSamples = totalSamples - trimStart
  const newDataSize = newTotalSamples * blockAlign
  const newHeaderSize = dataOffset  // Keep the same header structure
  const newBuffer = new ArrayBuffer(newHeaderSize + newDataSize)
  const newView = new DataView(newBuffer)

  // Copy everything up to the data chunk
  const srcBytes = new Uint8Array(audioBuffer)
  const dstBytes = new Uint8Array(newBuffer)
  dstBytes.set(srcBytes.subarray(0, dataOffset), 0)

  // Update RIFF chunk size
  newView.setUint32(4, newBuffer.byteLength - 8, true)

  // Update data chunk size (it's at dataOffset - 4)
  newView.setUint32(dataOffset - 4, newDataSize, true)

  // Copy trimmed audio data
  const srcStart = dataOffset + trimStart * blockAlign
  const srcEnd = dataOffset + dataSize
  const copyLen = Math.min(srcEnd - srcStart, newDataSize)
  dstBytes.set(srcBytes.subarray(srcStart, srcStart + copyLen), dataOffset)

  return newBuffer
}
__name(trimLeadingFillerWav, "trimLeadingFillerWav")

/**
 * Trim leading silence from MP3 audio by scanning for silent frames.
 *
 * MP3 frames are typically ~26ms each at 44.1kHz. We scan frames, compute
 * the max absolute sample value of each frame's data bytes, and skip
 * frames that are below the threshold until we find speech.
 *
 * This is a simpler/coarser approach than WAV trimming since we work with
 * compressed data, but still effective for removing leading silence and
 * short filler bursts.
 */
function trimLeadingFillerMp3(audioBuffer, opts = {}) {
  const {
    maxScanBytes   = 64000,  // ~1.5s at 128kbps
    fillerMaxBytes = 20000,  // ~0.4s at 128kbps
    silenceByteThreshold = 2, // max abs byte value to consider "silent"
  } = opts

  const bytes = new Uint8Array(audioBuffer)
  if (bytes.length < 1000) return audioBuffer

  // Find MP3 frame sync words and measure their "energy"
  const frames = []
  let pos = 0

  // Skip ID3v2 tag if present
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const tagSize = ((bytes[6] & 0x7F) << 21) |
                    ((bytes[7] & 0x7F) << 14) |
                    ((bytes[8] & 0x7F) << 7)  |
                     (bytes[9] & 0x7F)
    pos = 10 + tagSize
  }

  const scanLimit = Math.min(pos + maxScanBytes, bytes.length)

  // MP3 bitrate table for MPEG1 Layer 3
  const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
  const sampleRates = [44100, 48000, 32000, 0]

  while (pos < scanLimit - 4) {
    // Look for frame sync (11 set bits)
    if (bytes[pos] === 0xFF && (bytes[pos + 1] & 0xE0) === 0xE0) {
      const bitrateIdx = (bytes[pos + 2] >> 4) & 0x0F
      const srIdx = (bytes[pos + 2] >> 2) & 0x03
      const padding = (bytes[pos + 2] >> 1) & 0x01

      const bitrate = bitrates[bitrateIdx]
      const sr = sampleRates[srIdx]

      if (bitrate > 0 && sr > 0) {
        const frameSize = Math.floor((144 * bitrate * 1000) / sr) + padding

        if (pos + frameSize <= bytes.length) {
          // Measure "energy" of frame data (skip 4-byte header + side info ~32 bytes)
          const dataStart = pos + 36
          const dataEnd = Math.min(pos + frameSize, bytes.length)
          let maxAbs = 0
          for (let j = dataStart; j < dataEnd; j++) {
            const v = Math.abs(bytes[j] - 128)
            if (v > maxAbs) maxAbs = v
          }

          frames.push({ offset: pos, size: frameSize, energy: maxAbs })
          pos += frameSize
          continue
        }
      }
    }
    pos++
  }

  if (frames.length < 3) return audioBuffer

  // Phase 1: skip leading silent frames
  let fi = 0
  while (fi < frames.length && frames[fi].energy <= silenceByteThreshold) fi++

  // Phase 2: check for filler burst
  const firstSoundFrame = fi
  let fillerBytes = 0
  while (fi < frames.length && fillerBytes < fillerMaxBytes && frames[fi].energy > silenceByteThreshold) {
    fillerBytes += frames[fi].size
    fi++
  }

  if (fillerBytes < fillerMaxBytes && fi < frames.length && frames[fi].energy <= silenceByteThreshold) {
    // Skip quiet gap after filler
    while (fi < frames.length && frames[fi].energy <= silenceByteThreshold) fi++
  } else {
    fi = firstSoundFrame
  }

  if (fi <= 0 || fi >= frames.length) return audioBuffer

  // Back off 1 frame to preserve onset
  const trimFrame = Math.max(0, fi - 1)
  const trimOffset = frames[trimFrame].offset

  // Copy any leading ID3 tag + trimmed audio
  const id3End = frames[0].offset
  const id3Bytes = bytes.subarray(0, id3End)
  const audioBytes = bytes.subarray(trimOffset)
  const result = new Uint8Array(id3Bytes.length + audioBytes.length)
  result.set(id3Bytes, 0)
  result.set(audioBytes, id3Bytes.length)
  return result.buffer
}
__name(trimLeadingFillerMp3, "trimLeadingFillerMp3")

/**
 * Trim leading filler from audio, dispatching by format.
 */
function trimLeadingFiller(audioBuffer, format) {
  try {
    if (format === "wav") {
      return trimLeadingFillerWav(audioBuffer)
    } else {
      return trimLeadingFillerMp3(audioBuffer)
    }
  } catch (e) {
    // Any error — return original untouched
    console.error("[trimLeadingFiller] Error:", e)
    return audioBuffer
  }
}
__name(trimLeadingFiller, "trimLeadingFiller")

// ---------------------------
// Worker entry
// ---------------------------
var index_default = {
  async fetch(request, env) {
    const { method } = request
    if (method === "OPTIONS") return handleCORS()
    if (method === "GET") {
      return jsonResponse(
        {
          ok: true,
          service: "Lyric Voice API Worker",
          provider: "hume",
          version: "edition01-hume-phase4-filler-trim",
          modes: ["global", "inline"],
          improvements: [
            "Phase 4: Per-segment leading filler/silence trimming (WAV + MP3)",
            "Phase 3: Plan-gated audio format (mp3 for Creator, wav for Studio/Enterprise)",
            "Phase 2: Segments array with per-segment intent routing",
            "Phase 2: Description acting instructions for inline emotion tags (Hume v1)",
            "Phase 2: Riven Intrigue model ID fixed",
            "Phase 2: Canonical variant names only — legacy aliases removed",
            "Phase 1: Addresses, ordinals, currency, time, percentages",
            "Phase 1: Measurements, abbreviations, fractions",
            "Phase 1: Dates, phone numbers, emails/URLs, Roman numerals",
            "Phase 1: Phonetic normalization (25+ acronyms)",
            "Phase 1: Enhanced text shaping for pace/emphasis/affect",
          ],
          usage: {
            method: "POST",
            contentType: "application/json",
            globalPayload: {
              voiceId: "morgan-anchor",
              script: "Your script here.",
              variant: "Authoritative",
              direction: {
                mode: "global",
                intent: "Authoritative",
                preset: { pace: "steady", energy: "decisive", emphasis: "key statements", affect: "executive" },
              },
            },
            inlinePayload: {
              voiceId: "morgan-anchor",
              script: "Full script text.",
              variant: "Authoritative",
              direction: { mode: "inline", intent: "Authoritative" },
              format: "wav",
              segments: [
                { text: "Here is the main point.", intent: "Authoritative" },
                { text: "This phrase needs emphasis.", intent: "calm, measured" },
                { text: "A moment of quiet.", intent: "Pause" },
              ],
            },
          },
          availableVoices: Object.keys(VOICE_MODELS),
        },
        200
      )
    }
    if (method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405)
    }
    try {
      const body = await safeJson(request)
      const voiceId = body.voiceId
      const scriptRaw = body.script
      const requestedIntent = body.emotionalIntent || body.variant
      const direction = body.direction || null
      const preset = direction && direction.preset ? direction.preset : null
      const segments =
        body.segments && Array.isArray(body.segments) && body.segments.length > 0
          ? body.segments
          : null

      // Phase 3: audio format, validated server-side
      const format = body.format === "wav" ? "wav" : "mp3"

      if (!voiceId || !scriptRaw || !requestedIntent) {
        return jsonResponse(
          {
            error: "Missing required fields",
            required: ["voiceId", "script", "emotionalIntent (or variant)"],
            received: {
              voiceId: Boolean(voiceId),
              script: Boolean(scriptRaw),
              emotionalIntent: Boolean(body.emotionalIntent),
              variant: Boolean(body.variant),
            },
          },
          400
        )
      }
      const script = String(scriptRaw).trim()
      if (!script) {
        return jsonResponse(
          { error: "Script is empty", required: ["script (non-empty)"] },
          400
        )
      }
      const voiceConfig = VOICE_MODELS[voiceId]
      if (!voiceConfig) {
        return jsonResponse(
          { error: "Voice not found", availableVoices: Object.keys(VOICE_MODELS) },
          404
        )
      }
      const intentConfig = resolveIntentConfig(voiceConfig, requestedIntent)
      if (!intentConfig) {
        return jsonResponse(
          {
            error: "Intent not found for this voice",
            requestedIntent,
            availableIntents: Object.keys(voiceConfig.intents),
          },
          400
        )
      }
      if (
        intentConfig.modelId &&
        typeof intentConfig.modelId === "string" &&
        intentConfig.modelId.startsWith("PLACEHOLDER_")
      ) {
        return jsonResponse(
          {
            error: "Voice not yet configured",
            message: `${voiceId} is not ready. Please add the Hume model IDs.`,
            placeholderId: intentConfig.modelId,
          },
          503
        )
      }
      const startedAt = Date.now()
      const contentType = format === "wav" ? "audio/wav" : "audio/mpeg"

      // -------------------------------------------------
      // INLINE SEGMENTS MODE
      // -------------------------------------------------
      if (segments) {
        const utterances = segments
          .map((seg) => {
            const segText = normalizeText(String(seg.text || "").trim())
            if (!segText) return null
            const segIntent = String(seg.intent || "").trim()
            const isPause = segIntent.toLowerCase() === "pause"
            const segIntentConfig = segIntent
              ? resolveIntentConfig(voiceConfig, segIntent)
              : null
            const segModelId = segIntentConfig
              ? segIntentConfig.modelId
              : intentConfig.modelId
            const description =
              !isPause && segIntent && !segIntentConfig
                ? segIntent.slice(0, 100)
                : null
            return {
              text: segText,
              voice: { id: segModelId, provider: "CUSTOM_VOICE" },
              ...(description ? { description } : {}),
              ...(isPause ? { trailing_silence: 0.5 } : {}),
            }
          })
          .filter(Boolean)
        if (utterances.length === 0) {
          return jsonResponse({ error: "No valid segments after normalization" }, 400)
        }
        const audioData = await generateHumeMulti(utterances, env.HUME_API_KEY, format)

        // Phase 4: trim leading filler from the generated audio
        const trimmedAudio = trimLeadingFiller(audioData, format)

        const durationMs = Date.now() - startedAt
        const headers = {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "X-Voice-Provider": "hume",
          "X-Generation-Attempts": "1",
          "X-Generation-Quality": "good",
          "X-Generation-Variance": "0",
          "X-Voice-Id": String(voiceId),
          "X-Voice-Intent": String(requestedIntent),
          "X-Hume-Model-Id": String(intentConfig.modelId),
          "X-Direction-Mode": "inline",
          "X-Segment-Count": String(utterances.length),
          "X-Generation-Time-Ms": String(durationMs),
          "X-Audio-Format": format,
        }
        return new Response(trimmedAudio, { headers })
      }

      // -------------------------------------------------
      // GLOBAL MODE
      // -------------------------------------------------
      const shapedText = applyGlobalDirectionShaping(script, preset)
      const audioData = await generateHume(
        intentConfig.modelId,
        shapedText,
        env.HUME_API_KEY,
        preset,
        format
      )

      // Phase 4: trim leading filler from global mode too
      const trimmedAudio = trimLeadingFiller(audioData, format)

      const durationMs = Date.now() - startedAt
      const headers = {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
        "X-Voice-Provider": "hume",
        "X-Generation-Attempts": "1",
        "X-Generation-Quality": "good",
        "X-Generation-Variance": "0",
        "X-Voice-Id": String(voiceId),
        "X-Voice-Intent": String(requestedIntent),
        "X-Hume-Model-Id": String(intentConfig.modelId),
        "X-Generation-Time-Ms": String(durationMs),
        "X-Direction-Mode": direction?.mode ? String(direction.mode) : "none",
        "X-Direction-Intent": direction?.intent ? String(direction.intent) : "none",
        "X-Direction-Preset": preset ? compactPresetForHeader(preset) : "none",
        "X-Audio-Format": format,
      }
      return new Response(trimmedAudio, { headers })
    } catch (error) {
      console.error("Error:", error)
      return jsonResponse(
        {
          error: "Internal server error",
          message: error && error.message ? error.message : String(error),
        },
        500
      )
    }
  },
}

// ---------------------------
// Helpers
// ---------------------------
function resolveIntentConfig(voiceConfig, requestedIntent) {
  if (!voiceConfig || !voiceConfig.intents) return null
  const intents = voiceConfig.intents
  const key = String(requestedIntent || "").trim()
  if (!key) return null
  if (intents[key]) return intents[key]
  const lower = key.toLowerCase()
  const match = Object.keys(intents).find((k) => k.toLowerCase() === lower)
  if (match) return intents[match]
  return null
}
__name(resolveIntentConfig, "resolveIntentConfig")

async function safeJson(request) {
  try {
    return await request.json()
  } catch (e) {
    throw new Error("Invalid JSON body")
  }
}
__name(safeJson, "safeJson")

function compactPresetForHeader(preset) {
  const pace = preset.pace ? String(preset.pace) : ""
  const energy = preset.energy ? String(preset.energy) : ""
  const emphasis = preset.emphasis ? String(preset.emphasis) : ""
  const affect = preset.affect ? String(preset.affect) : ""
  return [pace, energy, emphasis, affect].filter(Boolean).join("|").slice(0, 160)
}
__name(compactPresetForHeader, "compactPresetForHeader")

// ---------------------------
// Global audible shaping (global mode only)
// ---------------------------
function applyGlobalDirectionShaping(text, preset) {
  const base = normalizeText(text)
  if (!preset) return base
  const pace = String(preset.pace || "").toLowerCase()
  const emphasis = String(preset.emphasis || "").toLowerCase()
  const affect = String(preset.affect || "").toLowerCase()
  let out = base
  if (pace.includes("slow")) {
    out = addBreathingRoom(out)
  } else if (pace.includes("measured") || pace.includes("flowing")) {
    out = addGentleCadence(out)
  } else if (pace.includes("quick") || pace.includes("brisk") || pace.includes("tight")) {
    out = tightenCadence(out)
  }
  if (emphasis.includes("questions")) {
    out = emphasizeQuestions(out)
  } else if (emphasis.includes("step") || emphasis.includes("key terms") || emphasis.includes("key phrases")) {
    out = addMicroPausesForClarity(out)
  } else if (emphasis.includes("deadpan") || affect.includes("dry") || affect.includes("sardonic")) {
    out = flattenExclamation(out)
  }
  if (affect.includes("urgent")) {
    out = addUrgency(out)
  } else if (affect.includes("warm") || affect.includes("comfort")) {
    out = softenEdges(out)
  }
  return out
}
__name(applyGlobalDirectionShaping, "applyGlobalDirectionShaping")

// ---------------------------
// Phonetic normalization
// ---------------------------
function normalizeText(text) {
  let normalized = String(text)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  normalized = normalizeOrdinals(normalized)
  normalized = normalizeCurrency(normalized)
  normalized = normalizeTime(normalized)
  normalized = normalizePercentages(normalized)
  normalized = normalizeMeasurements(normalized)
  normalized = normalizeAbbreviations(normalized)
  normalized = normalizeFractions(normalized)
  normalized = normalizeDates(normalized)
  normalized = normalizePhoneNumbers(normalized)
  normalized = normalizeEmailsAndUrls(normalized)
  normalized = normalizeRomanNumerals(normalized)
  normalized = normalizeSlashes(normalized)
  normalized = optimizeListPauses(normalized)
  normalized = normalizeProblematicWords(normalized)
  return normalized
}
__name(normalizeText, "normalizeText")

function normalizeOrdinals(text) {
  return text.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (match, num) => {
    return numberToOrdinal(parseInt(num))
  })
}
__name(normalizeOrdinals, "normalizeOrdinals")

function numberToOrdinal(n) {
  const ones = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"]
  const teens = ["tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth"]
  const tens = ["", "", "twentieth", "thirtieth", "fortieth", "fiftieth", "sixtieth", "seventieth", "eightieth", "ninetieth"]
  const tensRegular = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
  if (n < 10) return ones[n]
  if (n < 20) return teens[n - 10]
  if (n < 100) {
    const td = Math.floor(n / 10)
    const od = n % 10
    if (od === 0) return tens[td]
    return `${tensRegular[td]}-${ones[od]}`
  }
  if (n < 1000) {
    const h = Math.floor(n / 100)
    const r = n % 100
    if (r === 0) return `${numberToWords(h)} hundredth`
    return `${numberToWords(h)} hundred ${numberToOrdinal(r)}`
  }
  return `${numberToWords(n)}th`
}
__name(numberToOrdinal, "numberToOrdinal")

function normalizeCurrency(text) {
  let result = text
  result = result.replace(/\$(\d{1,3}(,\d{3})*(\.\d{1,2})?)\b/g, (match, amount) => {
    const cleaned = amount.replace(/,/g, "")
    const num = parseFloat(cleaned)
    if (num === Math.floor(num)) return `${numberToWords(num)} dollars`
    const [whole, cents] = cleaned.split(".")
    return `${numberToWords(parseInt(whole))} dollars and ${cents} cents`
  })
  result = result.replace(/£(\d{1,3}(,\d{3})*(\.\d{1,2})?)\b/g, (match, amount) => {
    return `${numberToWords(Math.floor(parseFloat(amount.replace(/,/g, ""))))} pounds`
  })
  result = result.replace(/€(\d{1,3}(,\d{3})*(\.\d{1,2})?)\b/g, (match, amount) => {
    return `${numberToWords(Math.floor(parseFloat(amount.replace(/,/g, ""))))} euros`
  })
  return result
}
__name(normalizeCurrency, "normalizeCurrency")

function normalizeTime(text) {
  let result = text
  result = result.replace(/\b(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)\b/g, (match, hour, min, period) => {
    const h = parseInt(hour)
    const m = parseInt(min)
    const hourWord = numberToWords(h > 12 ? h - 12 : h)
    if (m === 0) return `${hourWord} ${period.toUpperCase()}`
    const minWord = m < 10 ? `oh ${numberToWords(m)}` : numberToWords(m)
    return `${hourWord} ${minWord} ${period.toUpperCase()}`
  })
  result = result.replace(/\b([01]?\d|2[0-3]):(\d{2})\b(?!\s*(?:am|pm|AM|PM))/g, (match, hour, min) => {
    const h = parseInt(hour)
    const m = parseInt(min)
    const isPM = h >= 12
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    const hourWord = numberToWords(hour12)
    if (m === 0) return `${hourWord} ${isPM ? "P M" : "A M"}`
    const minWord = m < 10 ? `oh ${numberToWords(m)}` : numberToWords(m)
    return `${hourWord} ${minWord} ${isPM ? "P M" : "A M"}`
  })
  return result
}
__name(normalizeTime, "normalizeTime")

function normalizePercentages(text) {
  return text.replace(/(\d+\.?\d*)\s*%/g, (match, num) => {
    const n = parseFloat(num)
    if (num.includes(".")) {
      const [whole, decimal] = num.split(".")
      return `${numberToWords(parseInt(whole))} point ${decimal.split("").map((d) => numberToWords(parseInt(d))).join(" ")} percent`
    }
    return `${numberToWords(n)} percent`
  })
}
__name(normalizePercentages, "normalizePercentages")

function normalizeMeasurements(text) {
  let r = text
  const sub = (pattern, unit) =>
    r.replace(pattern, (m, num) => `${numberToWords(parseFloat(num))} ${unit}`)
  r = sub(/\b(\d+\.?\d*)\s*(kg|kilogram|kilograms)\b/gi, "kilograms")
  r = sub(/\b(\d+\.?\d*)\s*(g|gram|grams)(?![a-z])/gi, "grams")
  r = sub(/\b(\d+\.?\d*)\s*(lb|lbs|pound|pounds)\b/gi, "pounds")
  r = sub(/\b(\d+\.?\d*)\s*(oz|ounce|ounces)\b/gi, "ounces")
  r = sub(/\b(\d+\.?\d*)\s*(km|kilometer|kilometers)\b/gi, "kilometers")
  r = sub(/\b(\d+\.?\d*)\s*(mi|mile|miles)\b/gi, "miles")
  r = r.replace(/\b(\d+\.?\d*)\s*(ft|foot|feet)\b/gi, (m, num) => {
    const n = parseFloat(num); return n === 1 ? "one foot" : `${numberToWords(n)} feet`
  })
  r = sub(/\b(\d+\.?\d*)\s*(m|meter|meters)(?![a-z])/gi, "meters")
  r = sub(/\b(\d+\.?\d*)\s*(cm|centimeter|centimeters)\b/gi, "centimeters")
  r = r.replace(/\b(\d+\.?\d*)\s*(in|inch|inches)\b/gi, (m, num) => {
    const n = parseFloat(num); return n === 1 ? "one inch" : `${numberToWords(n)} inches`
  })
  r = sub(/\b(\d+\.?\d*)\s*(L|liter|liters|litre|litres)\b/gi, "liters")
  r = sub(/\b(\d+\.?\d*)\s*(ml|milliliter|milliliters|millilitre|millilitres)\b/gi, "milliliters")
  r = sub(/\b(\d+\.?\d*)\s*(gal|gallon|gallons)\b/gi, "gallons")
  return r
}
__name(normalizeMeasurements, "normalizeMeasurements")

function normalizeAbbreviations(text) {
  let r = text
  r = r.replace(/\bDr\.\s+/g, "Doctor ")
  r = r.replace(/\bMr\.\s+/g, "Mister ")
  r = r.replace(/\bMrs\.\s+/g, "Missus ")
  r = r.replace(/\bMs\.\s+/g, "Mizz ")
  r = r.replace(/\bProf\.\s+/g, "Professor ")
  r = r.replace(/\bSt\.\s+([A-Z])/g, "Street $1")
  r = r.replace(/\bAve\.\s+/g, "Avenue ")
  r = r.replace(/\bBlvd\.\s+/g, "Boulevard ")
  r = r.replace(/\bRd\.\s+/g, "Road ")
  r = r.replace(/\bLn\.\s+/g, "Lane ")
  r = r.replace(/\bPl\.\s+/g, "Place ")
  r = r.replace(/\betc\./gi, "et cetera")
  r = r.replace(/\be\.g\./gi, "for example")
  r = r.replace(/\bi\.e\./gi, "that is")
  r = r.replace(/\bvs\./gi, "versus")
  return r
}
__name(normalizeAbbreviations, "normalizeAbbreviations")

function normalizeFractions(text) {
  const map = {
    "1/2": "one half", "1/3": "one third", "2/3": "two thirds",
    "1/4": "one quarter", "3/4": "three quarters", "1/5": "one fifth",
    "2/5": "two fifths", "3/5": "three fifths", "4/5": "four fifths",
    "1/8": "one eighth", "3/8": "three eighths", "5/8": "five eighths", "7/8": "seven eighths",
  }
  let r = text
  for (const [frac, word] of Object.entries(map)) {
    r = r.replace(new RegExp(`\\b${frac.replace("/", "\\/")}\\b`, "g"), word)
  }
  r = r.replace(/\b(\d+)\/(\d+)\b/g, (match, num, denom) => {
    const plural = parseInt(num) > 1 ? "s" : ""
    return `${numberToWords(parseInt(num))} ${numberToOrdinal(parseInt(denom))}${plural}`
  })
  return r
}
__name(normalizeFractions, "normalizeFractions")

function normalizeDates(text) {
  const months = {
    "1": "January", "01": "January", "2": "February", "02": "February",
    "3": "March", "03": "March", "4": "April", "04": "April",
    "5": "May", "05": "May", "6": "June", "06": "June",
    "7": "July", "07": "July", "8": "August", "08": "August",
    "9": "September", "09": "September", "10": "October",
    "11": "November", "12": "December",
  }
  const monthsShort = {
    Jan: "January", Feb: "February", Mar: "March", Apr: "April",
    May: "May", Jun: "June", Jul: "July", Aug: "August",
    Sep: "September", Sept: "September", Oct: "October", Nov: "November", Dec: "December",
  }
  let r = text
  r = r.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g, (match, month, day, year) => {
    const yearNum = parseInt(year)
    return `${months[month] || month} ${numberToOrdinal(parseInt(day))}, ${numberToWords(yearNum < 100 ? 2000 + yearNum : yearNum)}`
  })
  r = r.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(st|nd|rd|th)?/gi, (match, mon, day) => {
    const key = mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()
    return `${monthsShort[key] || mon} ${numberToOrdinal(parseInt(day))}`
  })
  return r
}
__name(normalizeDates, "normalizeDates")

function normalizePhoneNumbers(text) {
  let r = text
  r = r.replace(/\b(\d{3})-(\d{4})\b/g, (match, area, num) => {
    const a = area.split("").map((d) => numberToWords(parseInt(d))).join(" ")
    const n = num.split("").map((d) => numberToWords(parseInt(d))).join(" ")
    return `${a}, ${n}`
  })
  r = r.replace(/\((\d{3})\)\s*(\d{3})-(\d{4})/g, (match, area, prefix, num) => {
    const a = area.split("").map((d) => numberToWords(parseInt(d))).join(" ")
    const p = prefix.split("").map((d) => numberToWords(parseInt(d))).join(" ")
    const n = num.split("").map((d) => numberToWords(parseInt(d))).join(" ")
    return `${a}, ${p}, ${n}`
  })
  return r
}
__name(normalizePhoneNumbers, "normalizePhoneNumbers")

function normalizeEmailsAndUrls(text) {
  let r = text
  r = r.replace(/\b([a-z0-9._-]+)@([a-z0-9.-]+\.[a-z]{2,})\b/gi, (match, user, domain) => {
    return `${user} at ${domain.split(".").join(" dot ")}`
  })
  r = r.replace(/https?:\/\/(www\.)?([a-z0-9.-]+\.[a-z]{2,})(\/[^\s]*)?/gi, (match, www, domain) => {
    return domain.split(".").join(" dot ")
  })
  return r
}
__name(normalizeEmailsAndUrls, "normalizeEmailsAndUrls")

function normalizeRomanNumerals(text) {
  const romanMap = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
    XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18,
    XIX: 19, XX: 20, XXI: 21, XXV: 25, XXX: 30, XL: 40, L: 50,
    LX: 60, LXX: 70, LXXX: 80, XC: 90, C: 100,
  }
  let r = text
  r = r.replace(/\b([A-Z][a-z]+)\s+(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\b/g, (match, name, roman) => {
    const num = romanMap[roman]
    return num ? `${name} the ${numberToOrdinal(num)}` : match
  })
  r = r.replace(/\b(Super Bowl|Chapter|Volume|Part|Book|Act|Scene)\s+([IVX]+)\b/gi, (match, prefix, roman) => {
    const num = romanMap[roman] || parseRomanNumeral(roman)
    return num ? `${prefix} ${numberToWords(num)}` : match
  })
  return r
}
__name(normalizeRomanNumerals, "normalizeRomanNumerals")

function parseRomanNumeral(s) {
  const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let total = 0, prev = 0
  for (let i = s.length - 1; i >= 0; i--) {
    const cur = v[s[i]]
    if (!cur) return null
    total += cur < prev ? -cur : cur
    prev = cur
  }
  return total
}
__name(parseRomanNumeral, "parseRomanNumeral")

function normalizeSlashes(text) {
  let r = text
  const compounds = [
    /\b(autumn|fall|spring|summer|winter)\s*\/\s*(autumn|fall|spring|summer|winter)\b/gi,
    /\b(and|or)\s*\/\s*(or|and)\b/gi,
    /\b(yes|no)\s*\/\s*(no|yes)\b/gi,
    /\b(on|off)\s*\/\s*(off|on)\b/gi,
  ]
  compounds.forEach((p) => {
    r = r.replace(p, (match, a, b) => `${a} ${b}`)
  })
  r = r.replace(/\b([a-zA-Z]+)\s*\/\s*([a-zA-Z]+)\b/g, (match, a, b) => {
    if (a.length === 1 && b.length === 1) return `${a} slash ${b}`
    return `${a} ${b}`
  })
  return r
}
__name(normalizeSlashes, "normalizeSlashes")

function optimizeListPauses(text) {
  let r = text
  r = r.replace(/,\s+([\w\s]+)\s+(and|or)\s+/gi, " $1 $2 ")
  r = r.replace(/,\s+(and|or)\s+/gi, " $1 ")
  return r
}
__name(optimizeListPauses, "optimizeListPauses")

function normalizeProblematicWords(text) {
  const replacements = {
    API: "A P I", URL: "U R L", CEO: "C E O", CFO: "C F O",
    CTO: "C T O", COO: "C O O", AI: "A I", UI: "U I", UX: "U X",
    FAQ: "F A Q", PDF: "P D F", CTA: "C T A", ROI: "R O I",
    KPI: "K P I", SEO: "S E O", SaaS: "S a a S", B2B: "B to B", B2C: "B to C",
    iOS: "I O S", macOS: "mac O S", GitHub: "Git Hub", LinkedIn: "Linked In",
    YouTube: "You Tube", iPhone: "I Phone", iPad: "I Pad",
  }
  let r = text
  for (const [word, pronunciation] of Object.entries(replacements)) {
    r = r.replace(new RegExp(`\\b${word}\\b`, "gi"), pronunciation)
  }
  r = normalizeAddressNumbers(r)
  return r
}
__name(normalizeProblematicWords, "normalizeProblematicWords")

function normalizeAddressNumbers(text) {
  let r = text
  r = r.replace(
    /\b(\d{1,5})([A-Z])?\s+(The\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
    (match, num, letter, thePrefix, street) => {
      const n = parseInt(num)
      if (n >= 1900 && n <= 2099) return match
      const numWord = numberToAddressForm(n)
      const letterPart = letter ? ` ${letter}` : ""
      return `${numWord}${letterPart} ${thePrefix || ""}${street}`
    }
  )
  r = r.replace(
    /\b(at|building|suite|floor|room|office|unit)\s+(\d{1,4})\b/gi,
    (match, prefix, num) => `${prefix} ${numberToAddressForm(parseInt(num))}`
  )
  return r
}
__name(normalizeAddressNumbers, "normalizeAddressNumbers")

function numberToAddressForm(num) {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
  const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
  if (num === 0) return "zero"
  if (num < 10) return ones[num]
  if (num < 20) return teens[num - 10]
  if (num < 100) {
    const t = tens[Math.floor(num / 10)]; const o = ones[num % 10]
    return o ? `${t}-${o}` : t
  }
  if (num < 1000) {
    const h = Math.floor(num / 100), r = num % 100
    if (r === 0) return `${ones[h]} hundred`
    if (r < 10) return `${ones[h]}-oh-${ones[r]}`
    if (r < 20) return `${ones[h]}-${teens[r - 10]}`
    const td = Math.floor(r / 10), od = r % 10
    return od === 0 ? `${ones[h]}-${tens[td]}` : `${ones[h]}-${tens[td]}-${ones[od]}`
  }
  if (num < 10000) {
    const r = num % 1000
    if (r % 100 === 0 && r < 1000) return `${numberToAddressForm(Math.floor(num / 100))} hundred`
    return `${ones[Math.floor(num / 1000)]} thousand ${numberToAddressForm(r)}`
  }
  return numberToWords(num)
}
__name(numberToAddressForm, "numberToAddressForm")

function numberToWords(num) {
  if (num === 0) return "zero"
  if (num < 0) return "negative " + numberToWords(-num)
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
  const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
  if (num < 10) return ones[num]
  if (num < 20) return teens[num - 10]
  if (num < 100) {
    const t = tens[Math.floor(num / 10)]; const o = ones[num % 10]
    return o ? `${t}-${o}` : t
  }
  if (num < 1000) {
    const h = Math.floor(num / 100), r = num % 100
    const hp = `${ones[h]} hundred`
    return r === 0 ? hp : `${hp} ${numberToWords(r)}`
  }
  if (num < 10000) {
    const th = Math.floor(num / 1000), r = num % 1000
    const tp = `${ones[th]} thousand`
    if (r === 0) return tp
    if (r % 100 === 0 && r < 1000) return `${numberToWords(Math.floor(num / 100))} hundred`
    return `${tp} ${numberToWords(r)}`
  }
  return num.toString().split("").map((d) => ones[parseInt(d)]).join(" ")
}
__name(numberToWords, "numberToWords")

// ---------------------------
// Text cadence shaping (global mode)
// ---------------------------
function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}
__name(splitSentences, "splitSentences")

function addBreathingRoom(text) {
  return splitSentences(text).join("\n\n")
}
__name(addBreathingRoom, "addBreathingRoom")

function addGentleCadence(text) {
  return splitSentences(text)
    .map((s) => {
      if (s.length > 90 && !s.includes(",")) {
        const idx = findSafeCommaInsertIndex(s)
        if (idx > 0) return s.slice(0, idx) + ", " + s.slice(idx)
      }
      return s
    })
    .join(" ")
}
__name(addGentleCadence, "addGentleCadence")

function tightenCadence(text) {
  return String(text).replace(/\.\.\.+/g, ".").replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim()
}
__name(tightenCadence, "tightenCadence")

function emphasizeQuestions(text) {
  return String(text).replace(/\?(\s+)(?=\S)/g, "?\n")
}
__name(emphasizeQuestions, "emphasizeQuestions")

function addMicroPausesForClarity(text) {
  let out = String(text).replace(/:\s*/g, ": \n")
  out = out.replace(/\b(and|but|so)\b/gi, (m) => `, ${m}`)
  out = out.replace(/,\s*,/g, ", ")
  return out
}
__name(addMicroPausesForClarity, "addMicroPausesForClarity")

function flattenExclamation(text) {
  return String(text).replace(/!{2,}/g, "!")
}
__name(flattenExclamation, "flattenExclamation")

function addUrgency(text) {
  return String(text).replace(/\n{2,}/g, "\n")
}
__name(addUrgency, "addUrgency")

function softenEdges(text) {
  return String(text).replace(/--+/g, ",").replace(/\.{2,}/g, ".")
}
__name(softenEdges, "softenEdges")

function findSafeCommaInsertIndex(sentence) {
  const mid = Math.floor(sentence.length / 2)
  let left = sentence.lastIndexOf(" ", mid)
  if (left < 20) left = sentence.indexOf(" ", mid)
  return left > 0 ? left : -1
}
__name(findSafeCommaInsertIndex, "findSafeCommaInsertIndex")

// ---------------------------
// Hume TTS — global mode
// ---------------------------
async function generateHume(modelId, script, apiKey, preset = null, format = "mp3") {
  if (!apiKey) throw new Error("Missing HUME_API_KEY in environment variables")
  const payload = {
    utterances: [
      {
        text: script,
        voice: { id: modelId, provider: "CUSTOM_VOICE" },
      },
    ],
    format: { type: format },
    version: "2",
  }
  const response = await fetch("https://api.hume.ai/v0/tts", {
    method: "POST",
    headers: {
      "X-Hume-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Hume API error (${response.status}): ${errorText}`)
  }
  const data = await response.json()
  if (!data.generations || data.generations.length === 0) {
    throw new Error("Hume API returned no generations")
  }
  const audioBase64 = data.generations[0].audio
  if (!audioBase64) throw new Error("Hume API returned empty audio")
  const binaryString = atob(audioBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}
__name(generateHume, "generateHume")

// ---------------------------
// Hume TTS — inline segments mode
// ---------------------------
async function generateHumeMulti(utterances, apiKey, format = "mp3") {
  if (!apiKey) throw new Error("Missing HUME_API_KEY in environment variables")
  const payload = {
    utterances,
    format: { type: format },
    version: "1",
  }
  const response = await fetch("https://api.hume.ai/v0/tts", {
    method: "POST",
    headers: {
      "X-Hume-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Hume API error (${response.status}): ${errorText}`)
  }
  const data = await response.json()
  if (!data.generations || data.generations.length === 0) {
    throw new Error("Hume API returned no generations")
  }
  if (data.generations.length === 1) {
    const audioBase64 = data.generations[0].audio
    if (!audioBase64) throw new Error("Hume API returned empty audio")
    const binaryString = atob(audioBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }
  const buffers = data.generations.map((gen) => {
    if (!gen.audio) throw new Error("Hume API returned a generation with empty audio")
    const binaryString = atob(gen.audio)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  })
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0)
  const combined = new Uint8Array(totalLength)
  let offset = 0
  for (const buf of buffers) {
    combined.set(buf, offset)
    offset += buf.length
  }
  return combined.buffer
}
__name(generateHumeMulti, "generateHumeMulti")

// ---------------------------
// CORS + JSON responses
// ---------------------------
function handleCORS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  })
}
__name(handleCORS, "handleCORS")

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
__name(jsonResponse, "jsonResponse")

export { index_default as default }
