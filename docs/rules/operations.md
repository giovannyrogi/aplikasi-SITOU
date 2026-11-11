# Observability dan operasional

## Observability dan operasional

- Gunakan structured logging dengan `request_id`, `organization_id`, `actor_user_id`, dan nama use case; jangan log payload sensitif.

- Ukur latency API p50/p95/p99, error rate, queue lag, koneksi DB, slow query, import duration, dan recalculation duration.

- Alert untuk partisi bulan depan belum ada, default partition bertambah, outbox macet, storage gagal, atau backup gagal.

- Health check tidak menjalankan query berat.
