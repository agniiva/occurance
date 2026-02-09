module.exports = function handler(req, res) {
  var clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  var scope = 'repo,user';
  var redirectUri = 'https://www.agnivamahata.com/api/callback';
  var authUrl = 'https://github.com/login/oauth/authorize?client_id=' + clientId + '&scope=' + scope + '&redirect_uri=' + encodeURIComponent(redirectUri);
  res.writeHead(302, { Location: authUrl });
  res.end();
};
