const { Pool } = require('pg');
const crypto = require('node:crypto');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required; configure Coolify with vasati-data’s internal PostgreSQL URL.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const defaultSettings = {
  hero_tag: '✨ Premium Bengaluru Real Estate Portfolio', hero_title: 'Find Your Dream Space in the Silicon Valley of India',
  hero_subtitle: "Verified builder developments, luxury gated communities, and prime resale apartments across Bengaluru's top tech corridors.",
  contact_phone: '+91 6303420048', whatsapp_number: '916303420048', contact_email: 'contact@vasatiproperties.com',
  stat_active_listings: '150+', stat_hubs: '15+', stat_trust: '100%'
};
const seedProperties = [
  ['a','Modern living in Whitefield','Whitefield, East Bengaluru','Whitefield',95,'₹95 L',2,'1,240 sqft',2,'New','https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=78','https://www.youtube.com/embed/dQw4w9WgXcQ','Bright contemporary home with spacious living and dining areas','Agent listing · Verified','Apartment','Ready to move','A bright, thoughtfully laid-out premium home in Whitefield close to tech parks, international schools, and metro stations.',true],
  ['b','Room to grow in Sarjapur','Sarjapur Road, South Bengaluru','Sarjapur Road',125,'₹1.25 Cr',3,'1,685 sqft',3,'New','https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=78','','Contemporary residence with generous living space and natural light','Agent listing · Verified','Apartment','Under construction','A spacious luxury apartment listing on Sarjapur Road with premium amenities and fast Outer Ring Road connectivity.',true],
  ['c','A home with character','HSR Layout, South Bengaluru','HSR Layout',220,'₹2.2 Cr',3,'2,140 sqft',3,'Resale','https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=78','','Airy modern family home with a garden-side patio','Resale · Verified','Villa','Ready to move','A premium resale family home in prime HSR Layout Sector 2.',true]
];

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS properties (id TEXT PRIMARY KEY,title TEXT NOT NULL,location TEXT NOT NULL,locality TEXT,price NUMERIC NOT NULL,price_label TEXT NOT NULL,bhk INTEGER NOT NULL,area TEXT NOT NULL,baths INTEGER NOT NULL,status TEXT NOT NULL,image TEXT NOT NULL,video_url TEXT,brochure_url TEXT,alt TEXT,listed TEXT,kind TEXT,possession TEXT,description TEXT,featured BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS enquiries (id BIGSERIAL PRIMARY KEY,property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,property_title TEXT,name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT,message TEXT,status TEXT NOT NULL DEFAULT 'New',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS featured_projects (id TEXT PRIMARY KEY,name TEXT NOT NULL,builder_name TEXT NOT NULL,builder_logo TEXT,price_range TEXT,bhk_types TEXT,location TEXT,offer_text TEXT,image TEXT,video_url TEXT,link TEXT);
    CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media_assets (id UUID PRIMARY KEY,filename TEXT NOT NULL,content_type TEXT NOT NULL,data BYTEA NOT NULL,size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS enquiries_created_at_idx ON enquiries(created_at DESC);
    CREATE INDEX IF NOT EXISTS media_assets_created_at_idx ON media_assets(created_at DESC);`);
  for (const [key, value] of Object.entries(defaultSettings)) await pool.query('INSERT INTO site_settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING', [key, value]);
  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*)::int AS count FROM properties');
  if (!count) for (const p of seedProperties) await pool.query('INSERT INTO properties (id,title,location,locality,price,price_label,bhk,area,baths,status,image,video_url,alt,listed,kind,possession,description,featured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)', p);
}
function values(prop) { const price = Number(prop.price); return [prop.title,prop.location,prop.locality || prop.location.split(',')[0].trim(),price,prop.priceLabel || (price >= 100 ? `₹${(price / 100).toFixed(2)} Cr` : `₹${price} L`),Number(prop.bhk),prop.area,Number(prop.baths || 2),prop.status || 'New',prop.image || 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=78',prop.video_url || '',prop.brochure_url || '',prop.alt || prop.title,prop.listed || 'Agent listing · Verified',prop.kind || 'Apartment',prop.possession || 'Ready to move',prop.description || '',Boolean(prop.featured)]; }
async function getAllProperties(filters = {}) {
  const where = [], params = []; const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
  if (filters.locality && !['all','Bengaluru','Bangalore'].includes(filters.locality)) { params.push(`%${filters.locality}%`); where.push(`(location ILIKE $${params.length} OR locality ILIKE $${params.length})`); }
  if (filters.bhk && filters.bhk !== 'any') add(Number(filters.bhk) >= 4 ? 'bhk >= ?' : 'bhk = ?', Number(filters.bhk));
  if (filters.status && filters.status !== 'any') add('status = ?', filters.status); if (filters.kind && !['Buy','any'].includes(filters.kind)) add('kind = ?', filters.kind);
  if (filters.minPrice) add('price >= ?', Number(filters.minPrice)); if (filters.maxPrice && Number(filters.maxPrice) < 500) add('price <= ?', Number(filters.maxPrice)); if (filters.budget && filters.budget !== 'any') add('price <= ?', Number(filters.budget));
  if (filters.search) { params.push(`%${filters.search}%`); where.push(`(title ILIKE $${params.length} OR location ILIKE $${params.length} OR description ILIKE $${params.length})`); }
  const order = filters.sort === 'price' ? 'price ASC' : filters.sort === 'price-desc' ? 'price DESC' : 'featured DESC, created_at DESC';
  return (await pool.query(`SELECT * FROM properties${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${order}`, params)).rows;
}
const db = {
  initializeDatabase, getAllProperties,
  async getPropertyById(id) { return (await pool.query('SELECT * FROM properties WHERE id=$1',[id])).rows[0]; },
  async createProperty(prop) { const id = prop.id || `prop_${crypto.randomUUID()}`; await pool.query('INSERT INTO properties (title,location,locality,price,price_label,bhk,area,baths,status,image,video_url,brochure_url,alt,listed,kind,possession,description,featured,id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)', [...values(prop),id]); return id; },
  async updateProperty(id,prop) { await pool.query('UPDATE properties SET title=$1,location=$2,locality=$3,price=$4,price_label=$5,bhk=$6,area=$7,baths=$8,status=$9,image=$10,video_url=$11,brochure_url=$12,alt=$13,listed=$14,kind=$15,possession=$16,description=$17,featured=$18 WHERE id=$19',[...values(prop),id]); },
  async deleteProperty(id) { await pool.query('DELETE FROM properties WHERE id=$1',[id]); },
  async getFeaturedProjects() { return (await pool.query('SELECT * FROM featured_projects')).rows; },
  async createFeaturedProject(p) { const id = p.id || `slide_${crypto.randomUUID()}`; await pool.query('INSERT INTO featured_projects (id,name,builder_name,builder_logo,price_range,bhk_types,location,offer_text,image,video_url,link) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,p.name,p.builder_name || 'Premier Builder',p.builder_logo || 'PARTNER',p.price_range || 'Contact for Price',p.bhk_types || '2, 3 BHK Luxury Apartments',p.location || 'Bengaluru',p.offer_text || 'Exclusive Launch Benefits',p.image,p.video_url || '',p.link || '#propertiesSection']); return id; },
  async updateFeaturedProject(id,p) { await pool.query('UPDATE featured_projects SET name=$1,builder_name=$2,builder_logo=$3,price_range=$4,bhk_types=$5,location=$6,offer_text=$7,image=$8,video_url=$9,link=$10 WHERE id=$11',[p.name,p.builder_name,p.builder_logo,p.price_range,p.bhk_types,p.location,p.offer_text,p.image,p.video_url || '',p.link || '#propertiesSection',id]); },
  async deleteFeaturedProject(id) { await pool.query('DELETE FROM featured_projects WHERE id=$1',[id]); },
  async getSiteSettings() { const { rows } = await pool.query('SELECT key,value FROM site_settings'); return Object.fromEntries(rows.map(({key,value}) => [key,value])); },
  async updateSiteSettings(settings) { for (const [key,value] of Object.entries(settings)) await pool.query('INSERT INTO site_settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value',[key,String(value)]); },
  async getAllEnquiries(status) { return (await pool.query(`SELECT * FROM enquiries${status ? ' WHERE status=$1' : ''} ORDER BY created_at DESC`,status ? [status] : [])).rows; },
  async createEnquiry(e) { return (await pool.query('INSERT INTO enquiries (property_id,property_title,name,phone,email,message) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',[e.property_id || null,e.property_title || 'General Enquiry',e.name,e.phone,e.email || '',e.message || ''])).rows[0].id; },
  async updateEnquiryStatus(id,status) { await pool.query('UPDATE enquiries SET status=$1 WHERE id=$2',[status,id]); }, async deleteEnquiry(id) { await pool.query('DELETE FROM enquiries WHERE id=$1',[id]); },
  async getStats() { const {rows:[p]}=await pool.query(`SELECT COUNT(*)::int AS "totalProperties",COUNT(*) FILTER (WHERE status='New')::int AS "newHomes",COUNT(*) FILTER (WHERE status='Resale')::int AS "resaleHomes",COUNT(*) FILTER (WHERE status='Villa')::int AS villas FROM properties`); const {rows:[s]}=await pool.query('SELECT COUNT(*)::int AS "totalSlides" FROM featured_projects'); const {rows:[e]}=await pool.query(`SELECT COUNT(*)::int AS "totalEnquiries",COUNT(*) FILTER (WHERE status='New')::int AS "newEnquiries" FROM enquiries`); return {...p,...s,...e}; },
  async createMediaAsset({filename,contentType,data}) { const id=crypto.randomUUID(); await pool.query('INSERT INTO media_assets (id,filename,content_type,data,size_bytes) VALUES ($1,$2,$3,$4,$5)',[id,filename,contentType,data,data.length]); return id; },
  async getMediaAsset(id) { return (await pool.query('SELECT filename,content_type,data,size_bytes FROM media_assets WHERE id=$1',[id])).rows[0]; }
};
module.exports = db;
