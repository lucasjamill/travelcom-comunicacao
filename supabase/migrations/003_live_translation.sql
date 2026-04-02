-- Live translation call support
ALTER TABLE calls ADD COLUMN call_mode TEXT DEFAULT 'live_translation';
ALTER TABLE calls ADD COLUMN recording_url_original TEXT;
ALTER TABLE calls ADD COLUMN recording_url_translated TEXT;
ALTER TABLE calls ADD COLUMN operator_language TEXT DEFAULT 'pt';
