import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return respond(405, { error: "Use POST to invite a team member." });
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !accessToken || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond(500, { error: "The invitation service is not configured." });
  }

  let input: { email?: unknown; role?: unknown };
  try {
    input = await request.json();
  } catch {
    return respond(400, { error: "Provide a valid JSON request." });
  }

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const role = input.role;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond(400, { error: "Enter a valid email address." });
  }
  if (role !== "manager" && role !== "assistant_manager") {
    return respond(400, { error: "Choose Manager or Assistant Manager." });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerResult, error: callerError } = await callerClient.auth.getUser(accessToken);
  const caller = callerResult.user;
  if (callerError || !caller) {
    return respond(401, { error: "Sign in again before inviting a team member." });
  }

  const { data: membership, error: membershipError } = await adminClient
    .from("farm_members")
    .select("farm_id, role, is_primary_manager")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (membershipError) {
    console.error("Could not verify the inviter's farm role:", membershipError);
    return respond(500, { error: "Could not verify your farm permissions." });
  }
  if (!membership || membership.role !== "manager" || !membership.is_primary_manager) {
    return respond(403, { error: "Only the primary manager can invite team members." });
  }

  const { data: existingMember, error: existingMemberError } = await adminClient
    .from("farm_members")
    .select("user_id")
    .eq("farm_id", membership.farm_id)
    .eq("email", email)
    .maybeSingle();
  if (existingMemberError) {
    console.error("Could not check existing farm members:", existingMemberError);
    return respond(500, { error: "Could not check whether this person is already on the team." });
  }
  if (existingMember) {
    return respond(409, { error: "This email address is already on the farm team." });
  }

  const displayName = role === "assistant_manager" ? "Assistant Manager" : "Manager";
  const siteUrl = Deno.env.get("SITE_URL");
  const { data: invitation, error: invitationError } = await adminClient.auth.admin
    .inviteUserByEmail(email, {
      data: { display_name: displayName },
      ...(siteUrl ? { redirectTo: siteUrl } : {}),
    });
  if (invitationError || !invitation.user) {
    console.error("Could not send farm team invitation:", invitationError);
    return respond(400, {
      error: invitationError?.message || "Supabase did not return the invited account.",
    });
  }

  const { error: addMemberError } = await adminClient.from("farm_members").insert({
    farm_id: membership.farm_id,
    user_id: invitation.user.id,
    email,
    role,
    is_primary_manager: false,
    requires_password_setup: true,
    added_by: caller.id,
  });
  if (addMemberError) {
    console.error("Invitation sent, but farm membership could not be saved:", addMemberError);
    return respond(500, {
      error: "The invitation may have been sent, but farm access could not be saved. Check the team list before trying again.",
    });
  }

  return respond(200, { email, role });
});
