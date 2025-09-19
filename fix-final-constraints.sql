-- Fix the final two VARCHAR(10) fields that didn't get updated
ALTER TABLE sessions ALTER COLUMN weather_temperature TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN weather_wind_speed TYPE VARCHAR(100);

-- Verify all fields are now correct
SELECT column_name, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'sessions' AND character_maximum_length IS NOT NULL
AND character_maximum_length < 100
ORDER BY column_name;