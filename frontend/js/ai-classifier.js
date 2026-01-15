let mobilenetModel = null;
let modelLoaded = false;
let modelLoadingPromise = null;
let isWasteOrganic = false;

async function loadModel() {
  if (modelLoaded) return;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      console.log('⏳ Loading MobileNet...');

      // ✅ FORCE SPECIFIC MODEL VERSION AND BACKEND
      await tf.setBackend('webgl'); // Force WebGL backend
      await tf.ready();

      console.log('🔧 TensorFlow backend:', tf.getBackend());
      console.log('📱 Device info:', navigator.userAgent);

      // Load MobileNet v2 (more consistent across devices)
      mobilenetModel = await mobilenet.load({
        version: 2,
        alpha: 1.0 // Full precision
      });

      modelLoaded = true;
      console.log('✅ MobileNet loaded successfully');
      showToast('AI model ready', 'success');
    } catch (err) {
      console.error('❌ Error loading MobileNet:', err);

      // Fallback to CPU backend
      try {
        console.log('⚠️ Trying CPU backend...');
        await tf.setBackend('cpu');
        await tf.ready();

        mobilenetModel = await mobilenet.load({
          version: 2,
          alpha: 1.0
        });

        modelLoaded = true;
        console.log('✅ MobileNet loaded (CPU mode)');
        showToast('AI model ready (CPU mode)', 'success');
      } catch (fallbackErr) {
        console.error('❌ Failed to load model:', fallbackErr);
        showToast('AI model failed to load', 'error');
        modelLoadingPromise = null;
        throw fallbackErr;
      }
    }
  })();

  return modelLoadingPromise;
}

async function onClassifyClick() {
  const input = document.getElementById('wasteImage');
  if (!input || !input.files || !input.files.length) {
    return showToast('Please choose an image file first', 'error');
  }
  await classifyFile(input.files[0]);
}

