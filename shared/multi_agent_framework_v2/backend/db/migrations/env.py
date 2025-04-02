import os
import sys
from alembic import context
from sqlalchemy import engine_from_config, pool
from logging.config import fileConfig

# Interpret the config file for Python logging.
config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# Make sure the project folder is in sys.path for importing modules
sys.path.append(os.path.abspath(os.getcwd()))

# Import the metadata object from models
from backend.db import models
target_metadata = models.Base.metadata

def run_migrations_offline():
    context.configure(url=config.get_main_option('sqlalchemy.url'), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(config.get_section(config.config_ini_section), prefix='sqlalchemy.', poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
