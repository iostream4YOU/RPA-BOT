from db import engine, metadata, audit_batches
from sqlalchemy import inspect

inspector = inspect(engine)
print("Tables in DB:", inspector.get_table_names())

if "audit_batches" in inspector.get_table_names():
    print("audit_batches table exists.")
else:
    print("audit_batches table MISSING. Attempting to create...")
    metadata.create_all(engine)
    print("Created tables.")
