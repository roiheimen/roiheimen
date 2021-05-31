The web ui that people (or participants or delegates) use.

It's tried built without any build-step. Using `snowpack` to compile the
dependencies to nice importable modules.

- [heresy](https://github.com/WebReflection/heresy) for the UI
- [redux-bundler](https://reduxbundler.com) for some of the state
  management.

Run `yarn` to install and set up.
Run `yarn start` to try it out in your browser.

Code
----
This is something of a "different" practices project. Since it's testing
a different way to write webapps. Closer to how we used to do it in the
older days.

As it is a test, it's not advisable to take much inspiration from it, as
it is very messy in places.

The suggested way to read is to first look at the HTML file which is the
start point for each app. Taking a look at
[src/queue.html](./src/queue.html) first you can see it uses the
`roi-queue` element, which you'll read the code for at
[src/comp/queue.js](./src/comp/queue.js). It's kinda React-ish coming
from Heresy and its hooks. The most used main hook is `useSel` which
uses a selector from `redux-bundler`.

That redux state is stored in [src/db/state.js](./src/db/state.js) which
is ready for a proper filer split.

Running with Whereby embed and video
------------------------------------

You'll likely get some trouble with the Whereby embed. You can install
an [extension to disable CSP][ext] which will make it embed. However,
you will also need a domain with keys your browser truly accepts to get
video.

[ext]: https://chrome.google.com/webstore/detail/disable-content-security/ieelmcmcagommplceebfedjlakkhpden

Many ways to do that, but once you have the certs, run like:

    yarn start --ssl-cert=cert.crt --ssl-key=cert.key
