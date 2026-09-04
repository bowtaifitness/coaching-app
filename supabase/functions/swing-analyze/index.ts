import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Landmark { x: number; y: number; visibility: number }
interface FrameLandmarks {
  frame: number;
  timestamp: number;
  leftWrist: Landmark;
  rightWrist: Landmark;
  leftShoulder: Landmark;
  rightShoulder: Landmark;
  leftHip: Landmark;
  rightHip: Landmark;
  leftEar?: Landmark;
  rightEar?: Landmark;
  leftKnee?: Landmark;
  rightKnee?: Landmark;
  leftHeel?: Landmark;
  rightHeel?: Landmark;
}

interface PhaseResult { frame: number; timestamp: number; confidence: 'high' | 'medium' | 'low' }
interface SwingPhases {
  setup: PhaseResult; takeaway: PhaseResult; topOfSwing: PhaseResult;
  downswing: PhaseResult; impact: PhaseResult; finish: PhaseResult;
}
type FaultSeverity = 'none' | 'mild' | 'moderate' | 'severe';
interface SwingFault {
  id: string; label: string; detected: boolean; severity: FaultSeverity;
  description: string; detail: string; relevantPhases: (keyof SwingPhases)[];
  measurements: Record<string, number>;
}

const SETUP_WINDOW = 15;
const TAKEAWAY_X_THRESHOLD = 0.07;
const TAKEAWAY_CONSECUTIVE_FRAMES = 3;
const IMPACT_Y_TOLERANCE = 0.06;
const SMOOTHING_WINDOW = 3;

const EARLY_EXTENSION_MILD = 0.03;
const EARLY_EXTENSION_MODERATE = 0.05;
const EARLY_EXTENSION_SEVERE = 0.08;
const POSTURE_ANGLE_MILD = 5;
const POSTURE_ANGLE_MODERATE = 10;
const POSTURE_ANGLE_SEVERE = 15;

function avgWrists(f: FrameLandmarks) {
  return { x: (f.leftWrist.x + f.rightWrist.x) / 2, y: (f.leftWrist.y + f.rightWrist.y) / 2 };
}
function smooth(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      sum += values[j]; count++;
    }
    return sum / count;
  });
}
function fallback(frames: FrameLandmarks[], fraction: number): PhaseResult {
  const idx = Math.min(Math.floor(frames.length * fraction), frames.length - 1);
  return { frame: frames[idx].frame, timestamp: frames[idx].timestamp, confidence: 'low' };
}

