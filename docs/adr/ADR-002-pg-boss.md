# ADR-002: pg-boss (PostgreSQL) als Queue statt BullMQ/Redis

**Status:** akzeptiert

**Kontext:** Single-Operator-System, Dutzende (nicht Tausende) Jobs/Tag. Transaktionale Nähe zu den Domänendaten wichtiger als Durchsatz.

**Entscheidung:** pg-boss 10 (Retry/Backoff, Dead-Letter-Queues, Cron, Singleton-Keys) im selben Postgres, Schema `pgboss`.

**Folgen:** Kein Redis. Rate-Limits/Kapazität liegen im CapacityManager (Domäne), nicht in der Queue.
