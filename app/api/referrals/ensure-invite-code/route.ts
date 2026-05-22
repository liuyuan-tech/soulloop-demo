import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { applyCreditTransaction } from "@/lib/credits/apply-credit-transaction";

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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,email,invite_code,credits_balance")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      const generatedCode = generateInviteCode();

      const { data: createdProfile, error: createError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email || null,
          invite_code: generatedCode,
          credits_balance: 0,
        })
        .select("id,email,invite_code,credits_balance")
        .single();

      if (createError || !createdProfile) {
        return NextResponse.json(
          {
            error:
              createError?.message ||
              "User profile was missing and could not be created.",
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

      return NextResponse.json({
        inviteCode: createdProfile.invite_code,
        created: true,
        updated: false,
      });
    }

    if (profile.invite_code) {
      return NextResponse.json({
        inviteCode: profile.invite_code,
        created: false,
        updated: false,
      });
    }

    const generatedCode = generateInviteCode();

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        invite_code: generatedCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id,email,invite_code,credits_balance")
      .single();

    if (updateError || !updatedProfile) {
      return NextResponse.json(
        {
          error:
            updateError?.message || "Failed to generate user invite code.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      inviteCode: updatedProfile.invite_code,
      created: false,
      updated: true,
    });
  } catch (error) {
    console.error("ENSURE_INVITE_CODE_ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Ensure invite code error: ${error.message}`
            : "Ensure invite code error.",
      },
      { status: 500 }
    );
  }
}
