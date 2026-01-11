const API_BASE_URL = 'https://waste2wealth-8rio.onrender.com/api';
const token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');


document.addEventListener('DOMContentLoaded', () => {
	// Check if Leaflet is available
	if (typeof L === 'undefined') {
		console.error('❌ Leaflet library failed to load!');
		console.log('Attempting to load Leaflet dynamically...');

		// Try loading it dynamically as fallback
		const leafletCSS = document.createElement('link');
		leafletCSS.rel = 'stylesheet';
		leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
		document.head.appendChild(leafletCSS);

		const leafletJS = document.createElement('script');
		leafletJS.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
		leafletJS.onload = () => {
			console.log('✅ Leaflet loaded dynamically');
		};
		leafletJS.onerror = () => {
			console.error('❌ Failed to load Leaflet dynamically');
		};
		document.head.appendChild(leafletJS);
	} else {
		console.log('✅ Leaflet loaded successfully');
	}

	// Continue with rest of initialization
	checkAuth();
	setupEventListeners();
	// ... rest of your code
});

// Location Picker for Manual Selection
// Location Picker for Manual Selection
let locationPickerMap = null;
let selectedMarker = null;
let selectedCoords = null;

function showLocationPicker() {
	// ✅ Check if Leaflet is loaded
	if (typeof L === 'undefined') {
		showToast('Map library not loaded. Please refresh the page.', 'error');
		console.error('Leaflet (L) is not defined. Check if script loaded correctly.');
		return;
	}

	const modal = document.getElementById('locationPickerModal');
	if (!modal) {
		console.error('Location picker modal not found');
		return;
	}

	modal.style.display = 'block';

	setTimeout(() => {
		try {
			if (!locationPickerMap) {
				locationPickerMap = L.map('locationPickerMap').setView([15.860888802973438, 74.50410617670109], 13);

				L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '© OpenStreetMap contributors',
					maxZoom: 19
				}).addTo(locationPickerMap);

				// Click to set location
				locationPickerMap.on('click', function (e) {
					if (selectedMarker) {
						locationPickerMap.removeLayer(selectedMarker);
					}

					selectedCoords = e.latlng;
					selectedMarker = L.marker(selectedCoords).addTo(locationPickerMap);

					console.log('Selected coordinates:', selectedCoords);
				});

				console.log('✅ Location picker map initialized');
			} else {
				locationPickerMap.invalidateSize();
			}
		} catch (error) {
			console.error('Error initializing location picker:', error);
			showToast('Failed to initialize map. Please try again.', 'error');
		}
	}, 100);
}

function closeLocationPicker() {
	const modal = document.getElementById('locationPickerModal');
	if (modal) {
		modal.style.display = 'none';
	}
}

function confirmLocation() {
	if (!selectedCoords) {
		showToast('Please click on the map to select a location', 'error');
		return;
	}

	// Store coordinates to be used in form submission
	window.manualCoords = {
		lat: selectedCoords.lat,
		lon: selectedCoords.lng
	};

	showToast('Location selected successfully!');
	closeLocationPicker();
}

// ✅ Make these functions global
window.showLocationPicker = showLocationPicker;
window.closeLocationPicker = closeLocationPicker;
window.confirmLocation = confirmLocation;


// Toasts
function showToast(message, type = 'success') {
	const container = document.getElementById('toastContainer');
	if (!container) return alert(message);
	const el = document.createElement('div');
	el.className = `toast ${type}`;
	el.innerHTML = `<span style="font-weight:700;font-size:20px;">${type === 'success' ? '✓' : '✕'}</span><span>${message}</span>`;
	container.appendChild(el);
	setTimeout(() => { el.style.animation = 'slideOut 0.3s ease'; setTimeout(() => el.remove(), 300); }, 3000);
}

// Auth - Require real login
function checkAuth() {
	if (!token || !currentUser || currentUser.role !== 'household') {
		alert('Please login as a household user');
		window.location.href = 'index.html';
		return;
	}
	displayUserInfo(currentUser);
	loadPoints(); // Fetch fresh points from database
}

// Display user info
function displayUserInfo(user) {
	const name = user.name || 'Household';
	const points = user.rewardPoints || 0;
	const initial = name.charAt(0).toUpperCase();
	const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
	setText('userName', name);
	setText('userInitial', initial);
	setText('totalPoints', points);
	setText('metricPoints', points);
	const avail = document.getElementById('availablePointsDisplay');
	if (avail) avail.textContent = `${points} Available Points`;
}

