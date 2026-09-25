// KAYPITAL STUDIOS — admin dashboard logic.
// Same auth pattern as the original project: Supabase email/password
// login, gated by membership in public.admins. Once signed in, the
// admin's own JWT is used for all reads/writes/uploads — RLS policies
// on products/variants/images/storage do the enforcement, so there's
// no separate server-side admin API needed for these operations.

const supabaseClient = window.supabase.createClient(
  window.KAYPITAL_CONFIG.SUPABASE_URL,
  window.KAYPITAL_CONFIG.SUPABASE_ANON_KEY
);

const loginEl = document.getElementById('login');
const dashboardEl = document.getElementById('dashboard');
const logoutBtn = document.getElementById('logout');

// ---------------- Auth ----------------

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    showDashboard();
  } else {
    showLogin();
  }
}

function showDashboard() {
  loginEl.classList.add('hidden');
  dashboardEl.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  loadCatalog();
}

function showLogin() {
  loginEl.classList.remove('hidden');
  dashboardEl.classList.add('hidden');
  logoutBtn.classList.add('hidden');
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const statusEl = document.getElementById('loginStatus');
  statusEl.textContent = 'Signing in…';
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) { statusEl.textContent = error.message; return; }
  statusEl.textContent = '';
  showDashboard();
});

async function logout() {
  await supabaseClient.auth.signOut();
  showLogin();
}
window.logout = logout;

// ---------------- Variant builder ----------------

const variantRows = document.getElementById('variantRows');

function addVariantRow(color = '', size = '') {
  const row = document.createElement('div');
  row.className = 'variant-row';
  row.innerHTML = `
    <input class="input variant-color" placeholder="Color (e.g. Washed Black)" value="${color}" style="max-width:200px">
    <input class="input variant-size" placeholder="Size (e.g. M)" value="${size}" style="max-width:100px">
    <button type="button" class="small-button remove-variant">Remove</button>
  `;
  row.querySelector('.remove-variant').addEventListener('click', () => row.remove());
  variantRows.appendChild(row);
}
document.getElementById('addVariantRow').addEventListener('click', () => addVariantRow());
addVariantRow(); // start with one blank row

function collectVariants() {
  return [...variantRows.querySelectorAll('.variant-row')]
    .map(row => ({
      color: row.querySelector('.variant-color').value.trim(),
      size: row.querySelector('.variant-size').value.trim(),
    }))
    .filter(v => v.color && v.size);
}

// ---------------- Image drop zones ----------------

const pendingImages = { main: [], front: [], back: [], detail: [] };

document.querySelectorAll('.drop').forEach(dropEl => {
  const slot = dropEl.dataset.slot;
  const input = dropEl.querySelector('input[type=file]');
  const statusEl = dropEl.nextElementSibling;

  dropEl.addEventListener('click', () => input.click());
  input.addEventListener('change', () => handleFile(input.files[0]));
  dropEl.addEventListener('dragover', (e) => e.preventDefault());
  dropEl.addEventListener('drop', (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  });

  async function handleFile(file) {
    if (!file) return;
    statusEl.textContent = 'Uploading…';
    const path = `${slot}/${Date.now()}-${file.name}`;
    const { error } = await supabaseClient.storage.from('product-images').upload(path, file);
    if (error) { statusEl.textContent = error.message; return; }
    const { data: { publicUrl } } = supabaseClient.storage.from('product-images').getPublicUrl(path);
    pendingImages[slot].push(publicUrl);
    statusEl.textContent = `${pendingImages[slot].length} image(s) attached`;
  }
});

// ---------------- Save product ----------------

document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById('formStatus');
  statusEl.textContent = 'Saving…';

  const name = document.getElementById('name').value.trim();
  const slug = document.getElementById('slug').value.trim();
  const collectionSlug = document.getElementById('collectionSlug').value.trim();
  const category = document.getElementById('category').value;
  const price = Number(document.getElementById('price').value) || 0;
  const description = document.getElementById('description').value.trim();
  const status = document.getElementById('status').value;

  let collectionId = null;
  if (collectionSlug) {
    const { data: collection } = await supabaseClient
      .from('collections')
      .select('id')
      .eq('slug', collectionSlug)
      .single();
    collectionId = collection?.id || null;
  }

  const { data: product, error: productError } = await supabaseClient
    .from('products')
    .insert({ name, slug, collection_id: collectionId, category, price, description, status })
    .select()
    .single();

  if (productError) { statusEl.textContent = productError.message; return; }

  const variants = collectVariants().map(v => ({ ...v, product_id: product.id }));
  if (variants.length) {
    const { error: variantError } = await supabaseClient.from('product_variants').insert(variants);
    if (variantError) { statusEl.textContent = 'Product saved, but variants failed: ' + variantError.message; return; }
  }

  const imageRows = [];
  Object.entries(pendingImages).forEach(([slot, urls]) => {
    urls.forEach((url, i) => {
      imageRows.push({
        product_id: product.id,
        url,
        image_type: slot === 'detail' ? 'detail' : slot,
        sort_order: i,
      });
    });
  });
  if (imageRows.length) {
    const { error: imageError } = await supabaseClient.from('product_images').insert(imageRows);
    if (imageError) { statusEl.textContent = 'Product saved, but images failed: ' + imageError.message; return; }
  }

  statusEl.textContent = 'Saved.';
  e.target.reset();
  Object.keys(pendingImages).forEach(k => pendingImages[k] = []);
  variantRows.innerHTML = '';
  addVariantRow();
  loadCatalog();
});

// ---------------- Catalog list ----------------

async function loadCatalog() {
  const listEl = document.getElementById('adminList');
  const { data, error } = await supabaseClient
    .from('products')
    .select('id, name, category, price, status')
    .order('created_at', { ascending: false });

  if (error) { listEl.innerHTML = `<p>${error.message}</p>`; return; }
  if (!data.length) { listEl.innerHTML = '<p>No products yet.</p>'; return; }

  listEl.innerHTML = data.map(p => `
    <div class="row">
      <span>${p.name} — ${p.category} — $${Number(p.price).toFixed(0)}</span>
      <span>${p.status}</span>
    </div>
  `).join('');
}

checkSession();
