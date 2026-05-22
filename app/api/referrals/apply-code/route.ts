import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { applyCreditTransaction } from "@/lib/credits/apply-credit-transaction";

type ApplyReferralCodeRequest = {
  inviteCode?: string;
};

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase();
}

function generateInviteCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
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

    const body = (await request.json()) as ApplyReferralCodeRequest;
    const rawInviteCode = body.inviteCode || "";
    const inviteCode = normalizeInviteCode(rawInviteCode);

    const { data: currentProfile, error: currentProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id,email,invite_code,referred_by_user_id")
        .eq("id", user.id)
        .single();

    if (currentProfileError || !currentProfile) {
      const generatedCode = generateInviteCode();

      const { error: insertProfileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email || null,
          invite_code: generatedCode,
          credits_balance: 0,
        });

      if (insertProfileError) {
        return NextResponse.json(
          {
            error: `User profile was not ready and could not be created: ${insertProfileError.message}`,
          },
          { status: 500 }
        );
      }

      try {
        await applyCreditTransaction({
          userId: user.id,
          amount: 20,
          type: "grant",
          reason: "new_user_bonus",
        });
      } catch (grantTransactionError) {
        return NextResponse.json(
          {
            error:
              grantTransactionError instanceof Error
                ? `User profile was created, but bonus credit transaction failed: ${grantTransactionError.message}`
                : "User profile was created, but bonus credit transaction failed.",
          },
          { status: 500 }
        );
      }
    } else if (!currentProfile.invite_code) {
      const { error: inviteCodeUpdateError } = await supabaseAdmin
        .from("profiles")
        .update({
          invite_code: generateInviteCode(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (inviteCodeUpdateError) {
        return NextResponse.json(
          {
            error: `Failed to create user invite code: ${inviteCodeUpdateError.message}`,
          },
          { status: 500 }
        );
      }
    }

    if (!inviteCode) {
      return NextResponse.json({
        applied: false,
        reason: "No invite code provided.",
      });
    }

    const { data: refreshedProfile, error: refreshedProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id,email,invite_code,referred_by_user_id")
        .eq("id", user.id)
        .single();

    if (refreshedProfileError || !refreshedProfile) {
      return NextResponse.json(
        {
          error:
            refreshedProfileError?.message ||
            "User profile was not found after creation.",
        },
        { status: 500 }
      );
    }

    if (refreshedProfile.referred_by_user_id) {
      return NextResponse.json({
        applied: false,
        reason: "Referral code has already been applied.",
      });
    }

    if (refreshedProfile.invite_code === inviteCode) {
      return NextResponse.json(
        { error: "You cannot use your own invite code." },
        { status: 400 }
      );
    }

    const { data: referrerProfile, error: referrerProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id,email,invite_code")
        .eq("invite_code", inviteCode)
        .single();

    if (referrerProfileError || !referrerProfile) {
      return NextResponse.json(
        { error: "Invalid invite code." },
        { status: 404 }
      );
    }

    if (referrerProfile.id === user.id) {
      return NextResponse.json(
        { error: "You cannot refer yourself." },
        { status: 400 }
      );
    }

    const { error: updateProfileError } = await supabaseAdmin
      .from("profiles")
      .update({
        referred_by_user_id: referrerProfile.id,
        referral_code_applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .is("referred_by_user_id", null)
      .select("id")
      .single();

    if (updateProfileError) {
      return NextResponse.json(
        {
          error:
            updateProfileError.code === "PGRST116"
              ? "Referral code has already been applied."
              : `Failed to apply invite code: ${updateProfileError.message}`,
        },
        { status: updateProfileError.code === "PGRST116" ? 409 : 500 }
      );
    }

    const { error: referralInsertError } = await supabaseAdmin
      .from("referrals")
      .upsert(
        {
          referrer_user_id: referrerProfile.id,
          referred_user_id: user.id,
          invite_code: inviteCode,
          status: "active",
        },
        {
          onConflict: "referred_user_id",
          ignoreDuplicates: true,
        }
      );

    if (referralInsertError) {
      return NextResponse.json(
        {
          error: `Invite code was applied, but referral record failed: ${referralInsertError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      applied: true,
      inviteCode,
      referrerUserId: referrerProfile.id,
    });
  } catch (error) {
    console.error("APPLY_REFERRAL_CODE_ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Apply referral code error: ${error.message}`
            : "Apply referral code error.",
      },
      { status: 500 }
    );
  }
}
