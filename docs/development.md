# Development Notes

Setup instructions are in the package READMEs. This covers troubleshooting and tips.

## Common Issues

### "Permission denied" on database
```bash
DATABASE_URL=postgres:/// yarn start
```

### "wal2json not found"
Install the PostgreSQL wal2json plugin and restart PostgreSQL.

### GraphQL subscriptions not working
Check PostgreSQL config:
```sql
SHOW wal_level;  -- Should be "logical"
```

### Port already in use
```bash
lsof -i :5000
kill -9 <PID>
```

## Debugging

### Server logs
```bash
DEBUG=postgraphile:* yarn start
```

### GraphQL playground
Open https://localhost:5000/graphiql

### Database
```bash
psql roiheimen

# Check active logins
SELECT p.num, p.name, l.login_at
FROM roiheimen_private.person_login l
JOIN roiheimen.person p ON p.id = l.person_id
WHERE l.logout_at IS NULL;

# Check replication
SELECT * FROM pg_replication_slots;
```

### Frontend
- Redux DevTools browser extension works
- Network tab shows GraphQL requests/subscriptions

## Testing

Default credentials for `meet20`:
- Admin: num=1000, password=test
- Participant: num=10, password=test

Manual testing flow:
1. Log in as admin (1000)
2. Create a sak
3. Open another browser, log in as participant (10)
4. Add speeches and vote on referendums
