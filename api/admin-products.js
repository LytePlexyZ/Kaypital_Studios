// Server-side admin endpoint — currently just handles product deletion,
// since deleting a `products` row doesn't clean up its storage files.
// Everything else (create/update product, variants, images, catalog
// list) is done directly from admin.js using the signed-in admin's own
// session — RLS on products/product_variants/product_images already
// restricts writes to admins, so a separate endpoint isn't needed there.
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY as Vercel env vars
// (same variables the original project already used).

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the caller is a signed-in admin.
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: 'Invalid session' });

  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();
  if (!admin) return res.status(403).json({ error: 'Not an admin' });

  const { productId } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId required' });

  const { data: images } = await supabaseAdmin
    .from('product_images')
    .select('url')
    .eq('product_id', productId);

  const paths = (images || [])
    .map(img => {
      const marker = '/product-images/';
      const idx = img.url.indexOf(marker);
      return idx === -1 ? null : img.url.slice(idx + marker.length);
    })
    .filter(Boolean);

  if (paths.length) {
    await supabaseAdmin.storage.from('product-images').remove(paths);
  }

  const { error: deleteError } = await supabaseAdmin.from('products').delete().eq('id', productId);
  if (deleteError) return res.status(500).json({ error: deleteError.message });

  return res.status(200).json({ ok: true });
}
