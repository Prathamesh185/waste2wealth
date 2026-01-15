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

      // Force WebGL backend with fallback
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        console.log('✅ WebGL backend loaded');
      } catch (e) {
        console.warn('⚠️ WebGL failed, using CPU');
        await tf.setBackend('cpu');
        await tf.ready();
      }

      console.log('🔧 TensorFlow backend:', tf.getBackend());

      mobilenetModel = await mobilenet.load({
        version: 2,
        alpha: 1.0
      });

      modelLoaded = true;
      console.log('✅ MobileNet v2 loaded');
      showToast('AI model ready', 'success');
    } catch (err) {
      console.error('❌ Model load error:', err);
      showToast('AI model failed to load', 'error');
      modelLoadingPromise = null;
      throw err;
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

// ✅ FIX: Robust image loading with format conversion
async function loadImageRobustly(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;

        console.log('📥 File loaded:', {
          name: file.name,
          type: file.type,
          size: `${(file.size / 1024).toFixed(2)} KB`
        });

        // ✅ Create blob with explicit JPEG type
        const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.crossOrigin = 'anonymous';

        // Set timeout for loading
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(url);
          reject(new Error('Image load timeout'));
        }, 10000);

        img.onload = () => {
          clearTimeout(timeout);

          console.log('✅ Image loaded:', {
            width: img.naturalWidth,
            height: img.naturalHeight,
            complete: img.complete
          });

          // Validate image actually loaded
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            URL.revokeObjectURL(url);
            reject(new Error('Image has zero dimensions'));
            return;
          }

          URL.revokeObjectURL(url);
          resolve(img);
        };

        img.onerror = (err) => {
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          console.error('❌ Image load error:', err);
          reject(new Error('Failed to load image'));
        };

        img.src = url;

      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    // ✅ Read as ArrayBuffer to handle any format
    reader.readAsArrayBuffer(file);
  });
}

// ✅ Convert to standard format and size
async function normalizeImage(img) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', {
        alpha: false,
        willReadFrequently: false
      });

      // MobileNet expects 224x224
      const targetSize = 224;
      canvas.width = targetSize;
      canvas.height = targetSize;

      // Fill white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetSize, targetSize);

      // Calculate scaling to fill canvas while maintaining aspect ratio
      const scale = Math.max(
        targetSize / img.naturalWidth,
        targetSize / img.naturalHeight
      );

      const scaledWidth = img.naturalWidth * scale;
      const scaledHeight = img.naturalHeight * scale;

      // Center the image
      const x = (targetSize - scaledWidth) / 2;
      const y = (targetSize - scaledHeight) / 2;

      // High quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw image
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

      console.log('🎨 Image normalized to 224x224');

      // Get display URL
      const displayUrl = canvas.toDataURL('image/jpeg', 0.95);

      resolve({
        canvas: canvas,
        displayUrl: displayUrl
      });

    } catch (err) {
      console.error('❌ Normalization error:', err);
      reject(err);
    }
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
    // ✅ STEP 1: Load image robustly
    console.log('📸 Loading image...');
    const img = await loadImageRobustly(file);

    // ✅ STEP 2: Normalize to 224x224
    console.log('🎨 Normalizing image...');
    const normalized = await normalizeImage(img);

    // ✅ STEP 3: Verify canvas has content
    const ctx = normalized.canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, 224, 224);
    const pixels = imageData.data;

    // Check if canvas is not blank
    let hasContent = false;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) {
        hasContent = true;
        break;
      }
    }

    if (!hasContent) {
      throw new Error('Image appears blank after processing');
    }

    console.log('✅ Image has valid content');

    // ✅ STEP 4: Classify
    resultBox.innerHTML = '🤖 Analyzing with AI...';
    console.log('🤖 Running classification...');
    console.log('🔧 Backend:', tf.getBackend());

    const predictions = await mobilenetModel.classify(normalized.canvas, 15);

    console.log('🔍 Raw predictions:', predictions);

    // ✅ Validate predictions
    if (!predictions || predictions.length === 0) {
      throw new Error('No predictions returned');
    }

    // Check if all predictions are 0% (indicates failure)
    const allZero = predictions.every(p => p.probability < 0.001);
    if (allZero) {
      throw new Error('Model returned all zero probabilities - image may not be processed correctly');
    }

    console.log('✅ Valid predictions received');

    await analyzeAndDisplay(predictions, normalized.displayUrl, file.name);

  } catch (err) {
    console.error('❌ Classification error:', err);

    resultBox.innerHTML = `
      <div class="ai-result-card unknown" style="border:2px solid #dc2626;">
        <p style="color:#dc2626;font-weight:700;">❌ Classification Failed</p>
        <p style="font-size:14px;color:#6b7280;">${err.message}</p>
        <div style="background:#fee2e2;padding:12px;border-radius:8px;margin-top:12px;">
          <p style="margin:0;font-size:13px;color:#991b1b;">
            <strong>Troubleshooting:</strong><br>
            • Try a different image format (JPG/PNG)<br>
            • Ensure good internet connection<br>
            • Try reloading the page<br>
            • Use a different browser if issue persists
          </p>
        </div>
      </div>
    `;

    enableSubmitBtn();
  }
}

