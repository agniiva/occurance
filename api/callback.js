var https = require('https');

module.exports = function handler(req, res) {
  var code = req.query.code;

  if (!code) {
    res.statusCode = 400;
    res.end('Missing code parameter');
    return;
  }

  var postData = JSON.stringify({
    client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
    client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
    code: code,
  });

  var options = {
    hostname: 'github.com',
    path: '/login/oauth/access_token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  var ghReq = https.request(options, function (ghRes) {
    var body = '';
    ghRes.on('data', function (chunk) { body += chunk; });
    ghRes.on('end', function () {
      try {
        var data = JSON.parse(body);
        if (data.error) {
          res.statusCode = 401;
          res.end('Auth error: ' + (data.error_description || data.error));
          return;
        }

        var token = data.access_token;

        var html = [
          '<!doctype html><html><body><script>',
          '(function() {',
          '  var token = "' + token + '";',
          '  var provider = "github";',
          '  var payload = JSON.stringify({ token: token, provider: provider });',
          '  var msg = "authorization:" + provider + ":success:" + payload;',
          '  if (window.opener) {',
          '    window.opener.postMessage(msg, window.opener.location.origin);',
          '    window.close();',
          '  }',
          '})();',
          '</script></body></html>'
        ].join('\n');

        res.setHeader('Content-Type', 'text/html');
        res.end(html);
      } catch (e) {
        res.statusCode = 500;
        res.end('Failed to parse GitHub response');
      }
    });
  });

  ghReq.on('error', function () {
    res.statusCode = 500;
    res.end('OAuth token exchange failed');
  });

  ghReq.write(postData);
  ghReq.end();
};
