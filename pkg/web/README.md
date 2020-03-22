The web ui that people (or participants or delegates) use.

It's tried built without any build-step. Using `snowpack` to compile the
dependencies to nice importable modules.

Run `yarn` to install and set up.
Run `yarn start` to try it out in your browser.

Running properly with Whereby embed and video
---------------------------------------------

You'll likely get some trouble with the Whereby embed. You can install
an [extension to disable CSP][ext] which will make it embed. However,
you will also need a domain with keys your browser truly accepts to get
video.

[ext]: https://chrome.google.com/webstore/detail/disable-content-security/ieelmcmcagommplceebfedjlakkhpden

Many ways to do that, but once you have the certs, run like:

    yarn start --ssl-cert=cert.crt --ssl-key=cert.key
