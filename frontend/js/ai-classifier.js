let mobilenetModel = null;
let modelLoaded = false;
let isWasteOrganic = false; 

async function loadModel() {
  try {
    mobilenetModel = await mobilenet.load();
    modelLoaded = true;
    console.log('✅ MobileNet loaded');
    showToast('AI model ready', 'success');
  } catch (err) {
    console.error('Error loading MobileNet', err);
    showToast('AI model failed to load', 'error');
  }
}

async function onClassifyClick() {
  const input = document.getElementById('wasteImage');
  if (!input || !input.files || !input.files.length) {
    return showToast('Please choose an image file first', 'error');
  }
  await classifyFile(input.files[0]);
}

async function classifyFile(file) {
  const resultBox = document.getElementById('aiResult');
  resultBox.innerHTML = 'Analyzing...';
  
  const submitBtn = document.querySelector('#pickupForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Analyzing waste...';
  }

  if (!modelLoaded) {
    resultBox.innerHTML = 'Model loading...';
    await loadModel();
  }

  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  try { await img.decode(); } catch (e) {}

  try {
    const predictions = await mobilenetModel.classify(img, 10); // Get top 10 instead of 5
    console.log('MobileNet predictions', predictions);

    // 🔥 IMPROVED KEYWORD LISTS
    const compostKeywords = [
      // Fruits
      'banana', 'apple', 'orange', 'lemon', 'mango', 'pear', 'pineapple', 
      'strawberry', 'grapes', 'watermelon', 'peach', 'plum', 'kiwi',
      
      // Vegetables
      'vegetable', 'potato', 'tomato', 'cabbage', 'onion', 'carrot',
      'broccoli', 'cauliflower', 'cucumber', 'lettuce', 'spinach', 'pepper',
      'squash', 'zucchini', 'eggplant', 'pumpkin', 'corn', 'mushroom',
      
      // Food waste
      'food', 'salad', 'pizza', 'sandwich', 'bread', 'rice', 'pasta',
      'soup', 'meal', 'dish', 'plate', 'bowl',
      
      // Natural materials
      'leaf', 'leaves', 'plant', 'flower', 'grass', 'twig', 'bark',
      'peel', 'shell', 'seed', 'nut', 'egg', 'coffee', 'tea'
    ];

    const nonCompostKeywords = [
      // Plastics
      'plastic', 'bottle', 'wrapper', 'bag', 'container', 'package',
      'styrofoam', 'foam', 'packaging',
      
      // Metals & Glass
      'can', 'metal', 'glass', 'jar', 'aluminum', 'steel', 'tin',
      
      // Electronics & Products
      'phone', 'remote', 'toy', 'tool', 'utensil', 'cup', 'mug',
      'plate', 'fork', 'spoon', 'knife', 'screwdriver', 'hammer',
      'tire', 'wheel', 'battery', 'cable', 'wire'
    ];

    const recycleKeywords = [
      'paper', 'cardboard', 'newspaper', 'book', 'magazine', 
      'box', 'carton', 'envelope', 'notebook'
    ];

    // 🔥 IMPROVED SCORING SYSTEM
    let score = { compost: 0, non: 0, recycle: 0 };
    const topk = predictions.slice(0, 10);

    topk.forEach((pred, index) => {
      const label = (pred.className || '').toLowerCase();
      const p = pred.probability || 0;
      
      // Weight higher predictions more heavily
      const weight = 1 / (index + 1); // First prediction gets full weight, second gets 0.5, etc.
      const weightedScore = p * weight;
      
      const clean = label.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

      // Check for exact matches
      const hasCompost = compostKeywords.some(k => clean.includes(k));
      const hasNon = nonCompostKeywords.some(k => clean.includes(k));
      const hasRecycle = recycleKeywords.some(k => clean.includes(k));

      if (hasCompost) {
        score.compost += weightedScore * 2; // Boost compost score
      }
      if (hasNon) {
        score.non += weightedScore * 2;
      }
      if (hasRecycle) {
        score.recycle += weightedScore * 1.5;
      }

      // 🔥 PATTERN MATCHING
      const organicPatterns = [
        /fruit|vegetable|veg|food|produce|plant|leaf|root|peel|skin|core/,
        /banana|apple|orange|potato|tomato|onion|carrot|cabbage/,
        /salad|meal|dish|leftover|scrap|compost/
      ];
      
      const nonOrganicPatterns = [
        /bottle|can|plastic|glass|metal|package|wrapper/,
        /phone|remote|toy|tool|device|electronic/,
        /container|cup|jar|utensil|fork|spoon|knife/
      ];

      organicPatterns.forEach(pattern => {
        if (pattern.test(clean)) {
          score.compost += weightedScore * 1.5;
        }
      });

      nonOrganicPatterns.forEach(pattern => {
        if (pattern.test(clean)) {
          score.non += weightedScore * 1.5;
        }
      });
    });

    console.log('Weighted scores', score);

    // 🔥 IMPROVED DECISION LOGIC
    const topCategory = Object.keys(score).reduce((a, b) => score[a] > score[b] ? a : b);
    const topScore = score[topCategory];
    const totalScore = score.compost + score.non + score.recycle;
    const confidence = totalScore > 0 ? (topScore / totalScore) : 0;

    // Require higher confidence threshold
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
      // Low confidence - check top prediction directly
      const topPred = topk[0];
      if (topPred.probability > 0.5) {
        const topLabel = topPred.className.toLowerCase();
        
        // Strong food indicators
        if (/banana|apple|orange|broccoli|strawberry|lemon|mushroom/.test(topLabel)) {
          verdict = 'Compostable';
          message = '✅ Compostable – add to your green bin!';
          verdictClass = 'compostable';
          isWasteOrganic = true;
        }
      }
    }

    // Display results
    resultBox.innerHTML = `
      <div class="ai-result-card ${verdictClass}">
        <p><strong>Verdict:</strong> ${verdict}</p>
        <p>${message}</p>
        <p class="muted">Confidence: ${(confidence * 100).toFixed(0)}%</p>
        <details style="margin-top:8px;">
          <summary style="cursor:pointer;color:#64748b;font-size:12px;">Show AI predictions</summary>
          <p class="muted" style="margin-top:4px;font-size:11px;">
            ${topk.slice(0, 5).map(p => `${p.className} (${(p.probability * 100).toFixed(0)}%)`).join(', ')}
          </p>
        </details>
        <img src="${img.src}" width="220" style="margin-top:8px;border-radius:8px"/>
      </div>
    `;

    // Auto-fill waste type
    const wasteTypeSelect = document.querySelector('select[name="wasteType"]');
    if (wasteTypeSelect && verdict === 'Compostable') {
      wasteTypeSelect.value = 'mixed-organic';
    }

    // Update submit button
    if (submitBtn) {
      if (isWasteOrganic) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Schedule Pickup';
        submitBtn.style.background = '#00A63E';
        showToast('✅ Waste verified as organic!', 'success');
      } else {
        submitBtn.disabled = true;
        submitBtn.textContent = '🚫 Non-organic waste detected';
        submitBtn.style.background = '#dc2626';
        showToast('⚠️ Only organic waste can be scheduled', 'error');
      }
    }

  } catch (err) {
    console.error('AI classify error', err);
    resultBox.innerHTML = '<p>❌ Error analyzing image</p>';
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Analysis failed - Try again';
    }
  }
}

// ✅ EXPOSE FLAG GLOBALLY
window.isWasteOrganic = () => isWasteOrganic;