export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing code parameter');
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(401).send(`Auth error: ${data.error_description || data.error}`);
    }

    const token = data.access_token;
    const provider = 'github';

    // Send token back to CMS via postMessage
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!doctype html>
<html>
<body>
<script>
(function() {
  var token = "${token}";
  var provider = "${provider}";
  var msg = "authorization:" + provider + ":success:" + JSON.stringify({token: token, provider: provider});
  if (window.opener) {
    window.opener.postMessage(msg, "*");
    window.close();
  }
})();
</script>
</body>
</html>`);
  } catch (err) {
    res.status(500).send('OAuth token exchange failed');
  }
}