// Load points from database
async function loadPoints() {
	try {
		const res = await fetch(`${API_BASE_URL}/users/me`, {
			headers: { Authorization: `Bearer ${token}` }
		});

		if (!res.ok) {
			if (res.status === 401) {
				// Token expired or invalid
				localStorage.removeItem('token');
				localStorage.removeItem('user');
				alert('Session expired. Please login again.');
				window.location.href = 'index.html';
				return;
			}
			throw new Error('Failed to load user data');
		}

		const data = await res.json();
		currentUser = { ...currentUser, ...data };
		localStorage.setItem('user', JSON.stringify(currentUser));
		displayUserInfo(currentUser);
	} catch (err) {
		console.error('Error loading points:', err);
		showToast('Failed to load user data', 'error');
	}
}

// Sections
function showSection(section) {
	document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
	const el = document.getElementById(`${section}-section`);
	if (el) el.classList.add('active');

	document.querySelectorAll('.nav-link').forEach(a => {
		a.classList.toggle('active', a.getAttribute('data-section') === section);
	});

	if (section === 'dashboard') {
		loadRecentPickups();
	} else if (section === 'pickup-history') {
		loadPickupHistory();
	} else if (section === 'rewards') {
		loadRewards();
		loadRedemptionHistory();
	}

	// ✅ PRELOAD AI MODEL
	if (section === 'request-pickup' && window.loadModel) {
		console.log('Preloading AI model...');
		window.loadModel();
	}
}

// Handle pickup request
// Handle pickup request
async function handlePickupRequest(e) {
	e.preventDefault();

	// ✅ REMOVED MANDATORY AI CHECK
	// if (!window.isWasteOrganic || !window.isWasteOrganic()) {
	// 	showToast('⚠️ Please classify your waste as organic before scheduling pickup', 'error');
	// 	return;
	// }

	const quantity = parseFloat(document.getElementById('quantity').value) || 0;
	const wasteType = document.getElementById('wasteType').value;
	const address = document.getElementById('address').value.trim();
	const pickupDate = document.getElementById('pickupDate').value;
	const pickupTime = document.getElementById('pickupTime').value;

	if (quantity <= 0) return showToast('Enter valid quantity', 'error');
	if (!wasteType) return showToast('Select waste type', 'error');
	if (!address) return showToast('Enter address', 'error');
	if (!pickupDate || !pickupTime) return showToast('Select date & time', 'error');

	const payload = {
		quantity,
		wasteType,
		address,
		pickupDate,
		pickupTime
	};

	if (window.manualCoords) {
		payload.lat = window.manualCoords.lat;
		payload.lon = window.manualCoords.lon;
		console.log('Using manual coordinates:', payload.lat, payload.lon);
	}

	try {
		const res = await fetch(`${API_BASE_URL}/pickup/request`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			body: JSON.stringify(payload)
		});

		const data = await res.json();
		if (!res.ok) return showToast(data.message || 'Failed', 'error');

		showToast('Pickup requested successfully!');
		document.getElementById('pickupForm').reset();
		window.manualCoords = null;

		// ✅ RESET AI CLASSIFICATION FLAG
		if (window.isWasteOrganic) {
			isWasteOrganic = false;
		}

		// ✅ RESET SUBMIT BUTTON (Stay enabled for optional classification)
		const submitBtn = document.querySelector('#pickupForm button[type="submit"]');
		if (submitBtn) {
			submitBtn.disabled = false;
			submitBtn.textContent = 'Schedule Pickup';
			submitBtn.style.background = 'var(--primary-green)';
		}

		// ✅ CLEAR AI RESULT
		const aiResult = document.getElementById('aiResult');
		if (aiResult) {
			aiResult.innerHTML = '';
		}

		setTimeout(() => {
			showSection('dashboard');
			loadRecentPickups();
		}, 800);
	} catch (err) {
		console.error('Pickup request error:', err);
		showToast('Failed to submit pickup request', 'error');
	}
}

// Load recent pickups
async function loadRecentPickups() {
	try {
		const res = await fetch(`${API_BASE_URL}/pickup/my`, {
			headers: { Authorization: `Bearer ${token}` }
		});

		if (!res.ok) throw new Error('Failed to load pickups');
		const pickups = await res.json();
		renderRecentPickups(Array.isArray(pickups) ? pickups : []);
	} catch (err) {
		console.error('Error loading pickups:', err);
		renderRecentPickups([]);
	}
}

function renderRecentPickups(list) {
	const container = document.getElementById('recentPickups');
	if (!container) return;
	const sorted = list.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate)).slice(0, 3);
	if (!sorted.length) {
		container.innerHTML = '<p class="empty-state">No pickups yet</p>';
		return;
	}
	container.innerHTML = sorted.map(p => `
		<div class="pickup-item">
			<div class="pickup-details">
				<div class="pickup-description">${new Date(p.requestDate).toLocaleDateString()}</div>
				<div class="pickup-meta">${(p.quantity || 0)} kg • ${p.status}</div>
			</div>
			${p.pointsAwarded ? `<div class="pickup-points">+${p.pointsAwarded} pts</div>` : ''}
		</div>
	`).join('');

	// Metrics
	const totalWaste = list.filter(p => p.status === 'completed').reduce((s, p) => s + (p.quantity || 0), 0);
	const completed = list.filter(p => p.status === 'completed').length;
	const co2 = (totalWaste * 0.8).toFixed(1);
	const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
	setText('metricWaste', `${totalWaste.toFixed(1)} kg`);
	setText('metricPickups', completed);
	setText('metricCO2', `${co2} kg`);
}

