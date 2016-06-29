// Web application which authenticates to github
var http   = require('http')
  , url    = require('url')
  , qs     = require('querystring')
  , github = require('octonode')
  , mysql  = require('mysql');

// GITHUB_CLIENT_ID and GITHUB_SECRET should be registered in Github
// GITHUB_API should be something like htts://github.com/api/v3
// WEB_URL should be https:
//  webUrl: 'https://optional-internal-github-enterprise'
// Build the authorization config and url
var auth_url = github.auth.config({
  id: process.env.GITHUB_CLIENT_ID,
  secret: process.env.GITHUB_SECRET,
  apiUrl: process.env.GITHUB_API
}).login(['user']);

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

var db = mysql.createConnection(process.env.ALICE_GITHUB_DB);
db.query("CREATE DATABASE IF NOT EXISTS alice_github;", function(err, res) {
  db.query("CREATE TABLE IF NOT EXISTS alice_github.user_mapping (" +
           "  cern_login VARCHAR(250) NOT NULL,"                      +
           "   github_login VARCHAR(250) NOT NULL,"                   +
           "   PRIMARY KEY (cern_login) );");
});

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
          db.query("INSERT INTO alice_github.user_mapping (cern_login, github_login) " +
                   "VALUES (?, ?) ON DUPLICATE KEY UPDATE github_login = ?;",
                   [req.headers.adfs_login, body.login, body.login],
                   function(dberr, dbres) {
                     res.writeHead(302, nocache({'Content-Type': 'text/html',
                                                 'Location': process.env.ALICE_GITHUB_PREFIX+'/whoami'}));
                     res.end('');
                   });
        });
      });
    }
  }
  else if (uri.pathname=='/whoami') {
    console.log("/whoami:adfs_login: " + req.headers.adfs_login);
    db.query("SELECT github_login FROM alice_github.user_mapping WHERE cern_login = ?;",
             [req.headers.adfs_login],
             function(err, rows) {
               res.writeHead(200, nocache({'Content-Type': 'text/html'}));
               console.log("/whoami:err: " + err);
               console.log("/whoami:rows: " + JSON.stringify(rows));
               if (!err && rows && rows.length) {
                 res.end("Hello " + req.headers.adfs_fullname + ".<br/>" +
                         "You are <tt>" + req.headers.adfs_login + "</tt> at CERN and " +
                         "<tt>" + rows[0].github_login + "</tt> on GitHub.<br/>" +
                         "<a href=\"https://alisw.github.io/git-tutorial\">Proceed to the tutorial.</a>");
               }
               res.end("I don't know who you are on GitHub.");
             });
  }
  else if (uri.pathname == "/pull-request-hook") {
    // Pull request hook should push PR for later
    // processing.
  }
  else if (uri.pathname == "/health") {
    db.ping(function (err) {
      if (err) {
        res.writeHead(500, nocache({'Content-Type': 'text/plain'}));
        res.end('{"status": "cannot ping database"}');
        return;
      }
      res.writeHead(200, nocache({'Content-Type': 'text/plain'}));
      res.end('{"status": "ok"}');
    });
  } else {
    res.writeHead(404, nocache({'Content-Type': 'text/plain'}));
    res.end('Endpoint undefined');
  }
}).listen(8888);

console.log('Server started on 8888');
