-- Fix sessions table varchar constraints
-- Run this in your PostgreSQL database to increase field sizes

-- Increase tire field lengths to accommodate longer tire descriptions
ALTER TABLE sessions ALTER COLUMN front_tire TYPE VARCHAR(150);
ALTER TABLE sessions ALTER COLUMN rear_tire TYPE VARCHAR(150);

-- Increase weather condition field length
ALTER TABLE sessions ALTER COLUMN weather_condition TYPE VARCHAR(150);

-- Increase weather description field length (if it exists and is too short)
ALTER TABLE sessions ALTER COLUMN weather_description TYPE VARCHAR(1000);

-- Increase other potentially problematic fields
ALTER TABLE sessions ALTER COLUMN session_type TYPE VARCHAR(100);

-- Optional: Show current column constraints to verify
-- SELECT column_name, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'sessions' AND character_maximum_length IS NOT NULL
-- ORDER BY column_name;