CREATE TABLE IF NOT EXISTS events (
   site_id String NOT NULL,
   occured_at UInt32 NOT NULL,
   type String NOT NULL,
   user_id String NOT NULL,
   event String NOT NULL,
   category String NOT NULL,
   referrer String NOT NULL,
   is_touch BOOLEAN NOT NULL,
   browser_name String NOT NULL,
   os_name String NOT NULL,
   device_type String NOT NULL,
   country String NOT NULL,
   region String NOT NULL,
   timestamp DateTime DEFAULT now()
)
ENGINE MergeTree
ORDER BY (site_id, occured_at);