async function analyzeAndDisplay(predictions, imageUrl, fileName) {
  const resultBox = document.getElementById('aiResult');

  // Keywords
  const compostKeywords = [
    'banana', 'apple', 'orange', 'lemon', 'mango', 'pear', 'pineapple',
    'strawberry', 'grapes', 'watermelon', 'peach', 'plum', 'kiwi',
    'vegetable', 'potato', 'tomato', 'cabbage', 'onion', 'carrot',
    'broccoli', 'cauliflower', 'cucumber', 'lettuce', 'spinach', 'pepper',
    'squash', 'zucchini', 'eggplant', 'pumpkin', 'corn', 'mushroom',
    'food', 'salad', 'pizza', 'sandwich', 'bread', 'rice', 'pasta',
    'soup', 'meal', 'dish', 'plate', 'bowl', 'bagel', 'pretzel',
    'grocery', 'market', 'produce', 'fruit', 'bean', 'seed',
    'leaf', 'leaves', 'plant', 'flower', 'grass', 'twig', 'bark',
    'peel', 'shell', 'nut', 'egg', 'coffee', 'tea'
  ];

  const nonCompostKeywords = [
    'plastic', 'bottle', 'wrapper', 'bag', 'container', 'package',
    'styrofoam', 'foam', 'packaging',
    'can', 'metal', 'glass', 'jar', 'aluminum', 'steel', 'tin',
    'phone', 'remote', 'toy', 'tool', 'utensil', 'cup', 'mug',
    'fork', 'spoon', 'knife', 'screwdriver', 'hammer',
    'tire', 'wheel', 'battery', 'cable', 'wire',
    'pin', 'safety', 'clip', 'buckle', 'diaper',
    'fish', 'shark', 'tench', 'goldfish' // ✅ Added fish keywords
  ];

  const recycleKeywords = [
    'paper', 'cardboard', 'newspaper', 'book', 'magazine',
    'box', 'carton', 'envelope', 'notebook'
  ];

  // Filter out obvious false positives
  const filteredPredictions = predictions.filter(pred => {
    const label = pred.className.toLowerCase();

    const falsePositives = [
      'safety pin', 'diaper', 'buckle', 'ballpoint',
      'tench', 'goldfish', 'shark', 'fish', 'stingray'
    ];

    if (falsePositives.some(fp => label.includes(fp))) {
      console.log(`🚫 Filtered: ${pred.className}`);
      return false;
    }
    return true;
  });

  const topk = filteredPredictions.slice(0, 10);
  console.log('✅ Top predictions:', topk.map(p => `${p.className} (${(p.probability * 100).toFixed(1)}%)`));

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
      score.compost += weightedScore * 3;
      console.log(`  ✅ Compost: ${pred.className} (+${(weightedScore * 3).toFixed(3)})`);
    }
    if (hasNon) {
      score.non += weightedScore * 2;
    }
    if (hasRecycle) {
      score.recycle += weightedScore * 1.5;
    }

    // Pattern matching
    if (/fruit|vegetable|food|produce|grocery|market|bean|seed/.test(clean)) {
      score.compost += weightedScore * 2;
      console.log(`  🌱 Pattern: ${pred.className} (+${(weightedScore * 2).toFixed(3)})`);
    }
    if (/bottle|plastic|metal|fish|shark/.test(clean)) {
      score.non += weightedScore * 2;
    }
  });

  console.log('📊 Final scores:', score);

  const topCategory = Object.keys(score).reduce((a, b) => score[a] > score[b] ? a : b);
  const topScore = score[topCategory];
  const totalScore = score.compost + score.non + score.recycle;
  const confidence = totalScore > 0 ? (topScore / totalScore) : 0;

  console.log(`🎯 Result: ${topCategory} (${(confidence * 100).toFixed(1)}%)`);

  let verdict = 'Unknown';
  let message = '🤔 Not sure – try a clearer photo';
  let verdictClass = 'unknown';

  if (confidence >= 0.40) {
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
      message = '♻️ Recyclable';
      verdictClass = 'recyclable';
      isWasteOrganic = false;
    }
  } else {
    // Fallback to top prediction
    const topPred = topk[0];
    if (topPred && topPred.probability > 0.25) {
      const topLabel = topPred.className.toLowerCase();
      if (/banana|apple|orange|cucumber|strawberry|mushroom|grocery|market/.test(topLabel)) {
        verdict = 'Compostable';
        message = '✅ Compostable';
        verdictClass = 'compostable';
        isWasteOrganic = true;
      }
    }
  }

  // Display
  resultBox.innerHTML = `
    <div class="ai-result-card ${verdictClass}">
      <div style="text-align:center; margin-bottom:12px;">
        <div style="font-size:48px;">${verdictClass === 'compostable' ? '✅' : '🚫'}</div>
        <p style="font-size:20px; font-weight:700; margin:4px 0;">${verdict}</p>
        <p style="color:#6b7280; font-size:14px;">Confidence: ${(confidence * 100).toFixed(0)}%</p>
      </div>
      
      <img src="${imageUrl}" style="width:224px; height:224px; border-radius:8px; margin:12px auto; display:block; border:2px solid #e5e7eb;"/>
      
      <details style="margin-top:12px; font-size:12px;">
        <summary style="cursor:pointer; font-weight:600;">🔍 AI Predictions (Top 5)</summary>
        <div style="margin-top:8px; padding:8px; background:#f9fafb; border-radius:4px;">
          ${topk.slice(0, 5).map((p, i) => `
            <div style="display:flex; justify-content:space-between; padding:4px 0;">
              <span>${i + 1}. ${p.className}</span>
              <span style="font-weight:600;">${(p.probability * 100).toFixed(1)}%</span>
            </div>
          `).join('')}
        </div>
      </details>
      
      <details style="margin-top:8px; font-size:11px; color:#9ca3af;">
        <summary style="cursor:pointer;">🔧 Debug</summary>
        <div style="margin-top:4px; padding:6px; background:#f3f4f6; border-radius:4px; font-family:monospace; font-size:10px;">
          Backend: ${tf.getBackend()}<br>
          Platform: ${navigator.platform}<br>
          Device: ${/mobile/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop'}<br>
          File: ${fileName}<br>
          Scores: C:${score.compost.toFixed(2)} N:${score.non.toFixed(2)} R:${score.recycle.toFixed(2)}
        </div>
      </details>
    </div>
  `;

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

window.isWasteOrganic = () => isWasteOrganic;
window.isModelLoaded = () => modelLoaded;
window.isModelLoading = () => !!modelLoadingPromise;
window.loadModel = loadModel;