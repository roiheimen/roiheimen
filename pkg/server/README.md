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
