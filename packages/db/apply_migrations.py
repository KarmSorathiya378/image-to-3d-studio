"""
Database migration runner for AI Image-to-3D Studio.
Can run migrations cleanly against any PostgreSQL instance.
"""
import os
import sys
from pathlib import Path

def get_migration_sql() -> str:
    migration_file = Path(__file__).parent / "migrations" / "0000_initial_schema.sql"
    with open(migration_file, "r", encoding="utf-8") as f:
        return f.read()

def run_migrations(connection_string: str = None) -> bool:
    connection_string = connection_string or os.environ.get(
        "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/image_to_3d"
    )
    print(f"[DB Migration] Target URL: {connection_string.split('@')[-1] if '@' in connection_string else 'configured'}")
    sql = get_migration_sql()

    try:
        import psycopg
        print("[DB Migration] Using psycopg driver")
        with psycopg.connect(connection_string) as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
        print("[DB Migration] Successfully applied 0000_initial_schema.sql")
        return True
    except ImportError:
        pass

    try:
        import psycopg2
        print("[DB Migration] Using psycopg2 driver")
        conn = psycopg2.connect(connection_string)
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        conn.close()
        print("[DB Migration] Successfully applied 0000_initial_schema.sql")
        return True
    except ImportError:
        pass

    print("[DB Migration] Warning: No PostgreSQL driver (psycopg/psycopg2) installed in current environment.")
    print("[DB Migration] SQL migration file verified and ready at packages/db/migrations/0000_initial_schema.sql")
    return False

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else None
    run_migrations(url)
