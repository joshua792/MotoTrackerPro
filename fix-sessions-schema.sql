-- Fix sessions table varchar constraints
-- Run this in your PostgreSQL database to increase field sizes

-- Increase tire field lengths to accommodate longer tire descriptions
ALTER TABLE sessions ALTER COLUMN front_tire TYPE VARCHAR(150);
ALTER TABLE sessions ALTER COLUMN rear_tire TYPE VARCHAR(150);

-- Increase weather condition field length
ALTER TABLE sessions ALTER COLUMN weather_condition TYPE VARCHAR(150);

-- Increase weather description field length (if it exists and is too short)
ALTER TABLE sessions ALTER COLUMN weather_description TYPE VARCHAR(1000);

-- Increase other potentially problematic fields that might be VARCHAR(100)
ALTER TABLE sessions ALTER COLUMN session_type TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN conditions TYPE VARCHAR(150);
ALTER TABLE sessions ALTER COLUMN event_id TYPE VARCHAR(150);

-- Increase all VARCHAR(50) fields that might receive longer data
ALTER TABLE sessions ALTER COLUMN front_compression TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN front_preload TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN front_pressure TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN front_rebound TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN front_ride_height TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN front_sag TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN front_spring TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN front_sprocket TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN rake TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN rear_compression TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN rear_preload TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN rear_pressure TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN rear_rebound TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN rear_ride_height TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN rear_sag TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN rear_spring TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN rear_sprocket TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN swingarm_angle TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN swingarm_length TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN trail TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN weather_humidity TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN weather_temperature TYPE VARCHAR(100);
ALTER TABLE sessions ALTER COLUMN weather_wind_speed TYPE VARCHAR(100);

-- Optional: Show current column constraints to verify
-- SELECT column_name, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'sessions' AND character_maximum_length IS NOT NULL
-- ORDER BY column_name;