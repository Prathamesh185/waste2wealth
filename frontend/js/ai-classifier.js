let mobilenetModel = null;
let modelLoaded = false;
let modelLoadingPromise = null; // Check for concurrent loads
let isWasteOrganic = false;

async function loadModel() {
  if (modelLoaded) return;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      // console.log('⏳ Loading MobileNet...');
      mobilenetModel = await mobilenet.load();
      modelLoaded = true;
      console.log('✅ MobileNet loaded');
      showToast('AI model ready', 'success');
    } catch (err) {
      console.error('Error loading MobileNet', err);
      showToast('AI model failed to load', 'error');
      modelLoadingPromise = null; // Enable retry
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

// ✅ NEW: Fix image orientation using EXIF data
function getOrientation(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const view = new DataView(e.target.result);
        if (view.byteLength < 2 || view.getUint16(0, false) !== 0xFFD8) {
          return resolve(-2); // Not a JPEG
        }
        const length = view.byteLength;
        let offset = 2;
        while (offset < length) {
          if (offset + 4 > length) return resolve(-1); // Prevent out of bounds
          if (view.getUint16(offset + 2, false) <= 8) return resolve(-1);
          const marker = view.getUint16(offset, false);
          offset += 2;
          if (marker === 0xFFE1) {
            if (offset + 10 > length) return resolve(-1);
            if (view.getUint32(offset += 2, false) !== 0x45786966) {
              return resolve(-1);
            }
            const little = view.getUint16(offset += 6, false) === 0x4949;
            offset += view.getUint32(offset + 4, little);
            if (offset + 2 > length) return resolve(-1);
            const tags = view.getUint16(offset, little);
            offset += 2;
            for (let i = 0; i < tags; i++) {
              if (offset + (i * 12) + 12 > length) return resolve(-1);
              if (view.getUint16(offset + (i * 12), little) === 0x0112) {
                return resolve(view.getUint16(offset + (i * 12) + 8, little));
              }
            }
          } else if ((marker & 0xFF00) !== 0xFF00) {
            break;
          } else {
            offset += view.getUint16(offset, false);
          }
        }
        return resolve(-1);
      } catch (err) {
        console.warn('Error reading EXIF:', err);
        return resolve(-1);
      }
    };
    reader.onerror = () => {
      console.warn('FileReader error');
      resolve(-1);
    };
    reader.readAsArrayBuffer(file);
  });
}

// ✅ NEW: Apply orientation correction
function resetOrientation(srcBase64, srcOrientation, callback) {
  const img = new Image();
  img.onload = () => {
    const width = img.width;
    const height = img.height;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set proper canvas dimensions
    if ([5, 6, 7, 8].indexOf(srcOrientation) > -1) {
      canvas.width = height;
      canvas.height = width;
    } else {
      canvas.width = width;
      canvas.height = height;
    }

    // Transform context before drawing image
    switch (srcOrientation) {
      case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
      case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
      case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
      case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
      case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
      case 7: ctx.transform(0, -1, -1, 0, height, width); break;
      case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
      default: break;
    }

    // Draw image
    ctx.drawImage(img, 0, 0);
    callback(canvas.toDataURL());
  };
  img.src = srcBase64;
}

// ✅ IMPROVED: Process image with orientation fix and resize
async function processImage(file) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get EXIF orientation
      const orientation = await getOrientation(file);
      console.log('📐 Image orientation:', orientation);

      const reader = new FileReader();
      reader.onload = (e) => {
        const originalImage = e.target.result;

        // Fix orientation if needed
        if (orientation > 1) {
          resetOrientation(originalImage, orientation, (correctedImage) => {
            resolve({ src: correctedImage, orientation: orientation });
          });
        } else {
          resolve({ src: originalImage, orientation: orientation });
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    } catch (error) {
      reject(error);
    }
  });
}

// ✅ IMPROVED: Resize image for consistent processing
function resizeImage(imgSrc, maxWidth = 400) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Use high-quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = imgSrc;
  });
}

async function classifyFile(file) {
  const resultBox = document.getElementById('aiResult');
  resultBox.innerHTML = '🔄 Processing image...';

  const submitBtn = document.querySelector('#pickupForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true; // Temporary disable while processing
    submitBtn.textContent = 'Analyzing waste...';
  }

  if (!modelLoaded) {
    resultBox.innerHTML = '⏳ Loading AI model...';
    await loadModel();
  }

  try {
    // ✅ STEP 1: Process image (fix orientation)
    console.log('📸 Processing image...');
    const processed = await processImage(file);
    const processedImageSrc = processed.src;
    const orientation = processed.orientation;

    // ✅ STEP 2: Resize for consistent analysis
    console.log('📏 Resizing image...');
    const resizedImageSrc = await resizeImage(processedImageSrc, 400);

    // ✅ STEP 3: Create image element for classification
    const img = document.createElement('img');
    img.src = resizedImageSrc;
    img.onload = () => runClassification(img, orientation);

  } catch (err) {
    console.error('❌ AI classify error:', err);
    resultBox.innerHTML = `<p>❌ Error analyzing image: ${err.message || 'Unknown error'}</p>`;
    enableSubmitBtn();
  }
}

