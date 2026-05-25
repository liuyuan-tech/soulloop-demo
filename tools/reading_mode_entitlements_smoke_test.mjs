#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const siblingWorkspacePath = path.join(path.dirname(rootDir), "soulloop");
const displayRootDir =
  fs.existsSync(siblingWorkspacePath) &&
  fs.realpathSync(siblingWorkspacePath) === rootDir
    ? siblingWorkspacePath
    : rootDir;
const envPath = path.join(rootDir, ".env.local");
const migrationPath = path.join(
  displayRootDir,
  "supabase/migrations/20260524000000_reading_mode_entitlements.sql"
);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing env file: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");

    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value.replace(/\\n/g, "\n");
  }
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

function logStep(message) {
  console.log(`\n== ${message} ==`);
}

function assertOk(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function migrationHint() {
  return [
    "",
    "Apply the Supabase reading-mode entitlement migration before rerunning:",
    migrationPath,
    "",
    "Supabase Dashboard path:",
    "Project > SQL Editor > New query > paste the migration SQL > Run",
    "",
    "Expected objects:",
    "- public.reading_mode_entitlements",
    "- public.unlock_reading_mode(uuid, text, integer)",
  ].join("\n");
}

function createAuthedClient(url, anonKey, accessToken) {
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function createSmokeUser(admin, publicClient, label) {
  const stamp = `${Date.now()}-${label}`;
  const email = `soulloop-entitlements+${stamp}@example.com`;
  const password = `Smoke-${stamp}-Test`;

  const { data: createData, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        source: "soulloop_reading_mode_entitlements_smoke_test",
      },
    });

  if (createError || !createData.user) {
    throw new Error(
      `Could not create smoke user ${label}: ${createError?.message || "unknown error"}`
    );
  }

  const { data: signInData, error: signInError } =
    await publicClient.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError || !signInData.session?.access_token) {
    throw new Error(
      `Could not sign in smoke user ${label}: ${signInError?.message || "unknown error"}`
    );
  }

  return {
    email,
    password,
    userId: createData.user.id,
    accessToken: signInData.session.access_token,
  };
}

async function ensureProfile(admin, userId, email, creditsBalance) {
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      credits_balance: creditsBalance,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "id",
    }
  );

  if (error) {
    throw new Error(`Could not upsert profile for ${userId}: ${error.message}`);
  }
}

async function getProfile(admin, userId) {
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,credits_balance")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error(
      `Could not load profile for ${userId}: ${error?.message || "not found"}`
    );
  }

  return data;
}

async function checkSchema(admin) {
  const schemaErrors = [];

  const entitlementCheck = await admin
    .from("reading_mode_entitlements")
    .select("id,user_id,mode,status,source,credits_spent,created_at,updated_at")
    .limit(1);

  if (entitlementCheck.error) {
    schemaErrors.push(
      `reading_mode_entitlements schema check failed: ${entitlementCheck.error.message}`
    );
  }

  const rpcCheck = await admin.rpc("unlock_reading_mode", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_mode: "tarot",
    p_credits_cost: 80,
  });

  if (
    !rpcCheck.error ||
    !String(rpcCheck.error.message || "")
      .toLowerCase()
      .includes("profile not found")
  ) {
    schemaErrors.push(
      `unlock_reading_mode RPC check failed unexpectedly: ${
        rpcCheck.error?.message || "RPC did not reject dummy user"
      }`
    );
  }

  if (schemaErrors.length > 0) {
    throw new Error(
      `Database readiness failed:\n- ${schemaErrors.join("\n- ")}${migrationHint()}`
    );
  }
}

async function cleanupUserData(admin, userId) {
  const transactionDelete = await admin
    .from("credit_transactions")
    .delete()
    .eq("user_id", userId);

  if (transactionDelete.error) {
    console.warn(
      `cleanup warning: could not delete credit transactions for ${userId}: ${transactionDelete.error.message}`
    );
  }

  const entitlementDelete = await admin
    .from("reading_mode_entitlements")
    .delete()
    .eq("user_id", userId);

  if (entitlementDelete.error) {
    console.warn(
      `cleanup warning: could not delete entitlements for ${userId}: ${entitlementDelete.error.message}`
    );
  }

  const profileDelete = await admin.from("profiles").delete().eq("id", userId);

  if (profileDelete.error) {
    console.warn(
      `cleanup warning: could not delete profile for ${userId}: ${profileDelete.error.message}`
    );
  }
}

async function deleteAuthUser(admin, userId) {
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    console.warn(
      `cleanup warning: could not delete auth user ${userId}: ${error.message}`
    );
  }
}