function detectSetup(frames: FrameLandmarks[], wristPositions: { x: number; y: number }[]): PhaseResult {
  const window = Math.min(SETUP_WINDOW, Math.floor(frames.length * 0.15));
  let bestStart = 0, bestVariance = Infinity;
  for (let start = 0; start <= Math.min(frames.length - window, Math.floor(frames.length * 0.3)); start++) {
    const slice = wristPositions.slice(start, start + window);
    const meanX = slice.reduce((s, p) => s + p.x, 0) / slice.length;
    const meanY = slice.reduce((s, p) => s + p.y, 0) / slice.length;
    const variance = slice.reduce((s, p) => s + (p.x - meanX) ** 2 + (p.y - meanY) ** 2, 0) / slice.length;
    if (variance < bestVariance) { bestVariance = variance; bestStart = start; }
  }
  const midFrame = bestStart + Math.floor(window / 2);
  return {
    frame: frames[midFrame].frame, timestamp: frames[midFrame].timestamp,
    confidence: bestVariance < 0.0005 ? 'high' : bestVariance < 0.002 ? 'medium' : 'low',
  };
}
function detectTakeaway(frames: FrameLandmarks[], wristPositions: { x: number; y: number }[], setupFrame: number): PhaseResult {
  const setupIdx = frames.findIndex((f) => f.frame === setupFrame);
  if (setupIdx < 0) return fallback(frames, 0.15);
  const setupX = wristPositions[setupIdx].x;
  const shoulderMidX = (frames[setupIdx].leftShoulder.x + frames[setupIdx].rightShoulder.x) / 2;
  const movingRight = setupX < shoulderMidX;
  let consecutive = 0;
  for (let i = setupIdx + 1; i < frames.length; i++) {
    const dx = movingRight ? wristPositions[i].x - setupX : setupX - wristPositions[i].x;
    if (dx > TAKEAWAY_X_THRESHOLD) {
      consecutive++;
      if (consecutive >= TAKEAWAY_CONSECUTIVE_FRAMES) {
        const hitIdx = i - TAKEAWAY_CONSECUTIVE_FRAMES + 1;
        return {
          frame: frames[hitIdx].frame, timestamp: frames[hitIdx].timestamp,
          confidence: dx > TAKEAWAY_X_THRESHOLD * 1.5 ? 'high' : 'medium',
        };
      }
    } else { consecutive = 0; }
  }
  return fallback(frames, 0.2);
}
function detectTopOfSwing(frames: FrameLandmarks[], smoothedY: number[], takeawayFrame: number): PhaseResult {
  const takeawayIdx = frames.findIndex((f) => f.frame === takeawayFrame);
  const searchStart = Math.max(takeawayIdx, 0);
  const searchEnd = Math.min(frames.length - 1, Math.floor(frames.length * 0.7));
  let minY = Infinity, minIdx = searchStart;
  for (let i = searchStart; i <= searchEnd; i++) {
    if (smoothedY[i] < minY) { minY = smoothedY[i]; minIdx = i; }
  }
  const neighborRange = 5;
  const localMin = Math.min(...smoothedY.slice(Math.max(0, minIdx - neighborRange), minIdx));
  const localMax = Math.max(...smoothedY.slice(Math.max(0, minIdx - neighborRange), minIdx));
  const isCleanPeak = localMax - localMin < 0.05;
  return {
    frame: frames[minIdx].frame, timestamp: frames[minIdx].timestamp,
    confidence: isCleanPeak ? 'high' : 'medium',
  };
}
function detectImpact(frames: FrameLandmarks[], smoothedY: number[], setupY: number, topFrame: number): PhaseResult {
  const topIdx = frames.findIndex((f) => f.frame === topFrame);
  const searchStart = Math.max(topIdx + 1, 0);
  let bestIdx = searchStart, bestDiff = Infinity;
  for (let i = searchStart; i < frames.length; i++) {
    const diff = Math.abs(smoothedY[i] - setupY);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    if (smoothedY[i] > setupY + 0.05 && i > bestIdx + 3) break;
  }
  return {
    frame: frames[bestIdx].frame, timestamp: frames[bestIdx].timestamp,
    confidence: bestDiff < IMPACT_Y_TOLERANCE ? 'high' : bestDiff < IMPACT_Y_TOLERANCE * 2 ? 'medium' : 'low',
  };
}
function detectDownswing(frames: FrameLandmarks[], topFrame: number, impactFrame: number): PhaseResult {
  const topIdx = frames.findIndex((f) => f.frame === topFrame);
  const impactIdx = frames.findIndex((f) => f.frame === impactFrame);
  if (topIdx < 0 || impactIdx < 0 || topIdx >= impactIdx) return fallback(frames, 0.55);
  const midIdx = Math.round((topIdx + impactIdx) / 2);
  return { frame: frames[midIdx].frame, timestamp: frames[midIdx].timestamp, confidence: 'high' };
}
function detectFinish(frames: FrameLandmarks[], smoothedY: number[], impactFrame: number): PhaseResult {
  const impactIdx = frames.findIndex((f) => f.frame === impactFrame);
  const searchStart = Math.max(impactIdx + 1, 0);
  let minY = Infinity, minIdx = searchStart;
  for (let i = searchStart; i < frames.length; i++) {
    if (smoothedY[i] < minY) { minY = smoothedY[i]; minIdx = i; }
  }
  const impactY = smoothedY[impactIdx] ?? 0.5;
  const rise = impactY - minY;
  return {
    frame: frames[minIdx].frame, timestamp: frames[minIdx].timestamp,
    confidence: rise > 0.08 ? 'high' : rise > 0.04 ? 'medium' : 'low',
  };
}

