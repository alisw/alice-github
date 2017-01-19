// Web application which authenticates to github
var http   = require('http')
  , url    = require('url')
  , qs     = require('querystring')
  , github = require('octonode');

// GITHUB_CLIENT_ID and GITHUB_SECRET should be registered in Github
// GITHUB_API should be something like https://github.com/api/v3
// WEB_URL should be https:
//  webUrl: 'https://optional-internal-github-enterprise'
// Build the authorization config and url
var auth_url = github.auth.config({
  id: process.env.GITHUB_CLIENT_ID,
  secret: process.env.GITHUB_SECRET,
  apiUrl: process.env.GITHUB_API
}).login(['user:read']);

function nocache(d) {
  var resp = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  };
  for (k in d) {
    resp[k] = d[k];
  }
  return resp;
}

// Store info to verify against CSRF
var state = auth_url.match(/&state=([0-9a-z]{32})/i);

var USER_DB = {}

// Web server
http.createServer(function (req, res) {
  uri = url.parse(req.url);
  // Redirect to github login
  if (uri.pathname=='/login') {
    res.writeHead(302, nocache({'Content-Type': 'text/plain', 'Location': auth_url}));
    res.end('Redirecting to ' + auth_url);
  }
  // Callback url from github login
  else if (uri.pathname=='/auth') {
    var values = qs.parse(uri.query);
    // Check against CSRF attacks
    if (!state || state[1] != values.state) {
      res.writeHead(403, nocache({'Content-Type': 'text/plain'}));
      res.end('');
    } else {
      github.auth.login(values.code, function (err, token) {
        // Now we have a token. Let's create an authenticated client with it
        // and map the ADFS_LOGIN to the github username.
        client = github.client(token);
        client.get('/user', {}, function (err, status, body, headers) {
          console.log("/auth:err: " + err);
          console.log("/auth:body: " + JSON.stringify(body));
          if (err || !body || (body.login == undefined)) {
            res.writeHead(403, nocache({'Content-Type': 'text/plain'}));
            res.end('Unable to fetch GitHub account name.');
            return;
          }
          USER_DB[req.headers.adfs_login] = body.login;
          res.writeHead(302, nocache({'Content-Type': 'text/html',
                                      'Location': process.env.ALICE_GITHUB_PREFIX+'/whoami'}));
          res.end('');
        });
      });
    }
  }
  else if (uri.pathname=='/whoami') {
    console.log("/whoami:adfs_login: " + req.headers.adfs_login);
    var user_cern = req.headers.adfs_login;
    var user_github = USER_DB[user_cern];
    res.writeHead(200, nocache({'Content-Type': 'text/html'}));
    console.log("/whoami:rows: " + JSON.stringify([user_cern, user_github]));
    if (user_github) {
      res.end("Hello " + req.headers.adfs_fullname + ".<br/>" +
              "You are <tt>" + user_cern + "</tt> at CERN and " +
              "<tt>" + user_github + "</tt> on GitHub.<br/>" +
              "<a href=\"https://alisw.github.io/git-tutorial\">Proceed to the tutorial.</a>");
      return;
    }
    res.writeHead(302, nocache({'Content-Type': 'text/plain', 'Location': auth_url}));
    res.end('Redirecting to ' + auth_url);
  }
  else if (uri.pathname=='/users') {
    var values = qs.parse(uri.query);
    var secret = values.secret;
    if (secret != process.env.ALICE_GITHUB_SECRET) {
      res.writeHead(403, nocache({'Content-Type': 'application/json'}));
      res.end('{"status": "not authorized"}');
      return;
    }
    res.end(JSON.stringify({"login_mapping": USER_DB}));
  }
  else if (uri.pathname == "/pull-request-hook") {
    // Pull request hook should push PR for later
    // processing.
  }
  else if (uri.pathname == "/health") {
    res.writeHead(200, nocache({'Content-Type': 'application/json'}));
    res.end('{"status": "ok"}');
  }
  else {
    res.writeHead(302, nocache({'Content-Type': 'text/plain', 'Location': auth_url}));
    res.end('Path does not exists redirecting to ' + auth_url);
  }
}).listen(8888);

console.log('Server started on 8888');