// Load pickup history
async function loadPickupHistory() {
	try {
		const res = await fetch(`${API_BASE_URL}/pickup/my`, {
			headers: { Authorization: `Bearer ${token}` }
		});

		if (!res.ok) throw new Error('Failed to load history');
		const pickups = await res.json();
		renderHistory(Array.isArray(pickups) ? pickups : []);
	} catch (err) {
		console.error('Error loading history:', err);
		renderHistory([]);
	}
}

function renderHistory(list) {
	const upcoming = document.getElementById('upcomingPickups');
	const past = document.getElementById('pastPickups');
	if (!upcoming || !past) return;

	const future = list.filter(p => p.status !== 'completed' && p.status !== 'rejected');
	const done = list.filter(p => p.status === 'completed');
	const rejected = list.filter(p => p.status === 'rejected');

	upcoming.innerHTML = future.length ? future.map(card).join('') : '<p class="empty-state">No upcoming pickups</p>';
	past.innerHTML = (done.length || rejected.length) ? [...done, ...rejected].map(card).join('') : '<p class="empty-state">No past pickups</p>';

	function getStatusBadge(status) {
		const statusLower = (status || 'pending').toLowerCase();
		const badges = {
			pending: '<span style="background:#fff7ed;color:#c2410c;padding:4px 8px;border-radius:6px;font-size:12px;font-weight:600;">Pending</span>',
			processing: '<span style="background:#eef2ff;color:#3730a3;padding:4px 8px;border-radius:6px;font-size:12px;font-weight:600;">Processing</span>',
			picked: '<span style="background:#f5f3ff;color:#6d28d9;padding:4px 8px;border-radius:6px;font-size:12px;font-weight:600;">Picked</span>',
			completed: '<span style="background:#ecfdf5;color:#166534;padding:4px 8px;border-radius:6px;font-size:12px;font-weight:600;">Completed</span>',
			rejected: '<span style="background:#fee2e2;color:#b91c1c;padding:4px 8px;border-radius:6px;font-size:12px;font-weight:600;">Rejected</span>'
		};
		return badges[statusLower] || badges.pending;
	}

	function card(p) {
		const status = p.status || 'pending';
		const statusBadge = getStatusBadge(status);
		const requestDate = p.requestDate ? new Date(p.requestDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
		return `
			<div class="pickup-item">
				<div class="pickup-details">
					<div class="pickup-description">Request Date: ${requestDate}</div>
					<div class="pickup-meta">${(p.quantity || 0)} kg • ${p.wasteType || 'Mixed Organic Waste'}</div>
					${p.pickupDate ? `<div class="pickup-meta">Scheduled: ${p.pickupDate} ${p.pickupTime || ''}</div>` : ''}
					${p.address ? `<div class="pickup-meta" style="color:#6b7280;">Address: ${p.address}</div>` : ''}
					<div style="margin-top:8px;">${statusBadge}</div>
				</div>
				<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
					${p.pointsAwarded ? `<div class="pickup-points">+${p.pointsAwarded} pts</div>` : ''}
				</div>
			</div>
		`;
	}
}

// Load rewards
async function loadRewards() {
	let rewards = [];
	try {
		const res = await fetch(`${API_BASE_URL}/rewards`);
		if (!res.ok) throw new Error('Failed to load rewards');
		const data = await res.json();
		if (Array.isArray(data) && data.length > 0) {
			rewards = data.map(r => ({
				id: r._id || r.id,
				title: r.title || 'Reward',
				cost: r.points || 0,
				description: r.description || '',
				image: r.image || ''
			}));
		}
	} catch (err) {
		console.error('Error loading rewards:', err);
		// Try admin local storage as fallback
		try {
			const adminRewards = JSON.parse(localStorage.getItem('admin_reward_catalog') || 'null');
			if (Array.isArray(adminRewards) && adminRewards.length > 0) {
				rewards = adminRewards.map(r => ({
					id: r.id || `reward-${Date.now()}-${Math.random()}`,
					title: r.title || 'Reward',
					cost: r.points || 0,
					description: r.description || '',
					image: r.image || ''
				}));
			}
		} catch (_) { }
	}

	const grid = document.getElementById('rewardsGrid');
	if (!grid) return;

	if (rewards.length === 0) {
		grid.innerHTML = '<div class="empty-state">No rewards available</div>';
		return;
	}

	grid.innerHTML = rewards.map(r => {
		const title = (r.title || 'Reward').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		const desc = (r.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		const imageSrc = r.image || '';
		const hasImage = imageSrc && imageSrc.trim() !== '';

		return `
		<div class="reward-card">
			${hasImage ? `<img src="${imageSrc}" alt="${title}" class="reward-image" onerror="this.style.display='none';" style="width:100%;height:200px;object-fit:cover;border-radius:12px 12px 0 0;">` : '<div class="reward-image-placeholder" style="width:100%;height:200px;background:#f3f4f6;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center;color:#9ca3af;">No Image</div>'}
			<div class="reward-content">
				<h3>${title}</h3>
				${desc ? `<p style="color:#6b7280;font-size:14px;margin:8px 0;">${desc}</p>` : ''}
				<div class="reward-cost"><span>${r.cost} pts</span></div>
				<button class="reward-redeem-btn" onclick="redeemReward('${r.id}', ${r.cost})" ${(currentUser?.rewardPoints || 0) < r.cost ? 'disabled' : ''}>Redeem</button>
			</div>
		</div>
		`;
	}).join('');
}

// Redeem reward - Database version
async function redeemReward(id, cost) {
	if (!confirm(`Redeem this reward for ${cost} points?`)) return;
	// Check for insufficient points
	const currentPoints = currentUser?.rewardPoints || 0;
	if (currentPoints < cost) {
		const diff = cost - currentPoints;
		showToast(`Insufficient points: You need ${diff} more points to redeem this.`, 'error');
		return;
	}

	try {
		const res = await fetch(`${API_BASE_URL}/redemptions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			body: JSON.stringify({ rewardId: id })
		});

		const data = await res.json();
		if (!res.ok) return showToast(data.message || 'Redemption failed', 'error');

		// Update local user data
		currentUser.rewardPoints = data.remainingPoints;
		localStorage.setItem('user', JSON.stringify(currentUser));
		displayUserInfo(currentUser);

		showToast('Reward redeemed successfully!');
		loadRewards(); // Refresh to update button states
		loadRedemptionHistory(); // Refresh history
	} catch (err) {
		console.error('Redemption error:', err);
		showToast('Failed to redeem reward', 'error');
	}
}

// Load redemption history from database
async function loadRedemptionHistory() {
	const container = document.getElementById('redemptionHistory');
	if (!container) return;

	try {
		const res = await fetch(`${API_BASE_URL}/redemptions/my-history`, {
			headers: { Authorization: `Bearer ${token}` }
		});

		if (!res.ok) throw new Error('Failed to load history');
		const history = await res.json();

		if (!history.length) {
			container.innerHTML = '<p class="empty-state">No redemption history yet</p>';
			return;
		}

		container.innerHTML = history.map(item => `
			<div class="pickup-item">
				<div class="pickup-details">
					<div class="pickup-description">${item.rewardTitle}</div>
					<div class="pickup-meta">Redeemed: ${new Date(item.redeemedAt).toLocaleDateString()}</div>
				</div>
				<div class="pickup-points" style="color:#dc2626;">-${item.pointsSpent} pts</div>
			</div>
		`).join('');
	} catch (err) {
		console.error('Error loading redemption history:', err);
		container.innerHTML = '<p class="empty-state">Failed to load history</p>';
	}
}

// Setup event listeners
function setupEventListeners() {
	document.querySelectorAll('.nav-link').forEach(link => {
		link.addEventListener('click', (e) => {
			e.preventDefault();
			showSection(e.currentTarget.getAttribute('data-section'));
		});
	});
	const form = document.getElementById('pickupForm');
	if (form) form.addEventListener('submit', handlePickupRequest);
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
	checkAuth();
	setupEventListeners();

	// Listen for rewards updates from admin
	window.addEventListener('storage', function (e) {
		if (e.key === 'admin_reward_catalog') {
			loadRewards();
		}
	});

	window.addEventListener('rewardsUpdated', function (e) {
		loadRewards();
	});

	showSection('dashboard');
	loadRecentPickups();
	loadRewards();
	loadRedemptionHistory();
});

document.addEventListener('DOMContentLoaded', () => {
	checkAuth();
	setupEventListeners();

	// ✅ INITIALIZE SUBMIT BUTTON AS ENABLED (Optional Classification)
	const submitBtn = document.querySelector('#pickupForm button[type="submit"]');
	if (submitBtn) {
		submitBtn.disabled = false;
		submitBtn.textContent = 'Schedule Pickup';
		submitBtn.style.background = 'var(--primary-green)';
	}

	showSection('dashboard');
	loadRecentPickups();
	loadRewards();
	loadRedemptionHistory();
});

// Logout
function logout() {
	localStorage.removeItem('token');
	localStorage.removeItem('user');
	window.location.href = 'index.html';
}