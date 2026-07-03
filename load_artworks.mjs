/**
 * load_artworks.mjs
 * ------------------------------------------------------------
 * Loads a curated art-history collection from Wikimedia Commons
 * into Supabase (Storage bucket + `artworks` table).
 *
 * Usage:
 *   1. Run setup.sql in the Supabase SQL Editor (creates table + bucket)
 *   2. npm install @supabase/supabase-js
 *   3. Set environment variables:
 *        SUPABASE_URL=https://<project>.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=<service role key>   (NOT the anon key —
 *          this script writes to storage and the table; run it locally only,
 *          never ship this key to the browser/gallery)
 *   4. node load_artworks.mjs
 *
 * Requires Node 18+ (built-in fetch).
 * ------------------------------------------------------------
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------
// 1. THE COLLECTION — edit freely. `query` is what we search on
//    Commons; artist + title is usually enough to hit the right file.
// ---------------------------------------------------------------
const COLLECTION = [
  // --- Renaissance (Italian) ---
  { query: 'Leonardo da Vinci Mona Lisa Louvre',                        title: 'Mona Lisa',                        artist: 'Leonardo da Vinci',        year: 'c. 1503–1506', movement: 'Renaissance' },
  { query: 'Botticelli The Birth of Venus Uffizi',                      title: 'The Birth of Venus',               artist: 'Sandro Botticelli',        year: 'c. 1485',      movement: 'Renaissance' },
  { query: 'Raphael The School of Athens fresco',                       title: 'The School of Athens',             artist: 'Raphael',                  year: '1509–1511',    movement: 'Renaissance' },
  { query: 'Michelangelo Creation of Adam Sistine Chapel',              title: 'The Creation of Adam',             artist: 'Michelangelo',             year: 'c. 1512',      movement: 'Renaissance' },

  // --- Northern Renaissance ---
  { query: 'Jan van Eyck Arnolfini Portrait National Gallery',          title: 'The Arnolfini Portrait',           artist: 'Jan van Eyck',             year: '1434',         movement: 'Northern Renaissance' },
  { query: 'Pieter Bruegel the Elder Hunters in the Snow',              title: 'Hunters in the Snow',              artist: 'Pieter Bruegel the Elder', year: '1565',         movement: 'Northern Renaissance' },
  { query: 'Albrecht Durer self-portrait 1500 Munich',                  title: 'Self-Portrait at Twenty-Eight',    artist: 'Albrecht Dürer',           year: '1500',         movement: 'Northern Renaissance' },
  { query: 'Hieronymus Bosch Garden of Earthly Delights Prado',         title: 'The Garden of Earthly Delights',   artist: 'Hieronymus Bosch',         year: 'c. 1490–1510', movement: 'Northern Renaissance' },

  // --- Baroque ---
  { query: 'Caravaggio The Calling of Saint Matthew',                   title: 'The Calling of Saint Matthew',     artist: 'Caravaggio',               year: '1599–1600',    movement: 'Baroque' },
  { query: 'Artemisia Gentileschi Judith Slaying Holofernes Uffizi',    title: 'Judith Slaying Holofernes',        artist: 'Artemisia Gentileschi',    year: 'c. 1620',      movement: 'Baroque' },
  { query: 'Rembrandt The Night Watch Rijksmuseum',                     title: 'The Night Watch',                  artist: 'Rembrandt van Rijn',       year: '1642',         movement: 'Baroque' },
  { query: 'Johannes Vermeer Girl with a Pearl Earring',                title: 'Girl with a Pearl Earring',        artist: 'Johannes Vermeer',         year: 'c. 1665',      movement: 'Baroque' },
  { query: 'Diego Velazquez Las Meninas Prado',                         title: 'Las Meninas',                      artist: 'Diego Velázquez',          year: '1656',         movement: 'Baroque' },

  // --- Rococo ---
  { query: 'Jean-Honore Fragonard The Swing Wallace Collection',        title: 'The Swing',                        artist: 'Jean-Honoré Fragonard',    year: '1767',         movement: 'Rococo' },
  { query: 'Antoine Watteau Pilgrimage to Cythera Louvre',              title: 'Pilgrimage to Cythera',            artist: 'Antoine Watteau',          year: '1717',         movement: 'Rococo' },

  // --- Neoclassicism ---
  { query: 'Jacques-Louis David Oath of the Horatii Louvre',            title: 'Oath of the Horatii',              artist: 'Jacques-Louis David',      year: '1784',         movement: 'Neoclassicism' },
  { query: 'Jacques-Louis David The Death of Marat',                    title: 'The Death of Marat',               artist: 'Jacques-Louis David',      year: '1793',         movement: 'Neoclassicism' },
  { query: 'Ingres La Grande Odalisque Louvre',                         title: 'La Grande Odalisque',              artist: 'Jean-Auguste-Dominique Ingres', year: '1814',    movement: 'Neoclassicism' },

  // --- Romanticism ---
  { query: 'Francisco Goya The Third of May 1808 Prado',                title: 'The Third of May 1808',            artist: 'Francisco Goya',           year: '1814',         movement: 'Romanticism' },
  { query: 'Theodore Gericault The Raft of the Medusa Louvre',          title: 'The Raft of the Medusa',           artist: 'Théodore Géricault',       year: '1818–1819',    movement: 'Romanticism' },
  { query: 'Caspar David Friedrich Wanderer above the Sea of Fog',      title: 'Wanderer above the Sea of Fog',    artist: 'Caspar David Friedrich',   year: 'c. 1818',      movement: 'Romanticism' },
  { query: 'Eugene Delacroix Liberty Leading the People',               title: 'Liberty Leading the People',       artist: 'Eugène Delacroix',         year: '1830',         movement: 'Romanticism' },
  { query: 'J M W Turner The Fighting Temeraire',                       title: 'The Fighting Temeraire',           artist: 'J. M. W. Turner',          year: '1839',         movement: 'Romanticism' },
  { query: 'Hokusai The Great Wave off Kanagawa',                       title: 'The Great Wave off Kanagawa',      artist: 'Katsushika Hokusai',       year: 'c. 1831',      movement: 'Romanticism' },

  // --- Realism ---
  { query: 'Gustave Courbet The Stone Breakers',                        title: 'The Stone Breakers',               artist: 'Gustave Courbet',          year: '1849',         movement: 'Realism' },
  { query: 'Jean-Francois Millet The Gleaners Orsay',                   title: 'The Gleaners',                     artist: 'Jean-François Millet',     year: '1857',         movement: 'Realism' },
  { query: 'Edouard Manet Le Dejeuner sur l\'herbe Orsay',              title: 'Le Déjeuner sur l\'herbe',         artist: 'Édouard Manet',            year: '1863',         movement: 'Realism' },

  // --- Impressionism ---
  { query: 'Claude Monet Impression Sunrise',                           title: 'Impression, Sunrise',              artist: 'Claude Monet',             year: '1872',         movement: 'Impressionism' },
  { query: 'Pierre-Auguste Renoir Bal du moulin de la Galette',         title: 'Bal du moulin de la Galette',      artist: 'Pierre-Auguste Renoir',    year: '1876',         movement: 'Impressionism' },
  { query: 'Edgar Degas The Ballet Class Orsay',                        title: 'The Ballet Class',                 artist: 'Edgar Degas',              year: '1871–1874',    movement: 'Impressionism' },
  { query: 'Edouard Manet A Bar at the Folies-Bergere Courtauld',       title: 'A Bar at the Folies-Bergère',      artist: 'Édouard Manet',            year: '1882',         movement: 'Impressionism' },
  { query: 'Mary Cassatt The Child\'s Bath Art Institute',              title: 'The Child\'s Bath',                artist: 'Mary Cassatt',             year: '1893',         movement: 'Impressionism' },
  { query: 'Claude Monet Water Lilies and Japanese Bridge',             title: 'Water Lilies and Japanese Bridge', artist: 'Claude Monet',             year: '1899',         movement: 'Impressionism' },

  // --- Post-Impressionism ---
  { query: 'Vincent van Gogh The Starry Night MoMA',                    title: 'The Starry Night',                 artist: 'Vincent van Gogh',         year: '1889',         movement: 'Post-Impressionism' },
  { query: 'Vincent van Gogh Sunflowers National Gallery London',       title: 'Sunflowers',                       artist: 'Vincent van Gogh',         year: '1888',         movement: 'Post-Impressionism' },
  { query: 'Georges Seurat A Sunday Afternoon on the Island of La Grande Jatte', title: 'A Sunday on La Grande Jatte', artist: 'Georges Seurat',      year: '1884–1886',    movement: 'Post-Impressionism' },
  { query: 'Paul Cezanne Mont Sainte-Victoire painting',                title: 'Mont Sainte-Victoire',             artist: 'Paul Cézanne',             year: 'c. 1887',      movement: 'Post-Impressionism' },
  { query: 'Paul Gauguin Where Do We Come From What Are We',            title: 'Where Do We Come From? What Are We? Where Are We Going?', artist: 'Paul Gauguin', year: '1897–1898', movement: 'Post-Impressionism' },
  { query: 'Henri de Toulouse-Lautrec At the Moulin Rouge',             title: 'At the Moulin Rouge',              artist: 'Henri de Toulouse-Lautrec', year: '1892–1895',   movement: 'Post-Impressionism' },

  // --- Symbolism & Art Nouveau ---
  { query: 'Edvard Munch The Scream 1893 National Gallery Norway',      title: 'The Scream',                       artist: 'Edvard Munch',             year: '1893',         movement: 'Symbolism' },
  { query: 'Gustav Klimt The Kiss Belvedere',                           title: 'The Kiss',                         artist: 'Gustav Klimt',             year: '1907–1908',    movement: 'Symbolism' },
  { query: 'Henri Rousseau The Sleeping Gypsy MoMA',                    title: 'The Sleeping Gypsy',               artist: 'Henri Rousseau',           year: '1897',         movement: 'Symbolism' },

  // --- Early Modernism / Abstraction ---
  { query: 'Wassily Kandinsky Composition VII Tretyakov',               title: 'Composition VII',                  artist: 'Wassily Kandinsky',        year: '1913',         movement: 'Early Modernism' },
  { query: 'Piet Mondrian Composition with Red Blue and Yellow 1930',   title: 'Composition with Red, Blue and Yellow', artist: 'Piet Mondrian',       year: '1930',         movement: 'Early Modernism' },
  { query: 'Kazimir Malevich Black Square Tretyakov',                   title: 'Black Square',                     artist: 'Kazimir Malevich',         year: '1915',         movement: 'Early Modernism' },

  //from gemini 

  // --- Renaissance additions ---
  { query: 'Leonardo da Vinci The Last Supper Milan',                    title: 'The Last Supper',                  artist: 'Leonardo da Vinci',        year: '1495–1498',    movement: 'Renaissance' },
  { query: 'Botticelli Primavera Uffizi',                               title: 'Primavera',                        artist: 'Sandro Botticelli',        year: 'c. 1482',      movement: 'Renaissance' },
  { query: 'Michelangelo Last Judgment Sistine Chapel',                 title: 'The Last Judgment',                artist: 'Michelangelo',             year: '1536–1541',    movement: 'Renaissance' },

  // --- Northern Renaissance additions ---
  { query: 'Pieter Bruegel the Elder The Tower of Babel Vienna',        title: 'The Tower of Babel',               artist: 'Pieter Bruegel the Elder', year: '1563',         movement: 'Northern Renaissance' },
  { query: 'Hans Holbein the Younger The Ambassadors National Gallery', title: 'The Ambassadors',                artist: 'Hans Holbein the Younger', year: '1533',         movement: 'Northern Renaissance' },

  // --- Baroque additions ---
  { query: 'Rembrandt The Return of the Prodigal Son Hermitage',        title: 'The Return of the Prodigal Son',   artist: 'Rembrandt van Rijn',       year: 'c. 1661–1669', movement: 'Baroque' },
  { query: 'Peter Paul Rubens The Judgment of Paris Prado',             title: 'The Judgment of Paris',            artist: 'Peter Paul Rubens',        year: 'c. 1636',      movement: 'Baroque' },

  // --- Rococo additions ---
  { query: 'Francois Boucher The Toilet of Venus Met',                  title: 'The Toilet of Venus',              artist: 'François Boucher',         year: '1751',         movement: 'Rococo' },

  // --- Neoclassicism additions ---
  { query: 'Jacques-Louis David The Coronation of Napoleon Louvre',     title: 'The Coronation of Napoleon',       artist: 'Jacques-Louis David',      year: '1805–1807',    movement: 'Neoclassicism' },

  // --- Romanticism additions ---
  { query: 'Francisco Goya Saturn Devouring His Son Prado',              title: 'Saturn Devouring His Son',         artist: 'Francisco Goya',           year: '1819–1823',    movement: 'Romanticism' },
  { query: 'Caspar David Friedrich The Abbey in the Oakwood',           title: 'The Abbey in the Oakwood',         artist: 'Caspar David Friedrich',   year: '1809–1810',    movement: 'Romanticism' },

  // --- Realism additions ---
  { query: 'Gustave Courbet A Burial At Ornans Orsay',                  title: 'A Burial At Ornans',               artist: 'Gustave Courbet',          year: '1849–1850',    movement: 'Realism' },
  { query: 'Ilya Repin Barge Haulers on the Volga State Russian Museum',title: 'Barge Haulers on the Volga',       artist: 'Ilya Repin',               year: '1870–1873',    movement: 'Realism' },

  // --- Impressionism additions ---
  { query: 'Claude Monet Gare Saint-Lazare Orsay',                      title: 'The Gare Saint-Lazare',            artist: 'Claude Monet',             year: '1877',         movement: 'Impressionism' },
  { query: 'Pierre-Auguste Renoir Luncheon of the Boating Party',       title: 'Luncheon of the Boating Party',    artist: 'Pierre-Auguste Renoir',    year: '1881',         movement: 'Impressionism' },
  { query: 'Gustave Caillebotte Paris Street Rainy Day Art Institute',  title: 'Paris Street; Rainy Day',          artist: 'Gustave Caillebotte',      year: '1877',         movement: 'Impressionism' },

  // --- Post-Impressionism additions ---
  { query: 'Vincent van Gogh The Bedroom MoMA',                          title: 'The Bedroom',                      artist: 'Vincent van Gogh',         year: '1889',         movement: 'Post-Impressionism' },
  { query: 'Vincent van Gogh Cafe Terrace at Night Kröller-Müller',      title: 'Café Terrace at Night',            artist: 'Vincent van Gogh',         year: '1888',         movement: 'Post-Impressionism' },
  { query: 'Paul Cezanne The Card Players Orsay',                       title: 'The Card Players',                 artist: 'Paul Cézanne',             year: '1892–1895',    movement: 'Post-Impressionism' },

  // --- Symbolism additions ---
  { query: 'Arnold Bocklin Isle of the Dead Basel',                    title: 'Isle of the Dead',                 artist: 'Arnold Böcklin',           year: '1880',         movement: 'Symbolism' },

  // --- Early Modernism additions ---
  { query: 'Franz Marc The Large Blue Horses Walker',                   title: 'The Large Blue Horses',            artist: 'Franz Marc',               year: '1911',         movement: 'Early Modernism' },
  { query: 'Egon Schiele Self-Portrait with Physalis Leopold',          title: 'Self-Portrait with Physalis',      artist: 'Egon Schiele',             year: '1912',         movement: 'Early Modernism' },
  { query: 'Hilma af Klint The Ten Largest No 3 Youth',                 title: 'The Ten Largest, No. 3, Youth',    artist: 'Hilma af Klint',           year: '1907',         movement: 'Early Modernism' },
  { query: 'Ernst Ludwig Kirchner Street Berlin National Gallery',      title: 'Street, Berlin',                   artist: 'Ernst Ludwig Kirchner',    year: '1913',         movement: 'Early Modernism' },
  { query: 'Grant Wood American Gothic Art Institute',                  title: 'American Gothic',                  artist: 'Grant Wood',               year: '1930',         movement: 'Early Modernism' },

  // --- Renaissance additions (Part 2) ---
  { query: 'Giorgione The Tempest Venice',                              title: 'The Tempest',                      artist: 'Giorgione',                year: 'c. 1506–1508', movement: 'Renaissance' },
  { query: 'Titian Venus of Urbino Uffizi',                             title: 'Venus of Urbino',                  artist: 'Titian',                   year: '1534',         movement: 'Renaissance' },
  { query: 'Giovanni Bellini Feast of the Gods National Gallery',       title: 'The Feast of the Gods',            artist: 'Giovanni Bellini',         year: '1514',         movement: 'Renaissance' },

  // --- Northern Renaissance additions (Part 2) ---
  { query: 'Matthias Grunewald Isenheim Altarpiece Colmar',             title: 'Isenheim Altarpiece',              artist: 'Matthias Grünewald',       year: '1512–1516',    movement: 'Northern Renaissance' },
  { query: 'Lucas Cranach the Elder The Fountain of Youth Berlin',      title: 'The Fountain of Youth',            artist: 'Lucas Cranach the Elder',  year: '1546',         movement: 'Northern Renaissance' },

  // --- Baroque additions (Part 2) ---
  { query: 'Anthony van Dyck Charles I at the Hunt Louvre',             title: 'Charles I at the Hunt',            artist: 'Anthony van Dyck',         year: 'c. 1635',      movement: 'Baroque' },
  { query: 'Georges de La Tour Joseph the Carpenter Louvre',            title: 'Joseph the Carpenter',             artist: 'Georges de La Tour',       year: 'c. 1462',      movement: 'Baroque' },
  { query: 'Nicolas Poussin Et in Arcadia ego Louvre',                  title: 'Et in Arcadia ego',                artist: 'Nicolas Poussin',          year: '1637–1638',    movement: 'Baroque' },

  // --- Rococo additions (Part 2) ---
  { query: 'Thomas Gainsborough Mr and Mrs Andrews National Gallery',   title: 'Mr. and Mrs. Andrews',             artist: 'Thomas Gainsborough',      year: 'c. 1750',      movement: 'Rococo' },

  // --- Neoclassicism additions (Part 2) ---
  { query: 'Jacques-Louis David Portrait of Madame Recamier Louvre',     title: 'Portrait of Madame Récamier',      artist: 'Jacques-Louis David',      year: '1800',         movement: 'Neoclassicism' },

  // --- Romanticism additions (Part 2) ---
  { query: 'J M W Turner Rain Steam and Speed National Gallery',        title: 'Rain, Steam, and Speed',           artist: 'J. M. W. Turner',          year: '1844',         movement: 'Romanticism' },
  { query: 'Thomas Cole The Oxbow Met',                                 title: 'The Oxbow',                        artist: 'Thomas Cole',              year: '1836',         movement: 'Romanticism' },
  { query: 'John Constable The Hay Wain National Gallery',               title: 'The Hay Wain',                     artist: 'John Constable',           year: '1821',         movement: 'Romanticism' },

  // --- Realism additions (Part 2) ---
  { query: 'Thomas Eakins The Gross Clinic Philadelphia',               title: 'The Gross Clinic',                 artist: 'Thomas Eakins',            year: '1875',         movement: 'Realism' },
  { query: 'Winslow Homer The Gulf Stream Met',                         title: 'The Gulf Stream',                  artist: 'Winslow Homer',            year: '1899',         movement: 'Realism' },

  // --- Impressionism additions (Part 2) ---
  { query: 'Camille Pissarro The Boulevard Montmartre at Night London', title: 'The Boulevard Montmartre at Night', artist: 'Camille Pissarro',         year: '1897',         movement: 'Impressionism' },
  { query: 'Berthe Morisot The Cradle Orsay',                           title: 'The Cradle',                       artist: 'Berthe Morisot',           year: '1872',         movement: 'Impressionism' },
  { query: 'Claude Monet Woman with a Parasol National Gallery',        title: 'Woman with a Parasol',             artist: 'Claude Monet',             year: '1875',         movement: 'Impressionism' },

  // --- Post-Impressionism additions (Part 2) ---
  { query: 'Henri de Toulouse-Lautrec At the Moulin Rouge The Dance',    title: 'At the Moulin Rouge, The Dance',   artist: 'Henri de Toulouse-Lautrec', year: '1890',         movement: 'Post-Impressionism' },
  { query: 'Paul Gauguin The Yellow Christ Buffalo',                    title: 'The Yellow Christ',                artist: 'Paul Gauguin',             year: '1889',         movement: 'Post-Impressionism' },
  { query: 'Henri Rousseau The Dream MoMA',                             title: 'The Dream',                        artist: 'Henri Rousseau',           year: '1910',         movement: 'Post-Impressionism' },

  // --- Symbolism additions (Part 2) ---
  { query: 'Odilon Redon Cyclops Kroller-Muller',                       title: 'The Cyclops',                      artist: 'Odilon Redon',             year: '1914',         movement: 'Symbolism' },

  // --- Early Modernism additions (Part 2) ---
  { query: 'Umberto Boccioni Unique Forms of Continuity in Space',      title: 'Unique Forms of Continuity in Space', artist: 'Umberto Boccioni',       year: '1913',         movement: 'Early Modernism' },
  { query: 'Marc Chagall I and the Village MoMA',                       title: 'I and the Village',                artist: 'Marc Chagall',             year: '1911',         movement: 'Early Modernism' },
  { query: 'Amadeo Modigliani Jeanne Hebuterne with Hat',               title: 'Jeanne Hébuterne with Hat',        artist: 'Amedeo Modigliani',        year: '1918',         movement: 'Early Modernism' },

  // =========================================================================
  // --- EARLY RENAISSANCE (1400–1490) ---
  // =========================================================================
  { query: 'Giotto Lamentation Scrovegni Chapel',                       title: 'Lamentation (The Mourning of Christ)', artist: 'Giotto di Bondone',       year: 'c. 1305',      movement: 'Renaissance' },
  { query: 'Masaccio The Holy Trinity Santa Maria Novella',             title: 'The Holy Trinity',                 artist: 'Masaccio',                 year: 'c. 1427',      movement: 'Renaissance' },
  { query: 'Masaccio Tribute Money Brancacci Chapel',                   title: 'The Tribute Money',                artist: 'Masaccio',                 year: 'c. 1425',      movement: 'Renaissance' },
  { query: 'Masaccio Expulsion from the Garden of Eden',                title: 'Expulsion from the Garden of Eden', artist: 'Masaccio',                year: 'c. 1425',      movement: 'Renaissance' },
  { query: 'Fra Angelico The Annunciation San Marco Florence',          title: 'The Annunciation',                 artist: 'Fra Angelico',             year: 'c. 1440–1445', movement: 'Renaissance' },
  { query: 'Piero della Francesca The Baptism of Christ London',        title: 'The Baptism of Christ',            artist: 'Piero della Francesca',    year: 'c. 1448–1450', movement: 'Renaissance' },
  { query: 'Piero della Francesca Resurrection Sansepolcro',            title: 'The Resurrection',                 artist: 'Piero della Francesca',    year: 'c. 1463',      movement: 'Renaissance' },
  { query: 'Piero della Francesca Portrait of Federico da Montefeltro', title: 'Diptych of Federico da Montefeltro', artist: 'Piero della Francesca',   year: 'c. 1472',      movement: 'Renaissance' },
  { query: 'Paolo Uccello The Battle of San Romano National Gallery',   title: 'The Battle of San Romano',         artist: 'Paolo Uccello',            year: 'c. 1438–1440', movement: 'Renaissance' },
  { query: 'Paolo Uccello Saint George and the Dragon London',          title: 'Saint George and the Dragon',      artist: 'Paolo Uccello',            year: 'c. 1470',      movement: 'Renaissance' },
  { query: 'Andrea Mantegna Lamentation over the Dead Christ Milan',    title: 'Lamentation over the Dead Christ', artist: 'Andrea Mantegna',          year: 'c. 1480',      movement: 'Renaissance' },
  { query: 'Andrea Mantegna Camera degli Sposi ceiling',                title: 'Oculus of the Camera degli Sposi', artist: 'Andrea Mantegna',          year: '1465–1474',    movement: 'Renaissance' },
  { query: 'Andrea Mantegna Saint Sebastian Louvre',                    title: 'Saint Sebastian',                  artist: 'Andrea Mantegna',          year: 'c. 1480',      movement: 'Renaissance' },
  { query: 'Botticelli Pallas and the Centaur Uffizi',                  title: 'Pallas and the Centaur',           artist: 'Sandro Botticelli',        year: 'c. 1482',      movement: 'Renaissance' },
  { query: 'Botticelli Portrait of a Young Man Holding a Medal',        title: 'Portrait of a Young Man with Medal', artist: 'Sandro Botticelli',      year: 'c. 1475',      movement: 'Renaissance' },
  { query: 'Botticelli The Mystical Nativity London',                   title: 'The Mystical Nativity',            artist: 'Sandro Botticelli',        year: '1500',         movement: 'Renaissance' },
  { query: 'Botticelli Venus and Mars National Gallery',                title: 'Venus and Mars',                   artist: 'Sandro Botticelli',        year: 'c. 1485',      movement: 'Renaissance' },
  { query: 'Botticelli Adoration of the Magi 1475 Uffizi',               title: 'Adoration of the Magi',            artist: 'Sandro Botticelli',        year: 'c. 1475',      movement: 'Renaissance' },
  { query: 'Filippo Lippi Madonna and Child with Two Angels Uffizi',    title: 'Madonna and Child with Two Angels', artist: 'Fra Filippo Lippi',        year: 'c. 1465',      movement: 'Renaissance' },
  { query: 'Domenico Ghirlandaio An Old Man and his Grandson Louvre',   title: 'An Old Man and his Grandson',      artist: 'Domenico Ghirlandaio',     year: '1490',         movement: 'Renaissance' },
  { query: 'Perugino Christ Delivering the Keys to Saint Peter',         title: 'Christ Delivering the Keys to Peter', artist: 'Pietro Perugino',       year: '1481–1482',    movement: 'Renaissance' },
  { query: 'Luca Signorelli The Damned Cast into Hell Orvieto',         title: 'The Damned Cast into Hell',        artist: 'Luca Signorelli',          year: '1499–1502',    movement: 'Renaissance' },

  // =========================================================================
  // --- HIGH RENAISSANCE (1490–1527) ---
  // =========================================================================
  { query: 'Leonardo da Vinci Virgin of the Rocks Louvre',              title: 'Virgin of the Rocks',              artist: 'Leonardo da Vinci',        year: '1483–1486',    movement: 'Renaissance' },
  { query: 'Leonardo da Vinci Lady with an Ermine Czartoryski',         title: 'Lady with an Ermine',              artist: 'Leonardo da Vinci',        year: 'c. 1489–1491', movement: 'Renaissance' },
  { query: 'Leonardo da Vinci Portrait of Ginevra de Benci',            title: 'Ginevra de\' Benci',               artist: 'Leonardo da Vinci',        year: 'c. 1474–1478', movement: 'Renaissance' },
  { query: 'Leonardo da Vinci St John the Baptist Louvre',              title: 'Saint John the Baptist',           artist: 'Leonardo da Vinci',        year: '1513–1516',    movement: 'Renaissance' },
  { query: 'Leonardo da Vinci The Virgin and Child with Saint Anne',    title: 'The Virgin and Child with St. Anne', artist: 'Leonardo da Vinci',      year: 'c. 1503–1519', movement: 'Renaissance' },
  { query: 'Leonardo da Vinci Salvator Mundi',                          title: 'Salvator Mundi',                   artist: 'Leonardo da Vinci',        year: 'c. 1500',      movement: 'Renaissance' },
  { query: 'Leonardo da Vinci La Belle Ferronniere Louvre',             title: 'La Belle Ferronnière',             artist: 'Leonardo da Vinci',        year: '1490–1496',    movement: 'Renaissance' },
  { query: 'Leonardo da Vinci Bacchus Louvre',                          title: 'Bacchus',                          artist: 'Leonardo da Vinci',        year: 'c. 1510–1515', movement: 'Renaissance' },
  { query: 'Raphael Sistine Madonna Dresden',                           title: 'Sistine Madonna',                  artist: 'Raphael',                  year: '1512–1513',    movement: 'Renaissance' },
  { query: 'Raphael Transfiguration Vatican',                           title: 'The Transfiguration',              artist: 'Raphael',                  year: '1516–1520',    movement: 'Renaissance' },
  { query: 'Raphael Portrait of Baldassare Castiglione Louvre',         title: 'Portrait of Baldassare Castiglione', artist: 'Raphael',                year: '1514–1515',    movement: 'Renaissance' },
  { query: 'Raphael La Fornarina Barberini',                            title: 'La Fornarina',                     artist: 'Raphael',                  year: '1518–1519',    movement: 'Renaissance' },
  { query: 'Raphael Madonna of the Goldfinch Uffizi',                   title: 'Madonna of the Goldfinch',         artist: 'Raphael',                  year: 'c. 1505–1506', movement: 'Renaissance' },
  { query: 'Raphael The Triumph of Galatea Villa Farnesina',            title: 'The Triumph of Galatea',           artist: 'Raphael',                  year: '1512',         movement: 'Renaissance' },
  { query: 'Raphael Deposition Borghese Gallery',                       title: 'The Deposition',                   artist: 'Raphael',                  year: '1507',         movement: 'Renaissance' },
  { query: 'Raphael Portrait of Pope Julius II London',                 title: 'Portrait of Pope Julius II',       artist: 'Raphael',                  year: '1511',         movement: 'Renaissance' },
  { query: 'Raphael Donna Velata Pitti',                                title: 'La Velata (The Woman with the Veil)', artist: 'Raphael',              year: 'c. 1514–1515', movement: 'Renaissance' },
  { query: 'Raphael Saint George and the Dragon Washington',            title: 'Saint George and the Dragon',      artist: 'Raphael',                  year: 'c. 1506',      movement: 'Renaissance' },
  { query: 'Michelangelo Doni Tondo Uffizi',                            title: 'Doni Tondo',                       artist: 'Michelangelo',             year: 'c. 1504–1506', movement: 'Renaissance' },
  { query: 'Michelangelo The Libyan Sibyl Sistine Chapel',              title: 'The Libyan Sibyl',                 artist: 'Michelangelo',             year: 'c. 1511',      movement: 'Renaissance' },
  { query: 'Michelangelo The Delphic Sibyl Sistine Chapel',             title: 'The Delphic Sibyl',                artist: 'Michelangelo',             year: 'c. 1509',      movement: 'Renaissance' },
  { query: 'Michelangelo Separation of Light from Darkness',             title: 'Separation of Light from Darkness', artist: 'Michelangelo',           year: 'c. 1512',      movement: 'Renaissance' },
  { query: 'Fra Bartolomeo Deposition Pitti Palace',                    title: 'The Deposition',                   artist: 'Fra Bartolomeo',           year: 'c. 1511–1512', movement: 'Renaissance' },
  { query: 'Correggio Jupiter and Io Vienna',                           title: 'Jupiter and Io',                   artist: 'Correggio',                year: 'c. 1532',      movement: 'Renaissance' },
  { query: 'Correggio Assumption of the Virgin Parma Cathedral',         title: 'Assumption of the Virgin',         artist: 'Correggio',                year: '1526–1530',    movement: 'Renaissance' },
  { query: 'Correggio Nativity Holy Night Dresden',                     title: 'Nativity (Holy Night)',            artist: 'Correggio',                year: 'c. 1529–1530', movement: 'Renaissance' },

  // =========================================================================
  // --- VENETIAN SCHOOL ---
  // =========================================================================
  { query: 'Giovanni Bellini San Zaccaria Altarpiece Venice',           title: 'San Zaccaria Altarpiece',          artist: 'Giovanni Bellini',         year: '1505',         movement: 'Renaissance' },
  { query: 'Giovanni Bellini Agony in the Garden London',               title: 'The Agony in the Garden',          artist: 'Giovanni Bellini',         year: 'c. 1459–1465', movement: 'Renaissance' },
  { query: 'Giorgione Sleeping Venus Dresden',                          title: 'Sleeping Venus',                   artist: 'Giorgione',                year: 'c. 1510',      movement: 'Renaissance' },
  { query: 'Giorgione The Three Philosophers Vienna',                   title: 'The Three Philosophers',           artist: 'Giorgione',                year: 'c. 1508–1509', movement: 'Renaissance' },
  { query: 'Titian Assumption of the Virgin Frari Venice',              title: 'Assumption of the Virgin',         artist: 'Titian',                   year: '1516–1518',    movement: 'Renaissance' },
  { query: 'Titian Bacchus and Ariadne National Gallery',               title: 'Bacchus and Ariadne',              artist: 'Titian',                   year: '1522–1523',    movement: 'Renaissance' },
  { query: 'Titian Sacred and Profane Love Borghese',                   title: 'Sacred and Profane Love',          artist: 'Titian',                   year: 'c. 1514',      movement: 'Renaissance' },
  { query: 'Titian Equestrian Portrait of Charles V Prado',             title: 'Equestrian Portrait of Charles V', artist: 'Titian',                   year: '1548',         movement: 'Renaissance' },
  { query: 'Titian Rape of Europa Isabella Stewart Gardner',            title: 'The Rape of Europa',               artist: 'Titian',                   year: '1560–1562',    movement: 'Renaissance' },
  { query: 'Titian Diana and Actaeon National Gallery',                 title: 'Diana and Actaeon',                artist: 'Titian',                   year: '1556–1559',    movement: 'Renaissance' },
  { query: 'Titian Flora Uffizi',                                       title: 'Flora',                            artist: 'Titian',                   year: 'c. 1515',      movement: 'Renaissance' },
  { query: 'Titian Man with a Glove Louvre',                            title: 'The Man with the Glove',           artist: 'Titian',                   year: 'c. 1520',      movement: 'Renaissance' },
  { query: 'Titian Pieta Venice Accademia',                             title: 'Pietà',                            artist: 'Titian',                   year: 'c. 1576',      movement: 'Renaissance' },
  { query: 'Paolo Veronese The Wedding at Cana Louvre',                 title: 'The Wedding at Cana',              artist: 'Paolo Veronese',           year: '1563',         movement: 'Renaissance' },
  { query: 'Paolo Veronese The Feast in the House of Levi Accademia',   title: 'The Feast in the House of Levi',   artist: 'Paolo Veronese',           year: '1573',         movement: 'Renaissance' },
  { query: 'Tintoretto The Miracle of the Slave Accademia Venice',      title: 'The Miracle of the Slave',         artist: 'Tintoretto',               year: '1548',         movement: 'Renaissance' },
  { query: 'Tintoretto The Last Supper San Giorgio Maggiore',           title: 'The Last Supper',                  artist: 'Tintoretto',               year: '1592–1594',    movement: 'Renaissance' },
  { query: 'Tintoretto Paradise Doges Palace Venice',                   title: 'Il Paradiso',                      artist: 'Tintoretto',               year: 'c. 1588–1592', movement: 'Renaissance' },

  // =========================================================================
  // --- MANNERISM (LATE RENAISSANCE) ---
  // =========================================================================
  { query: 'Parmigianino Madonna with the Long Neck Uffizi',            title: 'Madonna with the Long Neck',       artist: 'Parmigianino',             year: '1534–1540',    movement: 'Renaissance' },
  { query: 'Parmigianino Self-portrait in a Convex Mirror Vienna',      title: 'Self-Portrait in a Convex Mirror', artist: 'Parmigianino',             year: 'c. 1524',      movement: 'Renaissance' },
  { query: 'Pontormo The Deposition from the Cross Santa Felicita',     title: 'The Deposition from the Cross',    artist: 'Jacopo da Pontormo',       year: '1525–1528',    movement: 'Renaissance' },
  { query: 'Bronzino An Allegory with Venus and Cupid London',          title: 'An Allegory with Venus and Cupid', artist: 'Agnolo Bronzino',          year: 'c. 1545',      movement: 'Renaissance' },
  { query: 'Bronzino Portrait of Eleanor of Toledo Uffizi',             title: 'Portrait of Eleanor of Toledo',    artist: 'Agnolo Bronzino',          year: 'c. 1545',      movement: 'Renaissance' },
  { query: 'Rosso Fiorentino The Deposition Volterra',                  title: 'The Deposition from the Cross',    artist: 'Rosso Fiorentino',         year: '1521',         movement: 'Renaissance' },

  // =========================================================================
  // --- NORTHERN RENAISSANCE (1430–1600) ---
  // =========================================================================
  { query: 'Jan van Eyck Ghent Altarpiece open St Bavo',                title: 'The Ghent Altarpiece',             artist: 'Jan van Eyck',             year: '1432',         movement: 'Northern Renaissance' },
  { query: 'Jan van Eyck Man in a Red Turban National Gallery',         title: 'Portrait of a Man (Self-Portrait?)', artist: 'Jan van Eyck',           year: '1433',         movement: 'Northern Renaissance' },
  { query: 'Jan van Eyck Madonna of Chancellor Rolin Louvre',           title: 'Madonna of Chancellor Rolin',      artist: 'Jan van Eyck',             year: 'c. 1435',      movement: 'Northern Renaissance' },
  { query: 'Rogel van der Weyden The Descent from the Cross Prado',     title: 'The Descent from the Cross',       artist: 'Rogier van der Weyden',    year: 'c. 1435',      movement: 'Northern Renaissance' },
  { query: 'Rogier van der Weyden Portrait of a Lady Washington',        title: 'Portrait of a Lady',               artist: 'Rogier van der Weyden',    year: 'c. 1460',      movement: 'Northern Renaissance' },
  { query: 'Hieronymus Bosch The Haywain Triptych Prado',               title: 'The Haywain Triptych',             artist: 'Hieronymus Bosch',         year: 'c. 1516',      movement: 'Northern Renaissance' },
  { query: 'Hieronymus Bosch Ship of Fools Louvre',                     title: 'Ship of Fools',                    artist: 'Hieronymus Bosch',         year: 'c. 1490–1500', movement: 'Northern Renaissance' },
  { query: 'Hieronymus Bosch Christ Carrying the Cross Ghent',          title: 'Christ Carrying the Cross',        artist: 'Hieronymus Bosch',         year: 'c. 1510–1516', movement: 'Northern Renaissance' },
  { query: 'Albrecht Durer Adam and Eve Prado',                         title: 'Adam and Eve',                     artist: 'Albrecht Dürer',           year: '1507',         movement: 'Northern Renaissance' },
  { query: 'Albrecht Durer Melencolia I engraving 1514',                title: 'Melencolia I',                     artist: 'Albrecht Dürer',           year: '1514',         movement: 'Northern Renaissance' },
  { query: 'Albrecht Durer Knight Death and the Devil engraving',       title: 'Knight, Death and the Devil',      artist: 'Albrecht Dürer',           year: '1513',         movement: 'Northern Renaissance' },
  { query: 'Albrecht Durer Four Apostles Munich',                       title: 'The Four Apostles',                artist: 'Albrecht Dürer',           year: '1526',         movement: 'Northern Renaissance' },
  { query: 'Albrecht Durer Self-Portrait Prado 1498',                   title: 'Self-Portrait at 26',              artist: 'Albrecht Dürer',           year: '1498',         movement: 'Northern Renaissance' },
  { query: 'Hans Holbein the Younger Portrait of Henry VIII Thyssen',   title: 'Portrait of Henry VIII',           artist: 'Hans Holbein the Younger', year: '1536–1537',    movement: 'Northern Renaissance' },
  { query: 'Hans Holbein the Younger The French Ambassadors detail',    title: 'The Ambassadors (Anamorphic Skull)', artist: 'Hans Holbein the Younger', year: '1533',      movement: 'Northern Renaissance' },
  { query: 'Hans Holbein the Younger Erasmus of Rotterdam Louvre',      title: 'Portrait of Erasmus of Rotterdam', artist: 'Hans Holbein the Younger', year: '1523',         movement: 'Northern Renaissance' },
  { query: 'Hans Holbein the Younger The Body of the Dead Christ',      title: 'The Body of the Dead Christ in the Tomb', artist: 'Hans Holbein the Younger', year: '1521–1522', movement: 'Northern Renaissance' },
  { query: 'Pieter Bruegel the Elder Netherlandish Proverbs Berlin',    title: 'Netherlandish Proverbs',           artist: 'Pieter Bruegel the Elder', year: '1559',         movement: 'Northern Renaissance' },
  { query: 'Pieter Bruegel the Elder The Peasant Wedding Vienna',       title: 'The Peasant Wedding',              artist: 'Pieter Bruegel the Elder', year: '1567',         movement: 'Northern Renaissance' },
  { query: 'Pieter Bruegel the Elder The Fall of the Rebel Angels',     title: 'The Fall of the Rebel Angels',     artist: 'Pieter Bruegel the Elder', year: '1562',         movement: 'Northern Renaissance' },
  { query: 'Pieter Bruegel the Elder The Triumph of Death Prado',       title: 'The Triumph of Death',             artist: 'Pieter Bruegel the Elder', year: 'c. 1562',      movement: 'Northern Renaissance' },
  { query: 'Pieter Bruegel the Elder Landscape with the Fall of Icarus',title: 'Landscape with the Fall of Icarus', artist: 'Pieter Bruegel the Elder', year: 'c. 1558',      movement: 'Northern Renaissance' },
  { query: 'Pieter Bruegel the Elder Childrens Games Vienna',           title: 'Children\'s Games',                artist: 'Pieter Bruegel the Elder', year: '1560',         movement: 'Northern Renaissance' },
  { query: 'Lucas Cranach the Elder Adam and Eve Courtauld',            title: 'Adam and Eve',                     artist: 'Lucas Cranach the Elder',  year: '1526',         movement: 'Northern Renaissance' },
  { query: 'Lucas Cranach the Elder Judith with the Head of Holofernes',title: 'Judith with the Head of Holofernes', artist: 'Lucas Cranach the Elder', year: 'c. 1530',      movement: 'Northern Renaissance' },
  { query: 'Albrecht Altdorfer The Battle of Alexander at Issus',       title: 'The Battle of Alexander at Issus', artist: 'Albrecht Altdorfer',       year: '1529',         movement: 'Northern Renaissance' },
  { query: 'Quinten Massys The Moneylender and his Wife Louvre',        title: 'The Moneylender and his Wife',     artist: 'Quinten Massys',           year: '1514',         movement: 'Northern Renaissance' },
  { query: 'Jean Clouet Portrait of Francois I of France Louvre',       title: 'Portrait of Francis I of France',  artist: 'Jean Clouet',              year: 'c. 1525–1530', movement: 'Northern Renaissance' },
  { query: 'Hans Memling Last Judgment Triptych Gdansk',                title: 'The Last Judgment Triptych',       artist: 'Hans Memling',             year: '1467–1471',    movement: 'Northern Renaissance' },
];


// ---------------------------------------------------------------
// 2. CONFIG
// ---------------------------------------------------------------
const COMMONS_API   = 'https://commons.wikimedia.org/w/api.php';
const IMAGE_WIDTH   = 1600;          // rendition width — right size for a 3D gallery texture
const BUCKET        = 'artworks';
const RATE_LIMIT_MS = 1200;          // be polite to the Commons API

// Wikimedia policy requires a descriptive User-Agent with contact info.
// Put your email or project URL here.
const USER_AGENT = 'ArtHistoryGalleryLoader/1.0 (personal education project; contact: tellapaneni.prasanna@gmail.com)';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function commonsGet(params) {
  const url = new URL(COMMONS_API);
  Object.entries({ format: 'json', origin: '*', ...params }).forEach(([k, v]) =>
    url.searchParams.set(k, v)
  );
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Commons API ${res.status} for ${url}`);
  return res.json();
}

// ---------------------------------------------------------------
// 3. Resolve a search query -> best matching Commons file title
// ---------------------------------------------------------------
async function findCommonsFile(query) {
  const data = await commonsGet({
    action: 'query',
    list: 'search',
    srsearch: query,
    srnamespace: 6,          // File: namespace
    srlimit: 5,
  });
  const hits = (data.query?.search ?? []).filter((h) =>
    /\.(jpe?g|png)$/i.test(h.title)   // skip TIFF/SVG/PDF hits
  );
  return hits[0]?.title ?? null;      // e.g. "File:Mona Lisa, by Leonardo da Vinci....jpg"
}

// ---------------------------------------------------------------
// 4. Get a scaled image URL + license metadata for a file title
// ---------------------------------------------------------------
async function getImageInfo(fileTitle) {
  const data = await commonsGet({
    action: 'query',
    titles: fileTitle,
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: IMAGE_WIDTH,
  });
  const page = Object.values(data.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;

  const meta = info.extmetadata ?? {};
  const strip = (html) => (html ?? '').replace(/<[^>]*>/g, '').trim();

  return {
    imageUrl:    info.thumburl ?? info.url,   // scaled rendition (falls back to original)
    width:       info.thumbwidth ?? info.width,
    height:      info.thumbheight ?? info.height,
    sourceUrl:   info.descriptionurl,
    license:     strip(meta.LicenseShortName?.value) || 'Unknown',
    attribution: strip(meta.Artist?.value) || null,
  };
}

// ---------------------------------------------------------------
// 5. Main pipeline
// ---------------------------------------------------------------
async function main() {
  console.log(`Loading ${COLLECTION.length} artworks into Supabase...\n`);
  let ok = 0, skipped = 0, failed = 0;

  for (const [i, work] of COLLECTION.entries()) {
    const label = `${work.artist} — ${work.title}`;
    try {
      // Skip if already loaded (idempotent re-runs)
      const { data: existing } = await supabase
        .from('artworks').select('id').eq('title', work.title).eq('artist', work.artist).maybeSingle();
      if (existing) {
        console.log(`↷  Skipping (already in DB): ${label}`);
        skipped++;
        continue;
      }

      // Resolve on Commons
      const fileTitle = await findCommonsFile(work.query);
      if (!fileTitle) throw new Error('no Commons file found for query');
      await sleep(RATE_LIMIT_MS);

      const info = await getImageInfo(fileTitle);
      if (!info) throw new Error('no imageinfo returned');
      await sleep(RATE_LIMIT_MS);

      // Download the rendition
      const imgRes = await fetch(info.imageUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (!imgRes.ok) throw new Error(`image download failed: ${imgRes.status}`);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : 'jpg';

      // Upload to Storage:  movement/slug.jpg
      const storagePath = `${slugify(work.movement)}/${slugify(work.title)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType, upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

      // Insert metadata row
      const { error: insErr } = await supabase.from('artworks').insert({
        title:        work.title,
        artist:       work.artist,
        year:         work.year,
        movement:     work.movement,
        sort_order:   i,
        commons_file: fileTitle,
        source_url:   info.sourceUrl,
        license:      info.license,
        attribution:  info.attribution,
        storage_path: storagePath,
        image_url:    pub.publicUrl,
        width:        info.width,
        height:       info.height,
      });
      if (insErr) throw insErr;

      console.log(`✓  Loaded: ${label}  (${(buffer.length / 1024).toFixed(0)} KB, ${info.license})`);
      ok++;
    } catch (err) {
      console.error(`✗  FAILED: ${label} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} loaded, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) {
    console.log('For failures, tweak the `query` string for that work and re-run — already-loaded works are skipped automatically.');
  }
}

main();
