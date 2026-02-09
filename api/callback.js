module.exports = async function handler(req, res) {
  var code = req.query.code;

  if (!code) {
    res.statusCode = 400;
    res.end('Missing code parameter');
    return;
  }

  var clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  var clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.statusCode = 500;
    res.end('Error: Missing env vars. clientId=' + (clientId ? 'set' : 'missing') + ' clientSecret=' + (clientSecret ? 'set' : 'missing'));
    return;
  }

  try {
    var response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    var rawBody = await response.text();

    var data;
    try {
      data = JSON.parse(rawBody);
    } catch (parseErr) {
      res.statusCode = 500;
      res.end('GitHub returned non-JSON (status ' + response.status + '): ' + rawBody.substring(0, 500));
      return;
    }

    if (data.error) {
      res.statusCode = 401;
      res.end('Auth error: ' + (data.error_description || data.error));
      return;
    }

    var token = data.access_token;

    if (!token) {
      res.statusCode = 500;
      res.end('No access_token in response: ' + JSON.stringify(data));
      return;
    }

    var html = [
      '<!doctype html><html><body><script>',
      '(function() {',
      '  var token = "' + token + '";',
      '  var provider = "github";',
      '  var payload = JSON.stringify({ token: token, provider: provider });',
      '  var msg = "authorization:" + provider + ":success:" + payload;',
      '  if (window.opener) {',
      '    window.opener.postMessage(msg, "*");',
      '    setTimeout(function() { window.close(); }, 500);',
      '  } else {',
      '    document.body.innerHTML = "<p>Auth successful! You can close this window.</p>";',
      '  }',
      '})();',
      '</script></body></html>'
    ].join('\n');

    res.setHeader('Content-Type', 'text/html');
    res.end(html);
  } catch (err) {
    res.statusCode = 500;
    res.end('OAuth exchange error: ' + (err.message || String(err)));
  }
};