function detectSwingPhases(frames: FrameLandmarks[]): SwingPhases | null {
  if (frames.length < 20) return null;
  const wristPositions = frames.map(avgWrists);
  const rawY = wristPositions.map((p) => p.y);
  const smoothedY = smooth(rawY, SMOOTHING_WINDOW);
  const setup = detectSetup(frames, wristPositions);
  const setupIdx = frames.findIndex((f) => f.frame === setup.frame);
  const setupY = setupIdx >= 0 ? smoothedY[setupIdx] : wristPositions[0].y;
  const takeaway = detectTakeaway(frames, wristPositions, setup.frame);
  const topOfSwing = detectTopOfSwing(frames, smoothedY, takeaway.frame);
  const impact = detectImpact(frames, smoothedY, setupY, topOfSwing.frame);
  const downswing = detectDownswing(frames, topOfSwing.frame, impact.frame);
  const finish = detectFinish(frames, smoothedY, impact.frame);
  return { setup, takeaway, topOfSwing, downswing, impact, finish };
}

function findFrameAtPhase(frames: FrameLandmarks[], phases: SwingPhases, key: keyof SwingPhases) {
  const target = phases[key].frame;
  return frames.find((f) => f.frame === target) ?? null;
}
function pickVisibleHip(f: FrameLandmarks) {
  return f.leftHip.visibility >= f.rightHip.visibility ? f.leftHip : f.rightHip;
}
function pickVisibleShoulder(f: FrameLandmarks) {
  return f.leftShoulder.visibility >= f.rightShoulder.visibility ? f.leftShoulder : f.rightShoulder;
}
function spineAngleDeg(s: { x: number; y: number }, h: { x: number; y: number }) {
  return Math.atan2(s.x - h.x, h.y - s.y) * (180 / Math.PI);
}
function classifySeverity(value: number, mild: number, moderate: number, severe: number): FaultSeverity {
  if (value >= severe) return 'severe';
  if (value >= moderate) return 'moderate';
  if (value >= mild) return 'mild';
  return 'none';
}

function detectEarlyExtension(frames: FrameLandmarks[], phases: SwingPhases): SwingFault {
  const setupFrame = findFrameAtPhase(frames, phases, 'setup');
  const impactFrame = findFrameAtPhase(frames, phases, 'impact');
  const base = {
    id: 'early-extension', label: 'Early Extension',
    description: 'The hips move toward the ball during the downswing, breaking the tush line established at setup. This reduces swing consistency and power transfer.',
    relevantPhases: ['setup', 'downswing', 'impact'] as (keyof SwingPhases)[],
  };
  if (!setupFrame || !impactFrame) {
    return { ...base, detected: false, severity: 'none', detail: 'Could not locate setup or impact frame landmarks.', measurements: {} };
  }
  const setupHip = pickVisibleHip(setupFrame);
  const impactHip = pickVisibleHip(impactFrame);
  const hipShiftX = impactHip.x - setupHip.x;
  const severity = classifySeverity(hipShiftX, EARLY_EXTENSION_MILD, EARLY_EXTENSION_MODERATE, EARLY_EXTENSION_SEVERE);
  const detected = severity !== 'none';
  const detail = !detected
    ? `Hip stayed on the tush line (shifted ${(hipShiftX * 100).toFixed(1)}% toward ball). No early extension detected.`
    : `Hip moved ${(hipShiftX * 100).toFixed(1)}% of frame width toward the ball between setup and impact, breaking the tush line.`;
  return {
    ...base, detected, severity, detail,
    measurements: { setupHipX: setupHip.x, impactHipX: impactHip.x, hipShiftPercent: hipShiftX * 100 },
  };
}

