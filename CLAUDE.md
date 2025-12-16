# Roiheimen

Live voting and speaker list system for big meetings. Used at Norwegian political meetings (MDG Landsmote 2021, Noregs Mallag 2020).

## Project Structure

The code lives in `pkg/`:
- `pkg/server/` - PostGraphile GraphQL API (see `db.sql` for schema)
- `pkg/web/` - Frontend using Heresy + Redux Bundler

Ignore `v2/` - it's an unfinished experiment with Graphile Starter.

## Quick Start

```bash
yarn setup    # needs PostgreSQL with wal2json plugin
yarn start
# Open https://localhost:8080
# Login: num=1000, password=test
```

## Norwegian Terms

The UI is in Norwegian Nynorsk:
- **Sak** = Agenda item
- **Innlegg** = Main speech
- **Replikk** = Reply to a speech
- **Saksopplysing** = Point of information
- **Taleliste** = Speaker list

## Key Concepts

**Users**: Regular participants (num < 1000) can vote and speak. Admins (num >= 1000) manage meetings.

**Speech types**: `innleiing` (intro), `innlegg` (main), `replikk` (reply), `saksopplysing` (point of info)

**Referendums**: `open` (votes visible) or `closed` (secret ballot)

## Configuration

Meeting and sak have JSONB `config` fields. Options documented in root README.md:
- `voteDisallowNum` - Array of nums who can't vote
- `speechDisabled` / `speechInnleggDisabled` - Close speaker queue
- `hideClosedReferendumResults` - Don't show closed vote results
- `gfxIframeOnQueue` - Show live voting to participants
- `stableChoices` - Don't randomize vote options
- `video` - YouTube ID for livestream, or `false` to disable
- `externalCss` - URL to custom stylesheet
- `finishedAt` - When to hide meeting from front page

## Special Pages

- `/queue.html` - Participant view
- `/manage.html` - Admin panel
- `/gfx.html` - OBS overlay for livestream
- `/fullscreen.html` - Audience display (simpler)
- `/screen.html` - Audience display (more features)

## CSS Theming

Override via `externalCss` config or inline styles:
```css
--roi-theme-main-color: #2b2c3a;
--roi-theme-main-color2: #ffffff;
--roi-theme-video-bg: #9c9fbd;
--roi-theme-font: "sans-serif";
--roi-theme-font-color: #333;
--roi-theme-head-size: 42px;
--roi-vote-header-size: 16pt;
--roi-vote-font-size: 10pt;
```

## Security

- Row-level security (RLS) on all tables
- JWT tokens (6-day expiry) with `person_id`, `meeting_id`, `admin` claims
- Passwords hashed with bcrypt via pgcrypto
- Admin requires `person.admin = true`

## PostgreSQL Setup

Requires wal2json for live queries:
```
wal_level = logical
max_wal_senders = 10
max_replication_slots = 10
```

```bash
sudo apt install postgresql-12-wal2json
```

## Key Files

- `pkg/server/db.sql` - Database schema (source of truth)
- `pkg/server/server.js` - PostGraphile setup
- `pkg/web/src/db/state.js` - Redux state bundles
- `pkg/web/src/comp/queue.js` - Main participant UI
- `pkg/web/src/comp/manage.js` - Admin panel

## How to work here
- Only git add files you changed, never use `git add -A`.
- Don't add the 'Made with Claude' advert to the commits.
