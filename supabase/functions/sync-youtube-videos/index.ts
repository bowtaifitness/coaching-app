import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchAllChannelVideos(apiKey: string, channelId: string): Promise<YouTubeVideo[]> {
  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
  );
  if (!channelRes.ok) {
    throw new Error(`YouTube channels API failed: ${channelRes.status} ${await channelRes.text()}`);
  }
  const channelData = await channelRes.json();
  const uploadsPlaylistId: string | undefined =
    channelData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    throw new Error("Could not resolve uploads playlist for channel");
  }

  const videos: YouTubeVideo[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("playlistId", uploadsPlaylistId);
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`YouTube playlistItems API failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    for (const item of data.items ?? []) {
      const videoId = item?.contentDetails?.videoId ?? item?.snippet?.resourceId?.videoId;
      const title = item?.snippet?.title;
      if (videoId && title) {
        videos.push({
          id: videoId,
          title,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return videos;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    const channelId = Deno.env.get("YOUTUBE_CHANNEL_ID");

    if (!apiKey || !channelId) {
      return new Response(
        JSON.stringify({
          error:
            "Missing YOUTUBE_API_KEY and/or YOUTUBE_CHANNEL_ID edge function secrets. Add them in Supabase Dashboard > Edge Functions > Secrets.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, email")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin =
      profile?.role === "admin" ||
      profile?.role === "coach" ||
      profile?.email === "brian@bowtaifitness.com";

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body?.dryRun === true;
    const overwrite: boolean = body?.overwrite !== false;

    const videos = await fetchAllChannelVideos(apiKey, channelId);

    const videoByNormTitle = new Map<string, YouTubeVideo>();
    for (const v of videos) {
      videoByNormTitle.set(normalize(v.title), v);
    }

    const { data: exercises, error: exErr } = await supabase
      .from("exercises")
      .select("id, name, video_url");
    if (exErr) throw exErr;

    const matches: Array<{ id: string; name: string; title: string; url: string }> = [];
    const unmatched: string[] = [];

    for (const ex of exercises ?? []) {
      const key = normalize(ex.name);
      let match = videoByNormTitle.get(key);
      if (!match) {
        for (const [title, v] of videoByNormTitle) {
          if (title.includes(key) || key.includes(title)) {
            match = v;
            break;
          }
        }
      }
      if (match) {
        if (overwrite || !ex.video_url) {
          matches.push({ id: ex.id, name: ex.name, title: match.title, url: match.url });
        }
      } else {
        unmatched.push(ex.name);
      }
    }

    let updated = 0;
    if (!dryRun && matches.length > 0) {
      for (const m of matches) {
        const { error: updErr } = await supabase
          .from("exercises")
          .update({ video_url: m.url })
          .eq("id", m.id);
        if (!updErr) updated++;
      }
    }

    return new Response(
      JSON.stringify({
        videos_fetched: videos.length,
        exercises_total: exercises?.length ?? 0,
        matched: matches.length,
        updated,
        unmatched_count: unmatched.length,
        unmatched_sample: unmatched.slice(0, 20),
        dry_run: dryRun,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
