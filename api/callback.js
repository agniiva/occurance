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
    res.end('Missing env vars. clientId=' + (clientId ? 'set' : 'missing') + ' secret=' + (clientSecret ? 'set' : 'missing'));
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
    } catch (e) {
      res.statusCode = 500;
      res.end('GitHub non-JSON (HTTP ' + response.status + '): ' + rawBody.substring(0, 500));
      return;
    }

    if (data.error) {
      res.statusCode = 401;
      res.end('GitHub error: ' + (data.error_description || data.error));
      return;
    }

    var token = data.access_token;
    if (!token) {
      res.statusCode = 500;
      res.end('No access_token. Response: ' + JSON.stringify(data));
      return;
    }

    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<html><body><script>\n' +
      '(function() {\n' +
      '  window.opener.postMessage(\n' +
      '    "authorizing:github",\n' +
      '    "*"\n' +
      '  );\n' +
      '  window.addEventListener("message", function(e) {\n' +
      '    window.opener.postMessage(\n' +
      '      \'authorization:github:success:{"token":"' + token + '","provider":"github"}\',\n' +
      '      e.origin\n' +
      '    );\n' +
      '  });\n' +
      '})();\n' +
      '</script></body></html>'
    );
  } catch (err) {
    res.statusCode = 500;
    res.end('Exchange error: ' + (err.message || String(err)));
  }
};
