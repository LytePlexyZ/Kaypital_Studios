// Public-facing data layer — reads products/collections directly from
// Supabase (RLS only exposes published rows to anonymous visitors).
// Same client-init pattern as the old store.js.

const supabaseClient = window.supabase.createClient(
  window.KAYPITAL_CONFIG.SUPABASE_URL,
  window.KAYPITAL_CONFIG.SUPABASE_ANON_KEY
);

async function fetchPublishedProducts({ collectionSlug } = {}) {
  let query = supabaseClient
    .from('products')
    .select('*, product_images(*), collections(slug,name)')
    .eq('status', 'published')
    .order('sort_order', { ascending: true });

  if (collectionSlug) {
    const { data: collection } = await supabaseClient
      .from('collections')
      .select('id')
      .eq('slug', collectionSlug)
      .single();
    if (collection) query = query.eq('collection_id', collection.id);
  }

  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return data;
}

async function fetchProductBySlug(slug) {
  const { data, error } = await supabaseClient
    .from('products')
    .select('*, product_images(*), product_variants(*), collections(slug,name)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();
  if (error) { console.error(error); return null; }
  return data;
}

function mainImage(product) {
  const images = product.product_images || [];
  return (
    images.find(i => i.image_type === 'main')?.url ||
    images[0]?.url ||
    '/placeholder.jpg'
  );
}

function renderProductGrid(products, mountEl) {
  if (!products.length) {
    mountEl.innerHTML = '<p>Nothing published here yet.</p>';
    return;
  }
  mountEl.innerHTML = products.map(p => `
    <a class="product-card" href="/product.html?slug=${encodeURIComponent(p.slug)}">
      <div class="image-wrap"><img src="${mainImage(p)}" alt="${p.name}" loading="lazy"></div>
      <div class="name">${p.name}</div>
      <div class="meta">$${Number(p.price).toFixed(0)}</div>
    </a>
  `).join('');
}