// ✅ NORMALIZE IMAGE TO EXACT SAME FORMAT
async function normalizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        console.log('📐 Original image:', {
          width: img.width,
          height: img.height,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight
        });

        // ✅ CREATE STANDARDIZED 224x224 IMAGE
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', {
          alpha: false,
          willReadFrequently: false
        });

        // MobileNet expects 224x224
        canvas.width = 224;
        canvas.height = 224;

        // Calculate scaling to maintain aspect ratio
        const scale = Math.max(224 / img.width, 224 / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        // Center crop
        const x = (224 - scaledWidth) / 2;
        const y = (224 - scaledHeight) / 2;

        // Fill with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 224, 224);

        // Draw image
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

        // ✅ NORMALIZE PIXEL VALUES (critical for consistency)
        const imageData = ctx.getImageData(0, 0, 224, 224);
        const data = imageData.data;

        // Apply standard normalization (-1 to 1 range)
        for (let i = 0; i < data.length; i += 4) {
          // Normalize RGB values to [-1, 1] range
          data[i] = (data[i] / 127.5) - 1;     // R
          data[i + 1] = (data[i + 1] / 127.5) - 1; // G
          data[i + 2] = (data[i + 2] / 127.5) - 1; // B
          // Keep alpha as is
        }

        // Convert back to [0, 255] for display
        const displayData = new Uint8ClampedArray(data.length);
        for (let i = 0; i < data.length; i += 4) {
          displayData[i] = (data[i] + 1) * 127.5;
          displayData[i + 1] = (data[i + 1] + 1) * 127.5;
          displayData[i + 2] = (data[i + 2] + 1) * 127.5;
          displayData[i + 3] = data[i + 3];
        }

        const displayImageData = new ImageData(displayData, 224, 224);
        const displayCanvas = document.createElement('canvas');
        displayCanvas.width = 224;
        displayCanvas.height = 224;
        displayCanvas.getContext('2d').putImageData(displayImageData, 0, 0);

        resolve({
          canvas: canvas,
          displayUrl: displayCanvas.toDataURL('image/jpeg', 1.0)
        });
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function classifyFile(file) {
  const resultBox = document.getElementById('aiResult');
  resultBox.innerHTML = '🔄 Processing image...';

  const submitBtn = document.querySelector('#pickupForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Analyzing waste...';
  }

  if (!modelLoaded) {
    resultBox.innerHTML = '⏳ Loading AI model...';
    await loadModel();
  }

  try {
    console.log('📸 Normalizing image...');
    const normalized = await normalizeImage(file);

    console.log('🤖 Classifying with MobileNet...');
    console.log('🔧 TensorFlow backend:', tf.getBackend());

    // ✅ CLASSIFY USING CANVAS DIRECTLY
    const predictions = await mobilenetModel.classify(normalized.canvas, 15);

    console.log('🔍 Raw predictions:', predictions);

    // Log device info for debugging
    console.log('📱 Classification context:', {
      userAgent: navigator.userAgent.substring(0, 100),
      backend: tf.getBackend(),
      platform: navigator.platform,
      screenSize: `${window.screen.width}x${window.screen.height}`
    });

    await analyzeAndDisplay(predictions, normalized.displayUrl, file.name);

  } catch (err) {
    console.error('❌ Classification error:', err);
    resultBox.innerHTML = `<p>❌ Error: ${err.message}</p>`;
    enableSubmitBtn();
  }
}

async function analyzeAndDisplay(predictions, imageUrl, fileName) {
  const resultBox = document.getElementById('aiResult');

  // Enhanced keywords
  const compostKeywords = [
    'banana', 'apple', 'orange', 'lemon', 'mango', 'pear', 'pineapple',
    'strawberry', 'grapes', 'watermelon', 'peach', 'plum', 'kiwi',
    'vegetable', 'potato', 'tomato', 'cabbage', 'onion', 'carrot',
    'broccoli', 'cauliflower', 'cucumber', 'lettuce', 'spinach', 'pepper',
    'squash', 'zucchini', 'eggplant', 'pumpkin', 'corn', 'mushroom',
    'food', 'salad', 'pizza', 'sandwich', 'bread', 'rice', 'pasta',
    'soup', 'meal', 'dish', 'plate', 'bowl', 'bagel', 'pretzel',
    'leaf', 'leaves', 'plant', 'flower', 'grass', 'twig', 'bark',
    'peel', 'shell', 'seed', 'nut', 'egg', 'coffee', 'tea', 'bean'
  ];

  const nonCompostKeywords = [
    'plastic', 'bottle', 'wrapper', 'bag', 'container', 'package',
    'styrofoam', 'foam', 'packaging',
    'can', 'metal', 'glass', 'jar', 'aluminum', 'steel', 'tin',
    'phone', 'remote', 'toy', 'tool', 'utensil', 'cup', 'mug',
    'fork', 'spoon', 'knife', 'screwdriver', 'hammer',
    'tire', 'wheel', 'battery', 'cable', 'wire',
    'pin', 'safety pin', 'clip', 'buckle', 'diaper'
  ];

  const recycleKeywords = [
    'paper', 'cardboard', 'newspaper', 'book', 'magazine',
    'box', 'carton', 'envelope', 'notebook'
  ];

  // ✅ FILTER FALSE POSITIVES FIRST
  const filteredPredictions = predictions.filter(pred => {
    const label = pred.className.toLowerCase();

    // Exclude obvious false positives
    const falsePositives = ['safety pin', 'diaper', 'buckle', 'ballpoint'];
    if (falsePositives.some(fp => label.includes(fp))) {
      console.log(`🚫 Filtered out false positive: ${pred.className} (${(pred.probability * 100).toFixed(1)}%)`);
      return false;
    }
    return true;
  });

  const topk = filteredPredictions.slice(0, 10);

  console.log('✅ Filtered predictions:', topk.map(p => `${p.className} (${(p.probability * 100).toFixed(1)}%)`));

  let score = { compost: 0, non: 0, recycle: 0 };

  topk.forEach((pred, index) => {
    const label = (pred.className || '').toLowerCase();
    const p = pred.probability || 0;
    const weight = 1 / (index + 1);
    const weightedScore = p * weight;
    const clean = label.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

    const hasCompost = compostKeywords.some(k => clean.includes(k));
    const hasNon = nonCompostKeywords.some(k => clean.includes(k));
    const hasRecycle = recycleKeywords.some(k => clean.includes(k));

    if (hasCompost) {
      score.compost += weightedScore * 3; // Higher boost
      console.log(`  ✅ Compost match: ${pred.className} (+${(weightedScore * 3).toFixed(3)})`);
    }
    if (hasNon) {
      score.non += weightedScore * 2;
      console.log(`  ❌ Non-compost match: ${pred.className} (+${(weightedScore * 2).toFixed(3)})`);
    }
    if (hasRecycle) {
      score.recycle += weightedScore * 1.5;
    }

    // Pattern matching
    const organicPatterns = [
      /fruit|vegetable|veg|food|produce|plant|leaf|peel|bean/,
      /banana|apple|orange|potato|tomato|carrot|bagel|bread/,
      /salad|meal|dish|leftover|scrap|compost/
    ];

    const nonOrganicPatterns = [
      /bottle|can|plastic|metal|package|wrapper/,
      /phone|remote|tool|device|electronic/,
      /pin|safety|buckle|clip|diaper/
    ];

    organicPatterns.forEach(pattern => {
      if (pattern.test(clean)) {
        score.compost += weightedScore * 2;
        console.log(`  🌱 Organic pattern: ${pred.className} (+${(weightedScore * 2).toFixed(3)})`);
      }
    });

    nonOrganicPatterns.forEach(pattern => {
      if (pattern.test(clean)) {
        score.non += weightedScore * 2;
      }
    });
  });

  console.log('📊 Final scores:', score);

  const topCategory = Object.keys(score).reduce((a, b) => score[a] > score[b] ? a : b);
  const topScore = score[topCategory];
  const totalScore = score.compost + score.non + score.recycle;
  const confidence = totalScore > 0 ? (topScore / totalScore) : 0;

  console.log(`🎯 Winner: ${topCategory} (confidence: ${(confidence * 100).toFixed(1)}%)`);

  const CONFIDENCE_THRESHOLD = 0.45;

  let verdict = 'Unknown';
  let message = '🤔 Not sure – try a clearer photo';
  let verdictClass = 'unknown';

  if (confidence >= CONFIDENCE_THRESHOLD) {
    if (topCategory === 'compost') {
      verdict = 'Compostable';
      message = '✅ Compostable – add to your green bin!';
      verdictClass = 'compostable';
      isWasteOrganic = true;
    } else if (topCategory === 'non') {
      verdict = 'Non-compostable';
      message = '🚫 Non-compostable – dispose responsibly';
      verdictClass = 'non-compostable';
      isWasteOrganic = false;
    } else if (topCategory === 'recycle') {
      verdict = 'Recyclable';
      message = '♻️ Recyclable – send to recycling';
      verdictClass = 'recyclable';
      isWasteOrganic = false;
    }
  } else {
    // Check top prediction
    const topPred = topk[0];
    if (topPred && topPred.probability > 0.30) {
      const topLabel = topPred.className.toLowerCase();
      if (/banana|apple|orange|broccoli|strawberry|lemon|mushroom|bagel|pretzel|bean/.test(topLabel)) {
        verdict = 'Compostable';
        message = '✅ Compostable – add to your green bin!';
        verdictClass = 'compostable';
        isWasteOrganic = true;
        console.log(`✅ Low confidence override: ${topPred.className} detected as compostable`);
      }
    }
  }

  // Display results
  resultBox.innerHTML = `
    <div class="ai-result-card ${verdictClass}">
      <div style="text-align:center; margin-bottom:12px;">
        <div style="font-size:48px; margin-bottom:8px;">
          ${verdictClass === 'compostable' ? '✅' : verdictClass === 'non-compostable' ? '🚫' : '♻️'}
        </div>
        <p style="font-size:18px; font-weight:700; margin:0;">${verdict}</p>
        <p style="color:#6b7280; font-size:14px; margin:4px 0 0 0;">Confidence: ${(confidence * 100).toFixed(0)}%</p>
      </div>
      
      <img src="${imageUrl}" style="width:100%; max-width:250px; border-radius:8px; margin:12px auto; display:block; border:2px solid #e5e7eb;"/>
      
      <details style="margin-top:12px; font-size:12px; color:#6b7280;">
        <summary style="cursor:pointer; font-weight:600;">🔍 AI Predictions (Top 5)</summary>
        <div style="margin-top:8px; padding:8px; background:#f9fafb; border-radius:4px;">
          ${topk.slice(0, 5).map((p, i) => `
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #e5e7eb;">
              <span>${i + 1}. ${p.className}</span>
              <span style="font-weight:600; color:#059669;">${(p.probability * 100).toFixed(1)}%</span>
            </div>
          `).join('')}
        </div>
      </details>
      
      <details style="margin-top:8px; font-size:11px; color:#9ca3af;">
        <summary style="cursor:pointer;">🔧 Debug Info</summary>
        <div style="margin-top:4px; padding:6px; background:#f3f4f6; border-radius:4px; font-family:monospace;">
          Backend: ${tf.getBackend()}<br>
          Platform: ${navigator.platform}<br>
          Device: ${/mobile/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop'}<br>
          File: ${fileName}
        </div>
      </details>
    </div>
  `;

  // Auto-fill waste type
  const wasteTypeSelect = document.querySelector('select[name="wasteType"]');
  if (wasteTypeSelect && verdict === 'Compostable') {
    wasteTypeSelect.value = 'mixed-organic';
  }

  enableSubmitBtn();
}

function enableSubmitBtn() {
  const submitBtn = document.querySelector('#pickupForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Schedule Pickup';
    submitBtn.style.background = '#00A63E';
  }
}

// Expose globally
window.isWasteOrganic = () => isWasteOrganic;
window.isModelLoaded = () => modelLoaded;
window.isModelLoading = () => !!modelLoadingPromise;
window.loadModel = loadModel;