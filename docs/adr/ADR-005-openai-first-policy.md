# ADR-005: OpenAI-first-Provider-Policy mit Freigabeliste

**Status:** akzeptiert

**Entscheidung:** `ENABLED_PROVIDERS` (Default `openai,local,mock`) ist die einzige Stelle, an der ein KI-Anbieter freigegeben wird. Registry wirft `ProviderDisabledError` für alles andere. Kein automatischer Fallback bei Limits (→ WAITING_FOR_CAPACITY). Anthropic-Adapter ist bewusst *nicht* implementiert (nur Routing-Alternative dokumentiert), um keine ungewollte Nutzung zu ermöglichen.