function detectLossOfPosture(frames: FrameLandmarks[], phases: SwingPhases): SwingFault {
  const setupFrame = findFrameAtPhase(frames, phases, 'setup');
  const topFrame = findFrameAtPhase(frames, phases, 'topOfSwing');
  const impactFrame = findFrameAtPhase(frames, phases, 'impact');
  const base = {
    id: 'loss-of-posture', label: 'Loss of Posture',
    description: 'The spine angle changes significantly during the swing -- the golfer stands up out of their address posture. This alters the swing plane and contact consistency.',
    relevantPhases: ['setup', 'topOfSwing', 'impact'] as (keyof SwingPhases)[],
  };
  if (!setupFrame || !topFrame || !impactFrame) {
    return { ...base, detected: false, severity: 'none', detail: 'Could not locate required phase frame landmarks.', measurements: {} };
  }
  const setupAngle = spineAngleDeg(pickVisibleShoulder(setupFrame), pickVisibleHip(setupFrame));
  const topAngle = spineAngleDeg(pickVisibleShoulder(topFrame), pickVisibleHip(topFrame));
  const impactAngle = spineAngleDeg(pickVisibleShoulder(impactFrame), pickVisibleHip(impactFrame));
  const topDelta = Math.abs(topAngle - setupAngle);
  const impactDelta = Math.abs(impactAngle - setupAngle);
  const maxDelta = Math.max(topDelta, impactDelta);
  const severity = classifySeverity(maxDelta, POSTURE_ANGLE_MILD, POSTURE_ANGLE_MODERATE, POSTURE_ANGLE_SEVERE);
  const detected = severity !== 'none';
  const detail = !detected
    ? `Spine angle maintained well throughout the swing. Setup: ${setupAngle.toFixed(1)}, Top: ${topAngle.toFixed(1)}, Impact: ${impactAngle.toFixed(1)}.`
    : `Spine angle deviated ${maxDelta.toFixed(1)} from setup (${setupAngle.toFixed(1)}) at ${topDelta >= impactDelta ? 'top of swing' : 'impact'}. Top: ${topAngle.toFixed(1)}, Impact: ${impactAngle.toFixed(1)}.`;
  return {
    ...base, detected, severity, detail,
    measurements: { setupAngle, topAngle, impactAngle, topDelta, impactDelta },
  };
}

function detectSwingFaults(frames: FrameLandmarks[], phases: SwingPhases) {
  if (frames.length < 20) {
    return { faults: [] as SwingFault[], analysisValid: false, invalidReason: 'Not enough frames for fault analysis.' };
  }
  return {
    faults: [detectEarlyExtension(frames, phases), detectLossOfPosture(frames, phases)],
    analysisValid: true, invalidReason: null as string | null,
  };
}

function isValidFrame(f: unknown): f is FrameLandmarks {
  if (!f || typeof f !== 'object') return false;
  const o = f as Record<string, unknown>;
  if (typeof o.frame !== 'number' || typeof o.timestamp !== 'number') return false;
  for (const k of ['leftWrist','rightWrist','leftShoulder','rightShoulder','leftHip','rightHip']) {
    const lm = o[k] as Record<string, unknown> | undefined;
    if (!lm || typeof lm.x !== 'number' || typeof lm.y !== 'number' || typeof lm.visibility !== 'number') return false;
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const frames = body?.frames;

    if (!Array.isArray(frames)) {
      return new Response(JSON.stringify({ error: "frames must be an array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (frames.length > 2000) {
      return new Response(JSON.stringify({ error: "frame count exceeds limit" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (frames.length > 0 && !frames.every(isValidFrame)) {
      return new Response(JSON.stringify({ error: "invalid frame schema" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phases = detectSwingPhases(frames as FrameLandmarks[]);
    if (!phases) {
      return new Response(
        JSON.stringify({ phases: null, faults: [], analysisValid: false, invalidReason: 'Not enough frames to detect phases.' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const faultResult = detectSwingFaults(frames as FrameLandmarks[], phases);

    return new Response(JSON.stringify({
      phases,
      faults: faultResult.faults,
      analysisValid: faultResult.analysisValid,
      invalidReason: faultResult.invalidReason,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
