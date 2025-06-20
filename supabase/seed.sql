-- ============================================================
-- TP-Manager Seed Data
-- Fine food & gastronomy platform — test data
-- ============================================================

-- ============================================================
-- ADMIN & DRIVER ACCOUNTS
-- Password: Tktmongars@69 (bcrypt hash, cost 12)
-- ============================================================

INSERT INTO profiles (id, username, password_hash, role, is_active, is_trusted) VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'joeadmin',
    '$2b$12$I7Pf/xRJTuYL9WjJj7Eh6.5THzVoYq6yyXTnEvKlhU9BzqRk0MTOq',
    'admin',
    true,
    true
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'pacoadmin',
    '$2b$12$cFnXLDHcx9ZidvyFrYb3ZeoN2FbaOQrKQRuilTUT2A3gdFdv75i3G',
    'admin',
    true,
    true
  ),
  (
    'd1000000-0000-0000-0000-000000000001',
    'joedriver',
    '$2b$12$gi75MLOyeKchkvVrvYEAj.eE0CKS.kzdOm22boCCmokMoXDxfCyCC',
    'driver',
    true,
    true
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'pacodriver',
    '$2b$12$TwAEOgaG0addX8MfNW93NOOyujhP.wtkU.7Ts38F.GR8dU9p1Hlvy',
    'driver',
    true,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ITEMS — Wines & Champagnes (classic)
-- ============================================================

INSERT INTO items (name, type, variety, quantity, unit_measure, price, category_id, is_featured, badges) VALUES
  (
    'Château Margaux 2018',
    'Wines & Champagnes',
    'Cabernet Sauvignon',
    48,
    'unit',
    320.00,
    (SELECT id FROM categories WHERE slug = 'wines'),
    true,
    ARRAY['PREMIUM']
  ),
  (
    'Domaine de la Romanée-Conti 2019',
    'Wines & Champagnes',
    'Pinot Noir',
    12,
    'unit',
    890.00,
    (SELECT id FROM categories WHERE slug = 'wines'),
    true,
    ARRAY['PREMIUM', 'LIMITED']
  ),
  (
    'Chablis Grand Cru Valmur 2021',
    'Wines & Champagnes',
    'Chardonnay',
    36,
    'unit',
    85.00,
    (SELECT id FROM categories WHERE slug = 'wines'),
    false,
    ARRAY[]::text[]
  ),
  (
    'Champagne Krug Grande Cuvée',
    'Wines & Champagnes',
    'Blend Blanc',
    24,
    'unit',
    195.00,
    (SELECT id FROM categories WHERE slug = 'wines'),
    true,
    ARRAY['BESTSELLER']
  ),
  (
    'Dom Pérignon Vintage 2015',
    'Wines & Champagnes',
    'Chardonnay / Pinot Noir',
    18,
    'unit',
    240.00,
    (SELECT id FROM categories WHERE slug = 'wines'),
    false,
    ARRAY['PREMIUM']
  ),
  (
    'Sancerre Rouge Les Monts Damnés',
    'Wines & Champagnes',
    'Pinot Noir',
    30,
    'unit',
    42.00,
    (SELECT id FROM categories WHERE slug = 'wines'),
    false,
    ARRAY[]::text[]
  );

-- ============================================================
-- ITEMS — Spirits (classic)
-- ============================================================

INSERT INTO items (name, type, variety, quantity, unit_measure, price, category_id, is_featured, badges) VALUES
  (
    'Macallan 18 ans Sherry Oak',
    'Spirits',
    'Single Malt Scotch',
    20,
    'unit',
    380.00,
    (SELECT id FROM categories WHERE slug = 'spirits'),
    true,
    ARRAY['PREMIUM', 'BESTSELLER']
  ),
  (
    'Rémy Martin Louis XIII',
    'Spirits',
    'Cognac Grande Champagne',
    6,
    'unit',
    3200.00,
    (SELECT id FROM categories WHERE slug = 'spirits'),
    true,
    ARRAY['PREMIUM', 'LIMITED']
  ),
  (
    'Hennessy XO',
    'Spirits',
    'Cognac',
    15,
    'unit',
    210.00,
    (SELECT id FROM categories WHERE slug = 'spirits'),
    false,
    ARRAY['BESTSELLER']
  ),
  (
    'Diplomatico Reserva Exclusiva',
    'Spirits',
    'Dark Rum',
    25,
    'unit',
    58.00,
    (SELECT id FROM categories WHERE slug = 'spirits'),
    false,
    ARRAY[]::text[]
  ),
  (
    'Grey Goose Vodka',
    'Spirits',
    'Premium Vodka',
    30,
    'unit',
    45.00,
    (SELECT id FROM categories WHERE slug = 'spirits'),
    false,
    ARRAY[]::text[]
  ),
  (
    'Patrón Silver Tequila',
    'Spirits',
    '100% Blue Agave',
    22,
    'unit',
    65.00,
    (SELECT id FROM categories WHERE slug = 'spirits'),
    false,
    ARRAY['PROMO']
  );

-- ============================================================
-- ITEMS — Fine Grocery (classic)
-- ============================================================

INSERT INTO items (name, type, variety, quantity, unit_measure, price, category_id, is_featured, badges) VALUES
  (
    'Comté AOP 24 mois',
    'Fine Grocery',
    'Fromage affiné',
    2000,
    'g',
    6.80,
    (SELECT id FROM categories WHERE slug = 'fine-grocery'),
    false,
    ARRAY[]::text[]
  ),
  (
    'Jambon Ibérique Bellota 36 mois',
    'Fine Grocery',
    'Pata Negra',
    800,
    'g',
    18.50,
    (SELECT id FROM categories WHERE slug = 'fine-grocery'),
    true,
    ARRAY['PREMIUM']
  ),
  (
    'Saumon Fumé Atlantique Sauvage',
    'Fine Grocery',
    'Salmo salar',
    500,
    'g',
    12.00,
    (SELECT id FROM categories WHERE slug = 'fine-grocery'),
    false,
    ARRAY['BESTSELLER']
  ),
  (
    'Foie Gras Entier mi-cuit du Périgord',
    'Fine Grocery',
    'Canard mulard',
    400,
    'g',
    28.00,
    (SELECT id FROM categories WHERE slug = 'fine-grocery'),
    true,
    ARRAY['PREMIUM']
  ),
  (
    'Miel de Manuka UMF 20+',
    'Fine Grocery',
    'Monofloral',
    1000,
    'g',
    22.00,
    (SELECT id FROM categories WHERE slug = 'fine-grocery'),
    false,
    ARRAY[]::text[]
  ),
  (
    'Huile d''Olive Extra Vierge Sicilienne',
    'Fine Grocery',
    'Nocellara del Belice',
    1200,
    'g',
    24.00,
    (SELECT id FROM categories WHERE slug = 'fine-grocery'),
    false,
    ARRAY[]::text[]
  );

-- ============================================================
-- ITEMS — Truffles & Foie Gras (premium)
-- ============================================================

INSERT INTO items (name, type, variety, quantity, unit_measure, price, category_id, is_featured, badges) VALUES
  (
    'Truffe Noire du Périgord Fraîche',
    'Truffles & Foie Gras',
    'Tuber melanosporum',
    300,
    'g',
    145.00,
    (SELECT id FROM categories WHERE slug = 'truffles'),
    true,
    ARRAY['PREMIUM', 'SEASONAL']
  ),
  (
    'Truffe Blanche d''Alba',
    'Truffles & Foie Gras',
    'Tuber magnatum',
    150,
    'g',
    420.00,
    (SELECT id FROM categories WHERE slug = 'truffles'),
    true,
    ARRAY['PREMIUM', 'LIMITED', 'SEASONAL']
  ),
  (
    'Truffe d''Été',
    'Truffles & Foie Gras',
    'Tuber aestivum',
    500,
    'g',
    42.00,
    (SELECT id FROM categories WHERE slug = 'truffles'),
    false,
    ARRAY[]::text[]
  ),
  (
    'Foie Gras d''Oie Entier Rougié',
    'Truffles & Foie Gras',
    'Oie landaise',
    600,
    'g',
    65.00,
    (SELECT id FROM categories WHERE slug = 'truffles'),
    false,
    ARRAY['PREMIUM']
  ),
  (
    'Bloc de Foie Gras Canard Truffé 30%',
    'Truffles & Foie Gras',
    'Canard + Tuber melanosporum',
    400,
    'g',
    48.00,
    (SELECT id FROM categories WHERE slug = 'truffles'),
    false,
    ARRAY['PREMIUM']
  );

-- ============================================================
-- ITEMS — Caviar & Seafood (premium)
-- ============================================================

INSERT INTO items (name, type, variety, quantity, unit_measure, price, category_id, is_featured, badges) VALUES
  (
    'Caviar Beluga Huso Huso',
    'Caviar & Seafood',
    'Beluga',
    100,
    'g',
    380.00,
    (SELECT id FROM categories WHERE slug = 'caviar'),
    true,
    ARRAY['PREMIUM', 'LIMITED']
  ),
  (
    'Caviar Osciètre Royal Gold',
    'Caviar & Seafood',
    'Osciètre',
    200,
    'g',
    195.00,
    (SELECT id FROM categories WHERE slug = 'caviar'),
    true,
    ARRAY['PREMIUM', 'BESTSELLER']
  ),
  (
    'Caviar Sevruga',
    'Caviar & Seafood',
    'Sevruga',
    150,
    'g',
    140.00,
    (SELECT id FROM categories WHERE slug = 'caviar'),
    false,
    ARRAY['PREMIUM']
  ),
  (
    'Homard Bleu Breton Vivant',
    'Caviar & Seafood',
    'Homarus gammarus',
    8,
    'unit',
    85.00,
    (SELECT id FROM categories WHERE slug = 'caviar'),
    false,
    ARRAY['SEASONAL']
  ),
  (
    'Langoustines Royales de Guilvinec',
    'Caviar & Seafood',
    'Nephrops norvegicus',
    12,
    'unit',
    45.00,
    (SELECT id FROM categories WHERE slug = 'caviar'),
    false,
    ARRAY[]::text[]
  ),
  (
    'Oursin de Bretagne Frais (douzaine)',
    'Caviar & Seafood',
    'Echinus esculentus',
    5,
    'unit',
    38.00,
    (SELECT id FROM categories WHERE slug = 'caviar'),
    false,
    ARRAY['SEASONAL']
  );

-- ============================================================
-- ITEMS — Gift Sets (premium)
-- ============================================================

INSERT INTO items (name, type, variety, quantity, unit_measure, price, category_id, is_featured, badges) VALUES
  (
    'Coffret Découverte Épicurienne',
    'Gift Sets',
    'Classic Selection',
    15,
    'unit',
    120.00,
    (SELECT id FROM categories WHERE slug = 'gift-sets'),
    false,
    ARRAY[]::text[]
  ),
  (
    'Coffret Prestige Champagne & Caviar',
    'Gift Sets',
    'Premium Collection',
    8,
    'unit',
    480.00,
    (SELECT id FROM categories WHERE slug = 'gift-sets'),
    true,
    ARRAY['PREMIUM', 'BESTSELLER']
  ),
  (
    'Coffret Grand Cru — 3 Vins d''Exception',
    'Gift Sets',
    'Grands Crus Classés',
    6,
    'unit',
    620.00,
    (SELECT id FROM categories WHERE slug = 'gift-sets'),
    true,
    ARRAY['PREMIUM', 'LIMITED']
  ),
  (
    'Coffret Truffes & Spiritueux',
    'Gift Sets',
    'Terroir & Terroir',
    10,
    'unit',
    350.00,
    (SELECT id FROM categories WHERE slug = 'gift-sets'),
    false,
    ARRAY['PREMIUM']
  ),
  (
    'Coffret Fromages & Charcuteries',
    'Gift Sets',
    'Terroir Français',
    20,
    'unit',
    95.00,
    (SELECT id FROM categories WHERE slug = 'gift-sets'),
    false,
    ARRAY['BESTSELLER']
  );
