# PostGraphile Server

GraphQL API using [PostGraphile](https://www.graphile.org/postgraphile/) which generates a GraphQL API from the PostgreSQL database. Also runs Graphile Worker for background jobs.

## Setup

You need to add this to your `postgresql.conf` for live queries:

```
wal_level = logical
max_wal_senders = 10
max_replication_slots = 10
```

Then install the wal2json plugin:

```bash
sudo apt install postgresql-12-wal2json
# Or check https://www.npmjs.com/package/@graphile/subscriptions-lds for other OSes
```

Now set up and start:

```bash
yarn
yarn setup
yarn start
```

## Handy SQL

Copy vote disallows from a recent sak to the meeting:

```sql
UPDATE roiheimen.meeting m
SET config = m.config || jsonb_build_object('voteDisallowNum', (s.config->>'voteDisallowNum')::jsonb)
FROM roiheimen.sak s
WHERE m.id = s.meeting_id AND s.id = 17;
```

Copy vote disallows sak to sak:

```sql
UPDATE roiheimen.sak s
SET config = s.config || jsonb_build_object('voteDisallowNum', (s2.config->>'voteDisallowNum')::jsonb)
FROM roiheimen.sak s2
WHERE s.id = 132 AND s2.id = 129;
```

Find replikker (replies) per person:

```sql
SELECT person_id, num, name,
   speeches_innlegg,
   speeches_replikk,
   speeches
FROM (
    SELECT
      id AS person_id,
      num,
      name,
      (SELECT COUNT(*) FROM roiheimen.speech s WHERE s.speaker_id = p.id AND type = 'innlegg') AS speeches_innlegg,
      (SELECT COUNT(*) FROM roiheimen.speech s JOIN speech s2 ON s.parent_id = s2.id WHERE s.speaker_id = p.id AND s.speaker_id != s2.speaker_id AND s.type = 'replikk' AND (s.ended_at - s.started_at) > '00:05.0') AS speeches_replikk,
      (SELECT COUNT(*) FROM roiheimen.speech s WHERE s.speaker_id = p.id) AS speeches,
      (SELECT COUNT(*) FROM roiheimen.vote v WHERE v.person_id = p.id) AS votes
    FROM roiheimen.person p
    WHERE meeting_id = 'mdglm'
) AS subquery
WHERE speeches_replikk > 0
ORDER BY speeches_replikk, num DESC;
```
