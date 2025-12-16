# Database Schema

The schema lives in [pkg/server/db.sql](../pkg/server/db.sql) - that's the source of truth.

## Entity Relationship

```
┌─────────────────┐
│     meeting     │
│─────────────────│
│ id (PK)         │◄──────────────────────────────────┐
│ title           │                                    │
│ theme (jsonb)   │                                    │
│ config (jsonb)  │                                    │
└─────────────────┘                                    │
        │                                              │
        │ 1:N                                          │
        ▼                                              │
┌─────────────────┐         ┌─────────────────┐        │
│       sak       │         │     person      │        │
│─────────────────│         │─────────────────│        │
│ id (PK)         │◄───┐    │ id (PK)         │◄──┐    │
│ title           │    │    │ num             │   │    │
│ config (jsonb)  │    │    │ name            │   │    │
│ meeting_id (FK) │────┘    │ admin           │   │    │
│ finished_at     │         │ meeting_id (FK) │───┼────┘
└─────────────────┘         └─────────────────┘   │
        │                           │             │
        │ 1:N                       │             │
        ▼                           │             │
┌─────────────────┐                 │             │
│   referendum    │                 │             │
│─────────────────│                 │             │
│ id (PK)         │◄──┐             │             │
│ title           │   │             │             │
│ type            │   │    (person_account and   │
│ choices (jsonb) │   │     person_login in      │
│ sak_id (FK)     │───┤     roiheimen_private)   │
│ started_at      │   │                          │
│ finished_at     │   │                          │
└─────────────────┘   │                          │
        │             │                          │
        │ 1:N         │                          │
        ▼             │                          │
┌─────────────────┐   │                          │
│      vote       │   │                          │
│─────────────────│   │                          │
│ referendum_id   │───┘                          │
│ person_id (FK)  │──────────────────────────────┤
│ vote            │                              │
└─────────────────┘                              │
                                                 │
┌─────────────────┐                              │
│     speech      │                              │
│─────────────────│                              │
│ id (PK)         │◄──┐                          │
│ speaker_id (FK) │───┼──────────────────────────┘
│ sak_id (FK)     │───┤
│ parent_id (FK)  │───┘ (self-ref for replies)
│ type            │
│ started_at      │
│ ended_at        │
└─────────────────┘
```

## Enums

### speech_type
- `innleiing` - Introduction (by organizers)
- `innlegg` - Main speech
- `replikk` - Reply to a speech (links via parent_id)
- `saksopplysing` - Point of information

### referendum_type
- `open` - Votes visible to all
- `closed` - Secret ballot

## Schemas

- `roiheimen` - Public API tables
- `roiheimen_private` - Credentials (person_account) and audit (person_login)

## Roles

- `roiheimen_postgraphile` - API connection user
- `roiheimen_anonymous` - Unauthenticated requests
- `roiheimen_person` - Authenticated participants

Row-level security (RLS) is enabled on all tables - see db.sql for policies.

## Key Functions

- `authenticate(num, meeting_id, password)` - Returns JWT token
- `register_person(...)` / `register_people(...)` - Create participants
- `current_person()` - Get authenticated user from JWT
- `latest_sak(meeting_id)` - Most recent open agenda item
- `current_speech(meeting_id)` - Currently active speech
- `vote_count(sak_id)` - Tally votes per referendum
