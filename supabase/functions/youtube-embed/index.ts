import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const videoId = url.searchParams.get("v");

    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return new Response("Missing or invalid video ID", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Use the Supabase project URL as origin since this page is served from there
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || url.origin;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="referrer" content="origin">
<title>Video</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#000}
.container{position:relative;width:100%;height:100%}
#player{position:absolute;top:0;left:0;width:100%;height:100%;border:0}
.error{display:none;position:absolute;inset:0;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:1rem}
.error a{color:#4ea8de;margin-top:0.5rem}
</style>
</head>
<body>
<div class="container">
  <iframe
    id="player"
    src="https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&autoplay=1&rel=0&modestbranding=1&controls=1&enablejsapi=0&origin=${encodeURIComponent(supabaseUrl)}"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen
  ></iframe>
  <div class="error" id="error-msg">
    <p>Video unavailable</p>
    <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">Open on YouTube</a>
  </div>
</div>
<script>
var iframe = document.getElementById('player');
iframe.onerror = function() {
  iframe.style.display = 'none';
  var err = document.getElementById('error-msg');
  err.style.display = 'flex';
};
</script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "ALLOWALL",
        "Content-Security-Policy": "frame-ancestors *",
        "Referrer-Policy": "origin",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Internal error", {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain",
      },
    });
  }
});
