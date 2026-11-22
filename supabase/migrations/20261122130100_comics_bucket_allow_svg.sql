-- Mock mode (NEXT_PUBLIC_AI_MODE=mock) draws SVG placeholder panels.
update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] where id = 'comics';
