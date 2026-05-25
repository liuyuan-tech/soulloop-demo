import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getReadingMode,
  normalizeReadingMode,
  READING_MODES,
  type ReadingModeId,
} from "@/lib/readings/options";

type EntitlementRow = {
  mode: string;
};

type UnlockReadingModeResult = {
  alreadyOwned?: boolean;
  entitlementId?: string;
  mode?: string;
  creditsBalance?: number | null;
};

function getRpcResultValue(data: unknown): UnlockReadingModeResult {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    return {};
  }

  return value as UnlockReadingModeResult;
}

async function getUserFromRequest(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace("Bearer ", "").trim();

  if (!token) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Authentication required. Please log in." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Invalid or expired session. Please log in again." },
        { status: 401 }
      ),
    };
  }

  return { user, error: null };
}

function modeList(ownedModes: ReadingModeId[]) {
  const owned = new Set<ReadingModeId>(["eastern_wisdom", ...ownedModes]);

  return READING_MODES.map((mode) => ({
    ...mode,
    owned: owned.has(mode.id),
  }));
}

export async function GET(request: Request) {
  const { user, error } = await getUserFromRequest(request);

  if (error || !user) {
    return error;
  }

  const { data, error: entitlementError } = await supabaseAdmin
    .from("reading_mode_entitlements")
    .select("mode")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (entitlementError) {
    return NextResponse.json(
      {
        error: entitlementError.message,
        code: "READING_MODE_ENTITLEMENTS_UNAVAILABLE",
        ownedModes: ["eastern_wisdom"],
        modes: modeList(["eastern_wisdom"]),
      },
      { status: 200 }
    );
  }

  const paidModes = ((data || []) as EntitlementRow[])
    .map((item) => normalizeReadingMode(item.mode))
    .filter((mode) => mode !== "eastern_wisdom");

  const ownedModes = Array.from(
    new Set<ReadingModeId>(["eastern_wisdom", ...paidModes])
  );

  return NextResponse.json({
    ownedModes,
    modes: modeList(ownedModes),
  });
}

export async function POST(request: Request) {
  const { user, error } = await getUserFromRequest(request);

  if (error || !user) {
    return error;
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: string;
  };

  const mode = normalizeReadingMode(body.mode);
  const modeConfig = getReadingMode(mode);

  if (mode === "eastern_wisdom") {
    return NextResponse.json({
      alreadyOwned: true,
      mode,
      ownedModes: ["eastern_wisdom"],
      modes: modeList(["eastern_wisdom"]),
    });
  }

  if (!modeConfig.unlockCost || modeConfig.unlockCost <= 0) {
    return NextResponse.json(
      { error: "This reading mode cannot be unlocked." },
      { status: 400 }
    );
  }

  const { data, error: unlockError } = await supabaseAdmin.rpc(
    "unlock_reading_mode",
    {
      p_user_id: user.id,
      p_mode: mode,
      p_credits_cost: modeConfig.unlockCost,
    }
  );

  if (unlockError) {
    const insufficient = unlockError.message
      .toLowerCase()
      .includes("insufficient credits");

    return NextResponse.json(
      {
        error: unlockError.message,
        code: insufficient
          ? "INSUFFICIENT_CREDITS"
          : "READING_MODE_UNLOCK_FAILED",
      },
      { status: insufficient ? 402 : 500 }
    );
  }

  const result = getRpcResultValue(data);

  const { data: entitlements } = await supabaseAdmin
    .from("reading_mode_entitlements")
    .select("mode")
    .eq("user_id", user.id)
    .eq("status", "active");

  const paidModes = ((entitlements || []) as EntitlementRow[])
    .map((item) => normalizeReadingMode(item.mode))
    .filter((item) => item !== "eastern_wisdom");

  const ownedModes = Array.from(
    new Set<ReadingModeId>(["eastern_wisdom", ...paidModes])
  );

  return NextResponse.json({
    ...result,
    mode,
    ownedModes,
    modes: modeList(ownedModes),
  });
}
