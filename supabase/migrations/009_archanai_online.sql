INSERT INTO services (
    name, 
    category, 
    session_type,
    price_rupees, 
    slot_capacity, 
    advance_days, 
    max_persons,
    post_booking_info,
    sessions,
    available_days
) VALUES (
    'Archanai (Online)', 
    'pooja', 
    'all_day',
    101, 
    100, 
    1, 
    1,
    'By booking this Archanai, you will not be coming to the temple in person, but the temple management will do the Archanai in your name and then will notify you after it has been done.',
    '["All Day"]'::jsonb,
    '[0, 1, 2, 3, 4, 5, 6]'::jsonb
);
