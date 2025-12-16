# Web Frontend

The web UI that participants and delegates use.

This is something of a "different practices" project - testing a different way to write webapps, closer to how we used to do it in the older days. No build step required. Using `snowpack` to compile dependencies to nice importable modules.

As it is a test, it's not advisable to take much inspiration from it, as it is very messy in places.

## Stack

- [Heresy](https://github.com/WebReflection/heresy) for the UI (React-like Web Components)
- [Redux Bundler](https://reduxbundler.com) for state management

## Setup

```bash
yarn
yarn start    # Opens https://localhost:8080
```

## Reading the Code

Start with an HTML file - that's the entry point for each app. Looking at [src/queue.html](./src/queue.html) you'll see it uses the `roi-queue` element, which you'll find at [src/comp/queue.js](./src/comp/queue.js).

It's React-ish thanks to Heresy and its hooks. The main hook is `useSel` which uses selectors from redux-bundler. That state lives in [src/db/state.js](./src/db/state.js).

## Pages

- `queue.html` - Main participant interface
- `manage.html` - Admin control panel
- `gfx.html` - Livestream overlay (for OBS)
- `fullscreen.html` / `screen.html` - Audience displays

## Whereby Integration

You'll likely get trouble with the Whereby embed. You can install an [extension to disable CSP](https://chrome.google.com/webstore/detail/disable-content-security/ieelmcmcagommplceebfedjlakkhpden) which will make it embed. However, you'll also need a domain with keys your browser truly accepts to get video.

Once you have the certs:

```bash
yarn start --ssl-cert=cert.crt --ssl-key=cert.key
```