// ✅ NEW: Decoupled classification logic for re-use
async function runClassification(imgElement, orientationStr) {
  const resultBox = document.getElementById('aiResult');
  const submitBtn = document.querySelector('#pickupForm button[type="submit"]');

  resultBox.innerHTML = '🤖 Analyzing with AI...';

  try {
    const predictions = await mobilenetModel.classify(imgElement, 10);
    console.log('🔍 MobileNet predictions:', predictions);

    // ... (Keywords definitions: compostKeywords, etc. - kept same for brevity) ...
    const compostKeywords = [
      'banana', 'apple', 'orange', 'lemon', 'mango', 'pear', 'pineapple',
      'strawberry', 'grapes', 'watermelon', 'peach', 'plum', 'kiwi',
      'vegetable', 'potato', 'tomato', 'cabbage', 'onion', 'carrot',
      'broccoli', 'cauliflower', 'cucumber', 'lettuce', 'spinach', 'pepper',
      'squash', 'zucchini', 'eggplant', 'pumpkin', 'corn', 'mushroom',
      'food', 'salad', 'pizza', 'sandwich', 'bread', 'rice', 'pasta',
      'soup', 'meal', 'dish', 'plate', 'bowl',
      'leaf', 'leaves', 'plant', 'flower', 'grass', 'twig', 'bark',
      'peel', 'shell', 'seed', 'nut', 'egg', 'coffee', 'tea'
    ];

    const nonCompostKeywords = [
      'plastic', 'bottle', 'wrapper', 'bag', 'container', 'package',
      'styrofoam', 'foam', 'packaging',
      'can', 'metal', 'glass', 'jar', 'aluminum', 'steel', 'tin',
      'phone', 'remote', 'toy', 'tool', 'utensil', 'cup', 'mug',
      'plate', 'fork', 'spoon', 'knife', 'screwdriver', 'hammer',
      'tire', 'wheel', 'battery', 'cable', 'wire', 'pin', 'needle'
    ];

    const recycleKeywords = [
      'paper', 'cardboard', 'newspaper', 'book', 'magazine',
      'box', 'carton', 'envelope', 'notebook'
    ];

    // Scoring logic (kept same)
    let score = { compost: 0, non: 0, recycle: 0 };
    const topk = predictions.slice(0, 10);

    topk.forEach((pred, index) => {
      const label = (pred.className || '').toLowerCase();
      const p = pred.probability || 0;
      const weight = 1 / (index + 1);
      const weightedScore = p * weight;
      const clean = label.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

      const hasCompost = compostKeywords.some(k => clean.includes(k));
      const hasNon = nonCompostKeywords.some(k => clean.includes(k));
      const hasRecycle = recycleKeywords.some(k => clean.includes(k));

      if (hasCompost) score.compost += weightedScore * 2;
      if (hasNon) score.non += weightedScore * 2;
      if (hasRecycle) score.recycle += weightedScore * 1.5;

      const organicPatterns = [
        /fruit|vegetable|veg|food|produce|plant|leaf|root|peel|skin|core|bean|nut|seed/,
        /banana|apple|orange|potato|tomato|onion|carrot|cabbage|broccoli|cucumber/,
        /salad|meal|dish|leftover|scrap|compost|bread|bakery|cake|pie/,
        /flower|grass|weed|garden|clipping|twig/
      ];

      const nonOrganicPatterns = [
        /bottle|can|plastic|glass|metal|package|wrapper/,
        /phone|remote|toy|tool|device|electronic/,
        /container|cup|jar|utensil|fork|spoon|knife/,
        /pin|safety|needle/
      ];

      organicPatterns.forEach(pattern => {
        if (pattern.test(clean)) score.compost += weightedScore * 1.5;
      });

      nonOrganicPatterns.forEach(pattern => {
        if (pattern.test(clean)) score.non += weightedScore * 1.5;
      });
    });

    const topCategory = Object.keys(score).reduce((a, b) => score[a] > score[b] ? a : b);
    const topScore = score[topCategory];
    const totalScore = score.compost + score.non + score.recycle;
    const confidence = totalScore > 0 ? (topScore / totalScore) : 0;
    const CONFIDENCE_THRESHOLD = 0.55;

    let verdict = 'Unknown';
    let message = '🤔 Not sure – try a clearer image or different angle.';
    let verdictClass = 'unknown';

    if (confidence >= CONFIDENCE_THRESHOLD) {
      if (topCategory === 'compost') {
        verdict = 'Compostable';
        message = '✅ Compostable – add to your green bin!';
        verdictClass = 'compostable';
        isWasteOrganic = true;
      } else if (topCategory === 'non') {
        verdict = 'Non-compostable';
        message = '🚫 Non-compostable – dispose responsibly.';
        verdictClass = 'non-compostable';
        isWasteOrganic = false;
      } else if (topCategory === 'recycle') {
        verdict = 'Recyclable';
        message = '♻️ Recyclable – please send to recycling.';
        verdictClass = 'recyclable';
        isWasteOrganic = false;
      }
    } else {
      // Low confidence fallback (check top prediction)
      const topPred = topk[0];
      if (topPred.probability > 0.4) {
        const topLabel = topPred.className.toLowerCase();
        if (/banana|apple|orange|broccoli|strawberry|lemon|mushroom/.test(topLabel)) {
          verdict = 'Compostable';
          message = '✅ Compostable – add to your green bin!';
          verdictClass = 'compostable';
          isWasteOrganic = true;
        }
      }
    }

    // UI Updates
    const debugInfo = `
      <div style="font-size:11px; color:#6b7280; margin-top:12px; padding:8px; background:#f9fafb; border-radius:6px; text-align:left; border:1px solid #e5e7eb;">
        <div style="margin-bottom:4px; font-weight:600;">Debug Info (Mobile):</div>
        <div>Model Verdict: ${verdict}</div>
        <div>Orientation: ${orientationStr} (Dims: ${imgElement.width}x${imgElement.height})</div>
        <div style="margin-top:4px; font-weight:600;">Top Predictions:</div>
        ${topk.slice(0, 3).map(p => `
          <div style="display:flex; justify-content:space-between;">
            <span>${p.className}</span>
            <span>${(p.probability * 100).toFixed(1)}%</span>
          </div>
        `).join('')}
      </div>
    `;

    resultBox.innerHTML = `
      <div class="ai-result-card ${verdictClass}">
        <p><strong>Verdict:</strong> ${verdict}</p>
        <p>${message}</p>
        <p class="muted">Confidence: ${(confidence * 100).toFixed(0)}%</p>
        <div style="position:relative; display:inline-block;">
             <img id="analyzedImage" src="${imgElement.src}" width="220" style="margin-top:8px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);"/>
             <button onclick="rotateAndRetry()" style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px;">↻ Rotate</button>
        </div>
        ${debugInfo}
      </div>
    `;

    // Auto-fill logic
    const wasteTypeSelect = document.getElementById('wasteType');
    const changeLink = document.getElementById('changeCategoryLink');
    if (wasteTypeSelect) {
      if (verdict === 'Compostable') { wasteTypeSelect.value = 'mixed-organic'; }
      else if (verdict === 'Recyclable') { wasteTypeSelect.value = 'recyclable'; }
      else if (verdict === 'Non-compostable') { wasteTypeSelect.value = 'non-organic'; }

      wasteTypeSelect.disabled = true;
      wasteTypeSelect.style.backgroundColor = '#f1f5f9';
      wasteTypeSelect.style.cursor = 'not-allowed';
      if (changeLink) changeLink.style.display = 'inline-block';
    }

    enableSubmitBtn();

  } catch (err) {
    console.error('Classification error:', err);
    resultBox.innerHTML = `<p>❌ Error: ${err.message}</p>`;
    enableSubmitBtn();
  }
}

function enableSubmitBtn() {
  const submitBtn = document.querySelector('#pickupForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Schedule Pickup';
  }
}

// ✅ NEW: Manual Rotation Function
window.rotateAndRetry = function () {
  const imgInfo = document.getElementById('analyzedImage');
  if (!imgInfo) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    // Rotate 90 degrees clockwise
    canvas.width = img.height;
    canvas.height = img.width;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(90 * Math.PI / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const newSrc = canvas.toDataURL();
    const newImg = document.createElement('img');
    newImg.src = newSrc;
    newImg.onload = () => runClassification(newImg, 'Manual-Rotated');
  };
  img.src = imgInfo.src;

  // Update UI to show processing
  const btn = document.querySelector('#pickupForm button[type="submit"]');
  if (btn) { btn.textContent = 'Rotating...'; btn.disabled = true; }
};

// ✅ EXPOSE FLAG GLOBALLY
window.isWasteOrganic = () => isWasteOrganic;
window.isModelLoaded = () => modelLoaded;
window.isModelLoading = () => !!modelLoadingPromise;
window.loadModel = loadModel;
window.classifiyFile = classifyFile; // Typo fix in case used externally, but keep safe
