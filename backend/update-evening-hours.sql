-- Run after schema.sql if the tables have already been imported.
-- Existing appointments remain unchanged; review them before changing hours.
UPDATE weekly_hours h JOIN doctors d ON d.id = h.doctor_id
SET h.start_minute = 1080, h.end_minute = 1320
WHERE d.slug IN ('chetan', 'mounika');
ALTER TABLE weekly_hours ALTER COLUMN start_minute SET DEFAULT 1080;
ALTER TABLE weekly_hours ALTER COLUMN end_minute SET DEFAULT 1320;
