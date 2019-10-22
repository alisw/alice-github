This is a simple web application to be used to Map SSO users to their
Github counterparts.

Authentication flow at:

https://developer.github.com/v3/oauth/#web-application-flow

Notice the this is a stateless application, and no DB is actually needed.

# Deploying

In order to deploy this you need to first [register an application in
Github](https://github.com/settings/applications/new). As authorization
callback you need to specify the URL where this application will appear, _e.g._:

    https://mydomain.com/auth

Once you have done this you need to define the following environment variables:

- `GITHUB_CLIENT_ID`: the client ID given by Github for your application.
- `GITHUB_SECRET`: the secret provided by Github for your application.
- `GITHUB_API`: the endpoint for github API. Most likely `htts://github.com/api/v3`.
- `ALICE_GITHUB_PREFIX`: endpoint prefix for the web application, _e.g._ `/alice-github`.
- `ALICE_GITHUB_SECRET`: shared secret for querying user mappings.
