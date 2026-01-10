// Farmer dashboard behaviour: metrics, recent orders, store and order modal
const API_BASE = 'http://localhost:5000/api';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');

// Toast helper
function toast(message, type='success'){
  const container = document.getElementById('toastContainer');
  if(!container) {
    alert(message);
    return;
  }
  const el = document.createElement('div');
  el.className = 'toast ' + (type==='error'?'error':'success');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(()=> el.remove(), 3000);
}

// Auth check — allow demo fallback
function ensureAuth(){
  if(!token && !currentUser){
    currentUser = { name:'Farmer', role:'farmer', rewardPoints: 1200 };
    localStorage.setItem('user', JSON.stringify(currentUser));
  }
  if(!currentUser || currentUser.role !== 'farmer'){
    alert('Please login as a farmer user');
    window.location.href = 'index.html';
    return false;
  }
  document.getElementById('userInitial').textContent = (currentUser.name||'F').charAt(0).toUpperCase();
  return true;
}

// Demo product set (if server has only single Compost model, show multiple variants locally)
const demoProducts = [
  { id: 'p1', title: 'Premium Organic Compost', desc: 'High-quality compost made from kitchen waste and garden materials. Rich in nutrients.', pricePerKg: 30, stock: 850, category: 'premium', img: 'images/compost-1.jpg' },
  { id: 'p2', title: 'Vegetable Waste Compost', desc: 'Made from 100% vegetable waste. Excellent for vegetable farming.', pricePerKg: 28, stock: 1200, category: 'vegetable', img: 'images/compost-2.jpg' },
  { id: 'p3', title: 'Enriched Garden Compost', desc: 'Specially enriched compost with added minerals. Ideal for orchards.', pricePerKg: 35, stock: 450, category: 'garden', img: 'images/compost-3.jpg' }
];

