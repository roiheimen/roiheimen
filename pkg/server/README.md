PostGraphile server
===================
This is our GraphQL API.

Setup
-----

    yarn

You need to add this to your postgresql.conf file for live queries:

    wal_level = logical
    max_wal_senders = 10
    max_replication_slots = 10

Then you need the wal2json plugin for postgresql.

    sudo apt install postgresql-12-wal2json
    # Or check https://www.npmjs.com/package/@graphile/subscriptions-lds for other OSes

Now you may try filling in the db and staring.

    yarn setup
    yarn start


Handy updates
-------------

Copy standard vote disallows from a recent sak:

    UPDATE roiheimen.meeting m
    SET config = m.config || jsonb_build_object('voteDisallowNum', (s.config->>'voteDisallowNum')::jsonb)
    FROM roiheimen.sak s
    WHERE m.id = s.meeting_id AND s.id = 17;

Copy standard vote disallows sak to sak:

    UPDATE roiheimen.sak s
    SET config = s.config || jsonb_build_object('voteDisallowNum', (s.config->>'voteDisallowNum')::jsonb)
    FROM roiheimen.sak s2
    WHERE s.id = 132 AND s2.id = 129;
