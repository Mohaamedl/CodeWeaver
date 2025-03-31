"""initial migration"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250326_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'review_sessions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('repo_path', sa.Text()),
        sa.Column('summary', sa.Text(), nullable=True)
    )
    op.create_table(
        'suggestions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('review_sessions.id'), nullable=False),
        sa.Column('agent', sa.String(length=50)),
        sa.Column('message', sa.Text()),
        sa.Column('patch', sa.Text(), nullable=True),
        sa.Column('file_path', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='pending')
    )

def downgrade():
    op.drop_table('suggestions')
    op.drop_table('review_sessions')
