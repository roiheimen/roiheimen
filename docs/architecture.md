# Architecture

## System Overview

```
┌──────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Participant │    │    Admin     │    │   GFX Overlay   │
│  (queue.html)│    │(manage.html) │    │   (gfx.html)    │
└──────┬───────┘    └──────┬───────┘    └────────┬────────┘
       │                   │                      │
       └───────────┬───────┴──────────────────────┘
                   │ GraphQL + WebSocket
                   ▼
         ┌─────────────────────┐
         │   PostGraphile      │
         │   (Express.js)      │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │   PostgreSQL        │
         │   + wal2json        │
         └─────────────────────┘
```

## Real-time Updates

Live updates work via PostgreSQL logical replication (wal2json). When data changes, PostGraphile pushes updates over WebSocket to subscribed clients. No polling needed.

## Data Flows

### Authentication
1. User enters participant number + password
2. `roiheimen.authenticate()` validates and returns JWT
3. JWT stored in cookie, contains `person_id`, `meeting_id`, `admin`
4. RLS policies use JWT claims to control access

### Speaker Queue
1. Participant clicks "Innlegg" or "Replikk"
2. Creates `speech` record (via GraphQL mutation)
3. Admin sees it in queue (via subscription)
4. Admin starts speech → sets `started_at`
5. Admin ends speech → sets `ended_at`
6. GFX overlay shows speaker name while active

### Voting
1. Admin creates referendum with choices
2. Admin starts it → sets `started_at`
3. Participants see it and vote (creates `vote` record)
4. RLS policy checks `voteDisallowNum` in config
5. Admin ends it → sets `finished_at`
6. Results displayed

## Meeting Hierarchy

```
Meeting
├── Config (voting rules, video, CSS)
├── Theme (colors, fonts)
├── Persons (participants + admins)
└── Saks (agenda items)
    ├── Speeches (speaker queue)
    │   └── Replikker (replies, via parent_id)
    └── Referendums (votes)
        └── Votes (individual votes)
```

## Frontend Architecture

Components use Heresy (Web Components with React-like hooks). State managed by Redux Bundler.

Main pattern:
```
HTML entry → roi-* component → useSel() for state → GraphQL for data
```

## Interfaces

| URL | Purpose |
|-----|---------|
| `/queue.html` | Participant: vote, join speaker queue |
| `/manage.html` | Admin: control meeting |
| `/gfx.html` | OBS overlay for livestream |
| `/fullscreen.html` | Audience display (basic) |
| `/screen.html` | Audience display (enhanced) |
| `/backroom.html` | Tech support (Whereby) |
