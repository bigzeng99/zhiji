-- Add source_id to points table for clone tracking
ALTER TABLE points ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES points(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_points_source_id ON points(source_id);
