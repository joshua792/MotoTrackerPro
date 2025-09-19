-- Fix remaining varchar constraints that weren't updated
-- Run this to complete the schema updates

-- Fix the VARCHAR(50) fields that should be VARCHAR(100)
ALTER TABLE sessions ALTER COLUMN swingarm_angle TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN swingarm_length TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN trail TYPE VARCHAR(100);

-- Fix the VARCHAR(10) weather fields that should be VARCHAR(100)
ALTER TABLE sessions ALTER COLUMN weather_humidity TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN weather_temperature TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN weather_wind_speed TYPE VARCHAR(100);

-- Verify the changes
SELECT column_name, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'sessions' AND character_maximum_length IS NOT NULL
ORDER BY column_name;