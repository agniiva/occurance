module.exports = function handler(req, res) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const scope = 'repo,user';
  const redirectUri = 'https://www.agnivamahata.com/api/callback';
  const authUrl = 'https://github.com/login/oauth/authorize?client_id=' + clientId + '&scope=' + scope + '&redirect_uri=' + encodeURIComponent(redirectUri);
  res.writeHead(302, { Location: authUrl });
  res.end();
};