// Build store grid - load from server inventory
async function loadStore(){
  const grid = document.getElementById('storeGrid');
  if(!grid) return;
  try {
    // Load products from backend inventory
    let products = [];
    try {
      const res = await fetch(`${API_BASE}/inventory`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          products = data.map(p => ({
            id: p._id || p.id,
            title: p.name || 'Compost Product',
            desc: `Category: ${p.category || 'general'}`,
            pricePerKg: p.pricePerKg || 0,
            stock: p.stock || 0,
            category: p.category || 'premium',
            img: p.image || ''
          }));
        }
      }
    } catch (e) {
      console.error('Error loading inventory:', e);
    }
    
    // Fallback to demo products if no admin inventory found
    if (products.length === 0) {
    }
    
    // Store products in a variable for search/filter
    window.currentProducts = products;
    
    grid.innerHTML = products.map(p => {
      const imgSrc = p.img || '';
      const hasImage = imgSrc && imgSrc.trim() !== '';
      return `
      <div class="product-card">
        <div style="position:relative;">
          ${hasImage ? `<img src="${imgSrc}" alt="${p.title}" onerror="this.style.background='#f1f5f9';" style="width:100%;height:170px;object-fit:cover;">` : '<div style="width:100%;height:170px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#9ca3af;">No Image</div>'}
          <div class="product-category-label">${p.category || 'premium'}</div>
        </div>
        <div class="product-body">
          <div>
            <h4 style="margin:0 0 8px 0">${p.title}</h4>
            <p style="margin:0;color:#6b7280;font-size:13px">${p.desc}</p>
          </div>
          <div class="product-footer">
            <div>
              <div style="font-weight:700;">Price per kg</div>
              <div style="color:#0f1724;font-weight:700;">₹${p.pricePerKg}</div>
              <div style="color:#16a34a;font-size:13px;margin-top:6px;">Stock: ${p.stock} kg</div>
            </div>
            <div>
              <button class="order-btn" onclick="openOrderModal('${p.id}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                Order
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    }).join('');
  } catch (err) {
    grid.innerHTML = '<div class="card muted">Failed to load store</div>';
  }
}

// Recent orders — fetch user's orders (API: /api/order/my)
async function loadRecentOrders(){
  const list = document.getElementById('recentOrdersList');
  if(!list) return;
  try {
    if(!token) throw new Error('demo');
    const res = await fetch(`${API_BASE}/order/my`, { headers: { Authorization: `Bearer ${token}` } });
    if(!res.ok) throw new Error('failed');
    const orders = await res.json();
    renderOrders(list, orders.slice(0,3));
    computeMetrics(orders);
  } catch (err) {
    // demo fallback
    const demo = [
      { _id:'ORD-001', title:'Premium Organic Compost', status:'delivered', createdAt:'2024-12-22T12:00:00Z', quantity:50, totalAmount:1500 },
      { _id:'ORD-002', title:'Vegetable Waste Compost', status:'in-transit', createdAt:'2024-12-18T12:00:00Z', quantity:100, totalAmount:2800 },
      { _id:'ORD-003', title:'Enriched Garden Compost', status:'processing', createdAt:'2024-12-15T12:00:00Z', quantity:75, totalAmount:2250 }
    ];
    renderOrders(list, demo);
    computeMetrics(demo);
  }
}

function renderOrders(container, orders){
  if(!orders || orders.length===0){
    container.innerHTML = '<p class="empty-state">No recent orders</p>';
    return;
  }
  container.innerHTML = orders.map(o => {
    const status = (o.status || '').toLowerCase();
    const statusClass = status === 'delivered' ? 'badge-delivered' : (status === 'in-transit' ? 'badge-intransit' : 'badge-processing');
    const iconClass = status === 'delivered' ? 'delivered' : (status === 'in-transit' ? 'in-transit' : 'processing');
    const date = new Date(o.createdAt || o.requestDate || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const amount = o.totalAmount ? `₹${o.totalAmount.toLocaleString('en-IN')}` : '';
    const title = o.title || o.productName || 'Compost Product';
    
    let iconSvg = '';
    if (status === 'delivered') {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (status === 'in-transit') {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path><path d="M15 18H9"></path><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"></path><circle cx="17" cy="18" r="2"></circle><circle cx="7" cy="18" r="2"></circle></svg>`;
    } else {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
    }
    
    return `
      <div class="order-item">
        <div class="order-item-left">
          <div class="order-icon ${iconClass}">
            ${iconSvg}
          </div>
          <div>
            <div style="font-weight:700;">${title}</div>
            <div class="order-meta">${date} • ${o.quantity || '--'} kg</div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="badge-status ${statusClass}">${status}</div>
          <div style="color:#16a34a;font-weight:700;margin-top:8px;">${amount}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Compute and set metrics
function computeMetrics(orders){
  try {
    const totalCompost = orders.reduce((s,o)=>s + (o.quantity||0), 0);
    const totalSpent = orders.reduce((s,o)=>s + (o.totalAmount||0), 0);
    const active = orders.filter(o => o.status && (o.status==='pending' || o.status==='confirmed' || o.status==='in-transit' || o.status==='processing')).length;
    // Amount saved: 1kg = ₹20 saved
    const amountSaved = totalCompost * 20;
    document.getElementById('metricTotalCompost').textContent = `${totalCompost} kg`;
    document.getElementById('metricTotalSpent').textContent = `₹${totalSpent}`;
    document.getElementById('metricActiveOrders').textContent = active;
    document.getElementById('metricAmountSaved').textContent = `₹${amountSaved.toLocaleString('en-IN')}`;
  } catch(e){}
}

// Order modal implementation
let currentProduct = null;
function openOrderModal(productId){
  // find product from current products (admin inventory or demo)
  const allProducts = window.currentProducts || demoProducts;
  const product = allProducts.find(p => p.id === productId);
  if(!product) return toast('Product not found', 'error');
  currentProduct = JSON.parse(JSON.stringify(product));
  renderOrderModal(currentProduct);
}

function renderOrderModal(product){
  const root = document.getElementById('orderModalRoot');
  root.style.display = 'block';
  root.innerHTML = `
    <div class="modal-backdrop" onclick="closeModalOnBackdrop(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <div>
            <h3 style="margin:0">Place Order</h3>
            <p style="margin:4px 0 0 0;color:#6b7280;font-size:13px;">Review and confirm your compost order.</p>
          </div>
          <button onclick="closeOrderModal()" style="background:none;border:0;font-size:18px;cursor:pointer;color:#6b7280;">✕</button>
        </div>

        <div class="product-row" style="margin-top:12px;">
          <img class="product-thumb" src="${product.img}" onerror="this.style.background='#f1f5f9'"/>
          <div style="flex:1;">
            <div style="font-weight:700">${product.title}</div>
            <div style="color:#6b7280;font-size:13px;margin-top:6px;">${product.desc}</div>

            <div style="margin-top:12px;background:#f8fafc;border-radius:8px;padding:10px;">
              <div class="row-between"><div>Price per kg</div><div style="font-weight:700">₹${product.pricePerKg}</div></div>
              <div class="row-between" style="margin-top:8px;"><div>Available Stock</div><div style="font-weight:700">${product.stock} kg</div></div>
            </div>

            <div style="margin-top:12px;">
              <label style="font-weight:700;font-size:13px;">Order Quantity (kg)</label>
              <div class="qty-control">
              <button onclick="changeQty(-1)">−</button>
                <input id="orderQty" type="number" value="1" min="1" max="${product.stock}" style="width:80px;padding:8px;border-radius:8px;border:1px solid #e6e6e6;text-align:center;font-weight:600;">
                <button onclick="changeQty(1)">+</button>
              </div>
            </div>

            <div style="margin-top:12px;">
              <label style="font-weight:700;font-size:13px;">Delivery Address</label>
              <input id="orderAddress" type="text" placeholder="Enter delivery address" style="width:100%;padding:10px;border-radius:8px;border:1px solid #e6e6e6;margin-top:8px;" value="Farm Plot 23, Village Road, Belagavi">
              
              <!-- ✅ ADD LOCATION PICKER BUTTON -->
              <button type="button" class="btn-secondary" onclick="showFarmerLocationPicker()" style="width:100%;margin-top:8px;padding:10px;display:flex;align-items:center;justify-content:center;gap:8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                📍 Select Delivery Location on Map
              </button>
            </div>
          </div>
        </div>

        <div class="summary">
          <div class="row-between"><div>Subtotal:</div><div id="subtotal" style="font-weight:600;">₹${product.pricePerKg}</div></div>
          <div class="row-between" style="margin-top:6px;font-weight:700;font-size:16px;"><div>Total Amount:</div><div id="totalAmount" style="color:#16a34a;">₹${product.pricePerKg}</div></div>
        </div>

        <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end;">
          <button class="btn" onclick="closeOrderModal()" style="padding:10px 20px;border:1px solid #e6e6e6;background:#fff;border-radius:8px;cursor:pointer;">Cancel</button>
          <button class="btn btn-primary" onclick="confirmOrder()" style="padding:10px 20px;background:#0f1724;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Confirm Order</button>
        </div>
      </div>
    </div>
  `;
  recalcTotals();
}

function closeModalOnBackdrop(e){
  // close if clicked backdrop
  const root = document.getElementById('orderModalRoot');
  root.style.display = 'none';
  root.innerHTML = '';
  currentProduct = null;
}

function closeOrderModal(){
  const root = document.getElementById('orderModalRoot');
  root.style.display = 'none';
  root.innerHTML = '';
  currentProduct = null;
}

function changeQty(delta){
  const qtyInput = document.getElementById('orderQty');
  if(!qtyInput) return;
  let v = Number(qtyInput.value) || 0;
  v += delta;
  if(v < 1) v = 1;
  if(currentProduct && v > currentProduct.stock) v = currentProduct.stock;
  qtyInput.value = v;
  recalcTotals();
}

function recalcTotals(){
  const qtyInput = document.getElementById('orderQty');
  if(!qtyInput || !currentProduct) return;
  const qty = Number(qtyInput.value) || 0;
  const subtotal = qty * currentProduct.pricePerKg;
  document.getElementById('subtotal').textContent = `₹${subtotal}`;
  document.getElementById('totalAmount').textContent = `₹${subtotal}`; // delivery free in demo
}

// Confirm order -> POST /api/order (requires auth)
async function confirmOrder() {
  const qty = Number(document.getElementById('orderQty').value) || 0;
  const address = document.getElementById('orderAddress').value || 'Not provided';

  if (qty <= 0) return toast('Enter valid quantity', 'error');
  if (qty > currentProduct.stock) return toast('Quantity exceeds stock', 'error');

  const payload = {
    compostName: currentProduct.title || currentProduct.name || currentProduct.productName,  // ⭐ SEND COMPOST NAME
    quantity: qty,
    deliveryAddress: address,
    pricePerKg: currentProduct.pricePerKg,
    totalAmount: qty * currentProduct.pricePerKg
  };

  // If farmer selected location on map
  if (window.farmerDeliveryCoords) {
    payload.lat = window.farmerDeliveryCoords.lat;
    payload.lon = window.farmerDeliveryCoords.lon;
  }

  try {
    const res = await fetch(`${API_BASE}/order`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    toast("Order placed successfully");
    closeOrderModal();
    loadRecentOrders();

  } catch (err) {
    toast("Order placed (demo)", "success");
    closeOrderModal();
  }
}

// Section switching function
function showSection(sectionName){
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  
  // Show selected section
  const section = document.getElementById(`${sectionName}-section`);
  if(section) section.classList.add('active');
  
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    const linkSection = link.getAttribute('data-section');
    if(linkSection === sectionName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  // Load data when switching sections
  if(sectionName === 'store') {
    loadStore();
  } else if(sectionName === 'order-history') {
    loadOrderHistory();
  }
}

function scrollToStore(){
  showSection('store');
}

function openOrderHistory(){
  showSection('order-history');
}

// small helpers for navigation
function logout(){
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

// Order History Functions (merged from order-history.js)
function formatDate(dateStr){
  try { 
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch(e){ return dateStr || ''; }
}

function badgeForStatus(status){
  const s = (status || '').toLowerCase();
  if(s === 'delivered') return '<span class="badge delivered">delivered</span>';
  if(s === 'confirmed' || s === 'in-transit' || s === 'processing') {
    if(s === 'in-transit') return '<span class="badge in-transit">in-transit</span>';
    if(s === 'processing') return '<span class="badge processing">processing</span>';
    return `<span class="badge">${s}</span>`;
  }
  if(s === 'pending') return '<span class="badge processing">pending</span>';
  return `<span class="badge">${s}</span>`;
}

async function loadOrderHistory(){
  const container = document.getElementById('orderList');
  if(!container) return;
  container.innerHTML = '<div class="empty-state">Loading orders…</div>';
  try {
    if(!token) throw new Error('demo');
    const res = await fetch(`${API_BASE}/order/my`, { headers: { Authorization: `Bearer ${token}` }});
    if(!res.ok) throw new Error('Failed to fetch orders');
    const orders = await res.json();
    renderOrderHistory(container, orders);
  } catch (err) {
    // Demo fallback similar to screenshot
    const demo = [
      { _id:'ORD-001', productName:'Premium Organic Compost', status:'delivered', createdAt:'2024-12-22T10:00:00Z', quantity:50, totalAmount:1500 },
      { _id:'ORD-002', productName:'Vegetable Waste Compost', status:'in-transit', createdAt:'2024-12-18T10:00:00Z', quantity:100, totalAmount:2800 },
      { _id:'ORD-003', productName:'Enriched Garden Compost', status:'processing', createdAt:'2024-12-15T10:00:00Z', quantity:75, totalAmount:2250 },
      { _id:'ORD-004', productName:'Premium Organic Compost', status:'delivered', createdAt:'2024-11-30T10:00:00Z', quantity:50, totalAmount:1500 }
    ];
    renderOrderHistory(container, demo);
  }
}

function renderOrderHistory(container, orders){
  if(!orders || orders.length === 0){
    container.innerHTML = '<div class="empty-state">No orders found</div>';
    return;
  }
  // map fields: our backend uses quantity, pricePerKg, totalAmount
  const listHtml = orders.map(o => {
    const title = o.productName || (o.itemName || 'Compost Product');
    const status = o.status || 'pending';
    const date = formatDate(o.createdAt || o.created_at || new Date());
    const qty = o.quantity || o.qty || '--';
    const amount = (o.totalAmount || o.total_price || o.price || 0);
    const orderId = o._id || o.id || '—';
    return `
      <div class="order-row">
        <div class="order-left">
          <div>
            <div class="order-title">${title}</div>
            <div class="order-meta">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Order ID: ${orderId} • Order Date: ${date}
            </div>
          </div>
        </div>
        <div class="order-right">
          ${badgeForStatus(status)}
          <div class="price">${amount ? '₹' + amount.toLocaleString('en-IN') : ''}</div>
          <div class="qty">${qty} kg</div>
        </div>
      </div>
    `;
  }).join('');
  container.innerHTML = listHtml;
}

// boot
document.addEventListener('DOMContentLoaded', ()=>{
  if(!ensureAuth()) return;
  loadStore();
  loadRecentOrders();

  // Setup navigation links
  document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      if(section) showSection(section);
    });
  });

  // Handle hash navigation on page load
  if(window.location.hash === '#store') {
    showSection('store');
  }

  // search and filter basic handlers
  const search = document.getElementById('searchInput');
  const cat = document.getElementById('categoryFilter');
  
  function filterAndRenderProducts() {
    const q = search ? search.value.toLowerCase() : '';
    const catVal = cat ? cat.value : '';
    const allProducts = window.currentProducts || demoProducts;
    
    let filtered = allProducts;
    if (q) {
      filtered = filtered.filter(p => (p.title || '').toLowerCase().includes(q) || (p.desc || '').toLowerCase().includes(q));
    }
    if (catVal) {
      filtered = filtered.filter(p => (p.category || '') === catVal);
    }
    
    const grid = document.getElementById('storeGrid');
    if (!grid) return;
    
    grid.innerHTML = filtered.map(p => {
      const imgSrc = p.img || '';
      const hasImage = imgSrc && imgSrc.trim() !== '';
      return `
        <div class="product-card">
          <div style="position:relative;">
            ${hasImage ? `<img src="${imgSrc}" alt="${p.title}" onerror="this.style.background='#f1f5f9';" style="width:100%;height:170px;object-fit:cover;">` : '<div style="width:100%;height:170px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#9ca3af;">No Image</div>'}
            <div class="product-category-label">${p.category || 'premium'}</div>
          </div>
          <div class="product-body">
            <div>
              <h4 style="margin:0 0 8px 0">${p.title}</h4>
              <p style="margin:0;color:#6b7280;font-size:13px">${p.desc}</p>
            </div>
            <div class="product-footer">
              <div>
                <div style="font-weight:700;">Price per kg</div>
                <div style="color:#0f1724;font-weight:700;">₹${p.pricePerKg}</div>
                <div style="color:#16a34a;font-size:13px;margin-top:6px;">Stock: ${p.stock} kg</div>
              </div>
              <div>
                <button class="order-btn" onclick="openOrderModal('${p.id}')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                  </svg>
                  Order
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  if(search) {
    search.addEventListener('input', filterAndRenderProducts);
  }
  if(cat){
    cat.addEventListener('change', filterAndRenderProducts);
  }
  

  // ============================================
// FARMER LOCATION PICKER FOR DELIVERY
// ============================================

let farmerLocationPickerMap = null;
let farmerSelectedMarker = null;
let farmerSelectedCoords = null;

function showFarmerLocationPicker() {
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
        toast('Map library not loaded. Please refresh the page.', 'error');
        console.error('Leaflet (L) is not defined');
        return;
    }

    const modal = document.getElementById('farmerLocationPickerModal');
    if (!modal) {
        console.error('Farmer location picker modal not found');
        return;
    }
    
    modal.style.display = 'block';
    
    setTimeout(() => {
        try {
            if (!farmerLocationPickerMap) {
                farmerLocationPickerMap = L.map('farmerLocationPickerMap').setView([15.860888802973438,74.50410617670109], 12);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19
                }).addTo(farmerLocationPickerMap);
                
                // Add custom control for instructions
                const instructionDiv = L.DomUtil.create('div', 'leaflet-control');
                instructionDiv.style.cssText = 'background:white;padding:12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);margin:10px;max-width:250px;';
                instructionDiv.innerHTML = '<strong style="color:#0f1724;">📍 Click anywhere on the map</strong><br><span style="color:#64748b;font-size:12px;">Mark your exact farm/delivery location</span>';
                farmerLocationPickerMap.getContainer().appendChild(instructionDiv);
                
                // Click to set location
                farmerLocationPickerMap.on('click', function(e) {
                    if (farmerSelectedMarker) {
                        farmerLocationPickerMap.removeLayer(farmerSelectedMarker);
                    }
                    
                    farmerSelectedCoords = e.latlng;
                    
                    // Custom marker icon
                    const customIcon = L.divIcon({
                        html: `<div style="background:#16a34a;border:3px solid white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
                        className: '',
                        iconSize: [32, 32]
                    });
                    
                    farmerSelectedMarker = L.marker(farmerSelectedCoords, { icon: customIcon })
                        .bindPopup(`
                            <div style="text-align:center;">
                                <strong style="color:#16a34a;">✓ Delivery Location</strong><br>
                                <span style="font-size:12px;color:#64748b;">Lat: ${farmerSelectedCoords.lat.toFixed(6)}<br>Lon: ${farmerSelectedCoords.lng.toFixed(6)}</span>
                            </div>
                        `)
                        .addTo(farmerLocationPickerMap)
                        .openPopup();
                    
                    console.log('Selected delivery coordinates:', farmerSelectedCoords);
                });
                
                console.log('✅ Farmer location picker map initialized');
            } else {
                farmerLocationPickerMap.invalidateSize();
            }
        } catch (error) {
            console.error('Error initializing farmer location picker:', error);
            toast('Failed to initialize map. Please try again.', 'error');
        }
    }, 100);
}

function closeFarmerLocationPicker() {
    const modal = document.getElementById('farmerLocationPickerModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function confirmFarmerLocation() {
    if (!farmerSelectedCoords) {
        toast('Please click on the map to select a delivery location', 'error');
        return;
    }
    
    // Store coordinates to be used in order submission
    window.farmerDeliveryCoords = {
        lat: farmerSelectedCoords.lat,
        lon: farmerSelectedCoords.lng
    };
    
    toast('Delivery location selected successfully!', 'success');
    closeFarmerLocationPicker();
    
    // Update address field with coordinates (optional)
    const addressInput = document.getElementById('orderAddress');
    if (addressInput && addressInput.value.trim()) {
        console.log('✅ Location saved for:', addressInput.value);
    }
}

// Make functions global
window.showFarmerLocationPicker = showFarmerLocationPicker;
window.closeFarmerLocationPicker = closeFarmerLocationPicker;
window.confirmFarmerLocation = confirmFarmerLocation;


  // Listen for inventory updates from admin
  window.addEventListener('storage', function(e) {
    if (e.key === 'admin_inventory_catalog') {
      loadStore();
    }
  });
  
  window.addEventListener('inventoryUpdated', function(e) {
    loadStore();
  });
});
