## how to run:
## npm install
## npm run dev

## Production database sizing

The application uses PostgreSQL through `POSTGRES_URL` or `DATABASE_URL`.
For production workloads above 500 users, use a managed PostgreSQL plan with
at least **5 GB storage and 600 MB RAM**. The application does not provision
that capacity; select it in the database provider dashboard.

The default pool is bounded at 10 connections for a long-lived Railway-style
server. Set `PG_POOL_MAX=1` for serverless deployments and tune
`PG_IDLE_TIMEOUT_MS` and `PG_CONNECTION_TIMEOUT_MS` through environment
variables. Schema bootstrap creates indexes for account lookup, registrations,
attendance filters, and check-in/check-out history. New push
