-- Make localizador optional (not always available)
ALTER TABLE reservations ALTER COLUMN localizador DROP NOT NULL;

-- Reservation input fields for doublecheck
ALTER TABLE reservations ADD COLUMN board_type TEXT DEFAULT 'breakfast';
ALTER TABLE reservations ADD COLUMN bed_type TEXT;
ALTER TABLE reservations ADD COLUMN estimated_arrival TEXT;

-- Call result fields (captured by AI during the call)
ALTER TABLE calls ADD COLUMN contact_name TEXT;
ALTER TABLE calls ADD COLUMN contact_department TEXT;
ALTER TABLE calls ADD COLUMN hotel_notes TEXT;
