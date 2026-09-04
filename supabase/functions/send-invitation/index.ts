const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvitationRequest {
  email: string;
  role: 'coach' | 'trainer';
  token: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, role, token }: InvitationRequest = await req.json();

    if (!email || !role || !token) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const baseUrl = req.headers.get('origin') || 'https://yourdomain.com';
    const inviteUrl = `${baseUrl}?invite=${token}&email=${encodeURIComponent(email)}&role=${role}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: #ffffff;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .logo {
              text-align: center;
              margin-bottom: 30px;
            }
            h1 {
              color: #1a73e8;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #1a73e8;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              font-size: 14px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h2>Birdies by Bowtai</h2>
            </div>

            <h1>You've Been Invited!</h1>

            <p>Hello,</p>

            <p>You've been invited to join Birdies by Bowtai as a <strong>${role}</strong>.</p>

            <p>Click the button below to complete your registration:</p>

            <a href="${inviteUrl}" class="button">Accept Invitation</a>

            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">${inviteUrl}</p>

            <p>This invitation will expire in 7 days.</p>

            <div class="footer">
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
              <p>Questions? Contact your administrator.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log('Invitation email generated for:', email);
    console.log('Note: Email sending requires SMTP configuration');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation created successfully',
        inviteUrl: inviteUrl
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error processing invitation:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
