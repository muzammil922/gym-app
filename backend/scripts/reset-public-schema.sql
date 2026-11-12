-- Fresh empty DB only (no production data). Used when init migration failed mid-flight.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