async function main() {
  loadEnvFile(envPath);

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const publicClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const createdUsers = [];

  try {
    logStep("Schema and RPC readiness");
    await checkSchema(admin);

    logStep("Create smoke users");
    const owner = await createSmokeUser(admin, publicClient, "owner");
    const stranger = await createSmokeUser(admin, publicClient, "stranger");
    createdUsers.push(owner, stranger);

    await ensureProfile(admin, owner.userId, owner.email, 120);
    await ensureProfile(admin, stranger.userId, stranger.email, 0);

    const ownerClient = createAuthedClient(
      supabaseUrl,
      supabaseAnonKey,
      owner.accessToken
    );
    const strangerClient = createAuthedClient(
      supabaseUrl,
      supabaseAnonKey,
      stranger.accessToken
    );

    logStep("Seed one active entitlement and validate RLS");
    const { error: seedError } = await admin.from("reading_mode_entitlements").insert(
      {
        user_id: owner.userId,
        mode: "tarot",
        status: "active",
        source: "smoke_seed",
        credits_spent: 80,
      }
    );

    if (seedError) {
      throw new Error(`Could not seed entitlement row: ${seedError.message}`);
    }

    const ownerRead = await ownerClient
      .from("reading_mode_entitlements")
      .select("user_id,mode,status,source,credits_spent")
      .order("created_at", { ascending: true });

    if (ownerRead.error) {
      throw new Error(`Owner RLS read failed: ${ownerRead.error.message}`);
    }

    assertOk(
      ownerRead.data?.length === 1 && ownerRead.data[0].mode === "tarot",
      "Owner could not read their own active entitlement row."
    );

    const strangerRead = await strangerClient
      .from("reading_mode_entitlements")
      .select("user_id,mode,status,source,credits_spent")
      .eq("user_id", owner.userId);

    if (strangerRead.error) {
      throw new Error(`Stranger RLS read failed: ${strangerRead.error.message}`);
    }

    assertOk(
      Array.isArray(strangerRead.data) && strangerRead.data.length === 0,
      "RLS leak: unrelated user could read another user's entitlement rows."
    );

    logStep("Unlock daily_loop through RPC");
    const firstUnlock = await admin.rpc("unlock_reading_mode", {
      p_user_id: owner.userId,
      p_mode: "daily_loop",
      p_credits_cost: 50,
    });

    if (firstUnlock.error) {
      throw new Error(`unlock_reading_mode failed: ${firstUnlock.error.message}`);
    }

    const firstUnlockValue = Array.isArray(firstUnlock.data)
      ? firstUnlock.data[0]
      : firstUnlock.data;

    assertOk(
      firstUnlockValue &&
        firstUnlockValue.alreadyOwned === false &&
        firstUnlockValue.mode === "daily_loop" &&
        firstUnlockValue.creditsBalance === 70,
      `Unexpected unlock_reading_mode result: ${JSON.stringify(firstUnlockValue)}`
    );

    const ownerProfile = await getProfile(admin, owner.userId);
    assertOk(
      ownerProfile.credits_balance === 70,
      `Expected credits_balance 70 after unlock, got ${ownerProfile.credits_balance}`
    );

    const transactionCheck = await admin
      .from("credit_transactions")
      .select("id,amount,type,reason")
      .eq("user_id", owner.userId)
      .eq("reason", "unlock_daily_loop");

    if (transactionCheck.error) {
      throw new Error(
        `Could not verify unlock credit transaction: ${transactionCheck.error.message}`
      );
    }

    assertOk(
      transactionCheck.data?.length === 1 &&
        transactionCheck.data[0].amount === -50 &&
        transactionCheck.data[0].type === "usage",
      `Unexpected credit transaction rows: ${JSON.stringify(transactionCheck.data)}`
    );

    const entitlementCheck = await admin
      .from("reading_mode_entitlements")
      .select("mode,status,source,credits_spent")
      .eq("user_id", owner.userId)
      .eq("mode", "daily_loop")
      .single();

    if (entitlementCheck.error || !entitlementCheck.data) {
      throw new Error(
        `Could not verify unlocked entitlement: ${entitlementCheck.error?.message || "missing row"}`
      );
    }

    assertOk(
      entitlementCheck.data.status === "active" &&
        entitlementCheck.data.source === "credit_unlock" &&
        entitlementCheck.data.credits_spent === 50,
      `Unexpected entitlement row after unlock: ${JSON.stringify(entitlementCheck.data)}`
    );

    logStep("Verify idempotent re-unlock");
    const secondUnlock = await admin.rpc("unlock_reading_mode", {
      p_user_id: owner.userId,
      p_mode: "daily_loop",
      p_credits_cost: 50,
    });

    if (secondUnlock.error) {
      throw new Error(
        `Second unlock_reading_mode call failed: ${secondUnlock.error.message}`
      );
    }

    const secondUnlockValue = Array.isArray(secondUnlock.data)
      ? secondUnlock.data[0]
      : secondUnlock.data;

    assertOk(
      secondUnlockValue &&
        secondUnlockValue.alreadyOwned === true &&
        secondUnlockValue.creditsBalance === 70,
      `Unexpected second unlock result: ${JSON.stringify(secondUnlockValue)}`
    );

    const secondTransactionCheck = await admin
      .from("credit_transactions")
      .select("id")
      .eq("user_id", owner.userId)
      .eq("reason", "unlock_daily_loop");

    if (secondTransactionCheck.error) {
      throw new Error(
        `Could not re-check unlock transaction count: ${secondTransactionCheck.error.message}`
      );
    }

    assertOk(
      secondTransactionCheck.data?.length === 1,
      "Idempotency failed: duplicate unlock credit transaction was written."
    );

    console.log(
      "\nPASS: reading_mode_entitlements table, RLS, and unlock_reading_mode RPC validated."
    );
  } finally {
    for (const user of createdUsers) {
      await cleanupUserData(admin, user.userId);
      await deleteAuthUser(admin, user.userId);
    }
  }
}

main().catch((error) => {
  console.error("\nSMOKE TEST FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
