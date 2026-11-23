from pathlib import Path
from packages.db.apply_migrations import get_migration_sql

def test_migration_sql_contains_all_14_entities():
    sql = get_migration_sql()
    assert sql is not None
    assert len(sql) > 500

    required_tables = [
        "users",
        "sessions",
        "projects",
        "uploaded_assets",
        "ai_providers",
        "user_credentials",
        "model_configurations",
        "generation_jobs",
        "generation_attempts",
        "scene_specifications",
        "generated_assets",
        "model_versions",
        "export_records",
        "audit_events",
    ]

    for table in required_tables:
        assert f"CREATE TABLE IF NOT EXISTS {table}" in sql, f"Missing CREATE TABLE for {table}"

    required_enums = [
        "credential_status",
        "model_stage",
        "generation_mode",
        "generation_status",
        "attempt_status",
        "asset_format",
        "validation_state",
    ]

    for enum in required_enums:
        assert enum in sql, f"Missing enum {enum}"

    # Verify foreign key cascade checks and ownership
    assert "ON DELETE CASCADE" in sql
    assert "idx_projects_user_id" in sql
    assert "idx_generation_jobs_user_id" in sql
    assert "uniq_generation_jobs_user_idempotency" in sql
