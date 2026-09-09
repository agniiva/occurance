const { randomBytes } = require('node:crypto');

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0');
  if (!process.env.GITHUB_OAUTH_CLIENT_ID?.trim() || !process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim()) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Set-Cookie', 'cms_oauth_state=; Secure; HttpOnly; SameSite=Lax; Path=/api; Max-Age=0');
    res.end('CMS sign-in is not configured. Contact the site administrator.');
    return;
  }

  const state = randomBytes(32).toString('hex');
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
    scope: 'repo,user',
    redirect_uri: 'https://www.agnivamahata.com/api/callback',
    state,
  });
  res.writeHead(302, {
    'Cache-Control': 'no-store, no-cache, max-age=0',
    'Set-Cookie': 'cms_oauth_state=' + state + '; Secure; HttpOnly; SameSite=Lax; Path=/api; Max-Age=600',
    Location: 'https://github.com/login/oauth/authorize?' + params.toString(),
  });
  res.end();
};
