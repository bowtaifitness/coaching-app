import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationPayload {
  user_id: string;
  notification_type: "upcoming_workout" | "completed" | "block_end";
  workout_details: {
    title: string;
    scheduled_date?: string;
    block_number?: number;
    summary?: string;
  };
}

interface NotificationPreferences {
  email_upcoming_workout: boolean;
  email_completed: boolean;
  email_block_end: boolean;
}

function getEmailPrefKey(
  type: NotificationPayload["notification_type"]
): keyof NotificationPreferences {
  switch (type) {
    case "upcoming_workout":
      return "email_upcoming_workout";
    case "completed":
      return "email_completed";
    case "block_end":
      return "email_block_end";
  }
}

function buildSubject(
  type: NotificationPayload["notification_type"],
  details: NotificationPayload["workout_details"]
): string {
  switch (type) {
    case "upcoming_workout":
      return `Upcoming Workout: ${details.title}`;
    case "completed":
      return `Workout Completed: ${details.title}`;
    case "block_end":
      return `Training Block ${details.block_number ?? ""} Complete`;
  }
}

function buildEmailBody(
  type: NotificationPayload["notification_type"],
  details: NotificationPayload["workout_details"],
  firstName: string
): string {
  const greeting = `Hi ${firstName},`;

  switch (type) {
    case "upcoming_workout":
      return `${greeting}\n\nYou have an upcoming workout scheduled:\n\n${details.title}${details.scheduled_date ? `\nDate: ${details.scheduled_date}` : ""}\n\n${details.summary || "Get ready to crush it!"}\n\n- Birdies by Bowtai`;
    case "completed":
      return `${greeting}\n\nGreat work! You completed your workout:\n\n${details.title}\n\n${details.summary || "Keep up the momentum!"}\n\n- Birdies by Bowtai`;
    case "block_end":
      return `${greeting}\n\nCongratulations! You've finished training block ${details.block_number ?? ""}.\n\n${details.summary || "Time to move on to the next phase of your program."}\n\n- Birdies by Bowtai`;
  }
}

async function sendEmailViaResend(
  to: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = Deno.env.get("RESEND_NOTIFICATIONS_API_KEY");
  if (!resendApiKey) {
    return { success: false, error: "RESEND_NOTIFICATIONS_API_KEY not configured" };
  }

  const fromAddress =
    Deno.env.get("RESEND_FROM_ADDRESS") || "notifications@birdiesbybowtai.com";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Birdies by Bowtai <${fromAddress}>`,
      to: [to],
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { success: false, error: `Resend API error: ${res.status} - ${errBody}` };
  }

  return { success: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();

    if (!payload.user_id || !payload.notification_type || !payload.workout_details) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: user_id, notification_type, workout_details",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validTypes = ["upcoming_workout", "completed", "block_end"];
    if (!validTypes.includes(payload.notification_type)) {
      return new Response(
        JSON.stringify({
          error: `Invalid notification_type. Must be one of: ${validTypes.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, first_name, notification_preferences")
      .eq("id", payload.user_id)
      .maybeSingle();

    if (profileError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch user profile: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prefs: NotificationPreferences = {
      email_upcoming_workout: false,
      email_completed: false,
      email_block_end: false,
      ...(profile.notification_preferences || {}),
    };

    const emailPrefKey = getEmailPrefKey(payload.notification_type);

    if (!prefs[emailPrefKey]) {
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: "Disabled by user preference" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.email) {
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: "No email address on profile" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject = buildSubject(payload.notification_type, payload.workout_details);
    const body = buildEmailBody(
      payload.notification_type,
      payload.workout_details,
      profile.first_name || "there"
    );

    const result = await sendEmailViaResend(profile.email, subject, body);

    return new Response(
      JSON.stringify({ success: result.success, sent: result.success, error: result.error }),
      { status: result.success ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
