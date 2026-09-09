const { timingSafeEqual } = require('node:crypto');

const ORIGIN = 'https://www.agnivamahata.com';
const REDIRECT_URI = ORIGIN + '/api/callback';

// JSON is embedded in HTML, not just JavaScript: never permit a closing script tag.
function scriptJSON(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Set-Cookie', 'cms_oauth_state=; Secure; HttpOnly; SameSite=Lax; Path=/api; Max-Age=0');

  const query = req.query || {};
  const code = query.code;
  const state = query.state;
  const cookieHeader = req.headers && req.headers.cookie;
  const cookies = typeof cookieHeader === 'string'
    ? cookieHeader.split(';').map(cookie => cookie.trim()).filter(cookie => cookie.startsWith('cms_oauth_state='))
    : [];
  const cookieState = cookies.length === 1 ? cookies[0].slice('cms_oauth_state='.length) : '';
  const validState = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]+$/.test(value);

  if (query.error !== undefined ||
      typeof code !== 'string' || code.length === 0 || code.length > 512 || /[^A-Za-z0-9_-]/.test(code) ||
      !validState(state) || !validState(cookieState) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(cookieState))) {
    res.statusCode = 400;
    res.end('Invalid or expired sign-in. Close this window and restart CMS login.');
    return;
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId?.trim() || !clientSecret?.trim()) {
    res.statusCode = 500;
    res.end('CMS sign-in is not configured. Contact the site administrator.');
    return;
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!response.ok) throw new Error('OAuth exchange failed');
    const data = JSON.parse(await response.text());
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.error !== undefined ||
        typeof data.access_token !== 'string' || !data.access_token.trim()) {
      throw new Error('Invalid OAuth response');
    }
    const token = data.access_token;

    const message = 'authorization:github:success:' + JSON.stringify({ token, provider: 'github' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      '<!doctype html><html><body><script>\n' +
      '(function() {\n' +
      '  var origin = ' + scriptJSON(ORIGIN) + ';\n' +
      '  if (!window.opener) return;\n' +
      '  function receiveMessage(event) {\n' +
      '    if (event.source !== window.opener || event.origin !== origin || event.data !== "authorizing:github") return;\n' +
      '    window.removeEventListener("message", receiveMessage);\n' +
      '    window.opener.postMessage(' + scriptJSON(message) + ', origin);\n' +
      '  }\n' +
      '  window.addEventListener("message", receiveMessage);\n' +
      '  window.opener.postMessage("authorizing:github", origin);\n' +
      '})();\n' +
      '</script></body></html>'
    );
  } catch {
    res.statusCode = 502;
    res.end('GitHub sign-in could not be completed. Close this window and try again from the CMS.');
  }
};
