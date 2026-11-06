/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MealItem } from '../types/health';

export interface MealAnalysisResult {
  isFood: boolean;
  nonFoodReason?: string;
  analysisSource?: 'gemini-ai' | 'vision-canvas';
  geminiErrorHint?: string;
  foodDescription: string;
  estimatedCalories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  items: MealItem[];
  nutritionScore: number;
  advice: string;
  healthTags: string[];
}

export interface VisualFeatures {
  hasCanvasData: boolean;
  greenRatio: number;
  whiteStarchRatio: number;
  brownProteinRatio: number;
  orangeRedRatio: number;
  goldenFriedRatio: number;
  warmBrothRatio: number;
  darkSauceRatio: number;
  creamyLightRatio: number;
  coolNonFoodRatio: number;
  paperGrayRatio: number;
  sharpJumpsRatio: number;
  inkNextToPaperRatio: number;
  signReversalsRatio: number;
  flatPixelRatio: number;
  centerFoodRatio: number;
  borderInkRatio: number;
  brightness: number;
  saturation: number;
  portionDensity: number;
}

/**
 * Extracts real pixel-level computer vision features and edge/text statistics
 * from a Base64 image using HTML5 Canvas.
 */
export async function extractImageVisualFeatures(imageBase64: string): Promise<VisualFeatures> {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const dataUrl = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = (err) => reject(err);
        el.src = dataUrl;
      });

      const size = 96;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let greenCount = 0;
        let whiteStarchCount = 0;
        let brownProteinCount = 0;
        let orangeRedCount = 0;
        let goldenFriedCount = 0;
        let warmBrothCount = 0;
        let darkSauceCount = 0;
        let creamyLightCount = 0;
        let coolNonFoodCount = 0;
        let paperGrayCount = 0;

        let sharpJumps = 0;
        let inkNextToPaper = 0;
        let signReversals = 0;
        let flatPixels = 0;
        let centerFoodPixels = 0;
        let borderInkPixels = 0;

        let totalBrightness = 0;
        let totalSaturation = 0;

        const totalPixels = size * size;
        const lumGrid = new Float32Array(totalPixels);
        const satGrid = new Float32Array(totalPixels);

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const pIdx = y * size + x;
            const idx = pIdx * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const dx = (x - size / 2) / (size / 2);
            const dy = (y - size / 2) / (size / 2);
            const distSq = dx * dx + dy * dy;
            const isCenter = distSq < 0.6;
            const weight = isCenter ? 1.2 : 0.8;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
            const sat = max === 0 ? 0 : delta / max;

            lumGrid[pIdx] = lum;
            satGrid[pIdx] = sat;

            totalBrightness += lum;
            totalSaturation += sat;

            let hue = 0;
            if (delta !== 0) {
              if (max === r) {
                hue = ((g - b) / delta) % 6;
              } else if (max === g) {
                hue = (b - r) / delta + 2;
              } else {
                hue = (r - g) / delta + 4;
              }
              hue = Math.round(hue * 60);
              if (hue < 0) hue += 360;
            }

            // Paper / gray background detection
            if (sat < 0.16 && lum > 0.64) {
              paperGrayCount++;
            }

            // Border ink/text detection (tables & documents have text/lines near edges)
            if (distSq > 0.65 && lum < 0.32 && sat < 0.25) {
              borderInkPixels++;
            }

            // Cool non-food colors (blue, cyan, indigo, violet, magenta UI/charts)
            if (hue >= 175 && hue <= 325 && sat >= 0.22 && lum > 0.15 && lum < 0.9) {
              coolNonFoodCount += 1;
            }
            // Leafy greens / vegetables (hue 72..165)
            else if (hue >= 72 && hue <= 165 && sat >= 0.18 && lum > 0.14 && lum < 0.85) {
              greenCount += weight;
              if (isCenter) centerFoodPixels++;
            }
            // Golden fried / egg yolk / roasted skin / turmeric (hue 34..64, higher saturation)
            else if (hue >= 34 && hue <= 64 && sat >= 0.34 && lum >= 0.34 && lum <= 0.86) {
              goldenFriedCount += weight;
              if (isCenter) centerFoodPixels++;
            }
            // Orange-red (salmon, tomato, shrimp, carrot, beef, chili sauce)
            else if ((hue <= 22 || hue >= 342) && sat >= 0.32 && lum >= 0.2 && lum <= 0.82) {
              orangeRedCount += weight;
              if (isCenter) centerFoodPixels++;
            }
            // Grilled / pan-seared / braised protein (warm brown 14..42, medium lum)
            else if (hue >= 14 && hue <= 42 && sat >= 0.2 && sat <= 0.68 && lum >= 0.18 && lum <= 0.6) {
              brownProteinCount += weight;
              if (isCenter) centerFoodPixels++;
            }
            // Warm soup broth (amber/tan liquid tones)
            else if (hue >= 22 && hue <= 50 && sat >= 0.14 && sat < 0.34 && lum >= 0.36 && lum <= 0.72) {
              warmBrothCount += weight;
              if (isCenter) centerFoodPixels++;
            }
            // Creamy / oats / yogurt / light broth (warm off-white)
            else if (lum >= 0.64 && lum < 0.86 && sat >= 0.09 && sat <= 0.28 && hue >= 25 && hue <= 58) {
              creamyLightCount += weight;
              if (isCenter) centerFoodPixels++;
            }
            // White rice / rice noodles / egg white / tofu inside center plate area
            else if (lum >= 0.72 && lum <= 0.95 && sat <= 0.16 && distSq < 0.45) {
              whiteStarchCount += weight;
            }
            // Dark braised sauce / dark meat in center
            else if (lum >= 0.1 && lum < 0.25 && sat >= 0.15 && distSq < 0.45) {
              darkSauceCount += weight;
              if (isCenter) centerFoodPixels++;
            }
          }
        }

        // Scan horizontally & vertically for high-frequency text strokes, table grid lines, and flat digital blocks
        for (let y = 0; y < size; y++) {
          let prevDiffX = 0;
          for (let x = 1; x < size; x++) {
            const curr = lumGrid[y * size + x];
            const prev = lumGrid[y * size + (x - 1)];
            const diff = curr - prev;

            if (Math.abs(diff) > 0.16) sharpJumps++;
            if (Math.abs(diff) < 0.008) flatPixels++;
            if ((curr < 0.36 && prev > 0.52) || (curr > 0.52 && prev < 0.36)) {
              inkNextToPaper++;
            }
            if (Math.abs(diff) > 0.1 && Math.abs(prevDiffX) > 0.1 && diff * prevDiffX < 0) {
              signReversals++;
            }
            prevDiffX = diff;
          }
        }

        for (let x = 0; x < size; x++) {
          let prevDiffY = 0;
          for (let y = 1; y < size; y++) {
            const curr = lumGrid[y * size + x];
            const prev = lumGrid[(y - 1) * size + x];
            const diff = curr - prev;

            if (Math.abs(diff) > 0.16) sharpJumps++;
            if ((curr < 0.36 && prev > 0.52) || (curr > 0.52 && prev < 0.36)) {
              inkNextToPaper++;
            }
            if (Math.abs(diff) > 0.1 && Math.abs(prevDiffY) > 0.1 && diff * prevDiffY < 0) {
              signReversals++;
            }
            prevDiffY = diff;
          }
        }

        const edgeComparisons = size * (size - 1) * 2;
        const organicFoodSum =
          greenCount +
          brownProteinCount +
          orangeRedCount +
          goldenFriedCount +
          warmBrothCount +
          creamyLightCount +
          whiteStarchCount * 0.6;

        const portionDensity = Math.min(1, Math.max(0.25, organicFoodSum / (totalPixels * 0.75)));

        return {
          hasCanvasData: true,
          greenRatio: greenCount / totalPixels,
          whiteStarchRatio: whiteStarchCount / totalPixels,
          brownProteinRatio: brownProteinCount / totalPixels,
          orangeRedRatio: orangeRedCount / totalPixels,
          goldenFriedRatio: goldenFriedCount / totalPixels,
          warmBrothRatio: warmBrothCount / totalPixels,
          darkSauceRatio: darkSauceCount / totalPixels,
          creamyLightRatio: creamyLightCount / totalPixels,
          coolNonFoodRatio: coolNonFoodCount / totalPixels,
          paperGrayRatio: paperGrayCount / totalPixels,
          sharpJumpsRatio: sharpJumps / edgeComparisons,
          inkNextToPaperRatio: inkNextToPaper / edgeComparisons,
          signReversalsRatio: signReversals / edgeComparisons,
          flatPixelRatio: flatPixels / (size * (size - 1)),
          centerFoodRatio: centerFoodPixels / (totalPixels * 0.6),
          borderInkRatio: borderInkPixels / (totalPixels * 0.35),
          brightness: totalBrightness / totalPixels,
          saturation: totalSaturation / totalPixels,
          portionDensity,
        };
      }
    } catch {
      // Fall through if Canvas decode fails
    }
  }

  return {
    hasCanvasData: false,
    greenRatio: 0,
    whiteStarchRatio: 0,
    brownProteinRatio: 0,
    orangeRedRatio: 0,
    goldenFriedRatio: 0,
    warmBrothRatio: 0,
    darkSauceRatio: 0,
    creamyLightRatio: 0,
    coolNonFoodRatio: 0,
    paperGrayRatio: 0,
    sharpJumpsRatio: 0,
    inkNextToPaperRatio: 0,
    signReversalsRatio: 0,
    flatPixelRatio: 0,
    centerFoodRatio: 0,
    borderInkRatio: 0,
    brightness: 0.5,
    saturation: 0.3,
    portionDensity: 0.5,
  };
}

/**
 * Analyzes an uploaded image to determine:
 * 1) Whether the image is actually a food/meal photo (rejecting tables, charts, text documents, screenshots, etc.)
 * 2) Total calories, total protein, carbs, fat
 * 3) Individual dish/ingredient breakdown (`items`: name, portion, calories, protein, carbs, fat)
 * 4) Tailored nutritional advice
 */
export async function analyzeFoodImageVisuals(
  imageBase64: string,
  options: {
    mealType?: string;
    studentGoal?: string;
    fileName?: string;
  } = {}
): Promise<MealAnalysisResult> {
  const features = await extractImageVisualFeatures(imageBase64);
  const mealType = options.mealType || 'Bữa trưa';
  const goal = options.studentGoal || 'Cân đối vóc dáng & Cải thiện sức khỏe';

  if (!features.hasCanvasData) {
    return {
      isFood: false,
      nonFoodReason:
        'Không thể giải mã trực tiếp dữ liệu điểm ảnh trên máy chủ khi chưa cấu hình GEMINI_API_KEY hợp lệ.',
      analysisSource: 'vision-canvas',
      foodDescription: '',
      estimatedCalories: 0,
      macros: { protein: 0, carbs: 0, fat: 0 },
      items: [],
      nutritionScore: 0,
      advice: '',
      healthTags: [],
    };
  }

  const {
    greenRatio,
    whiteStarchRatio,
    brownProteinRatio,
    orangeRedRatio,
    goldenFriedRatio,
    warmBrothRatio,
    creamyLightRatio,
    coolNonFoodRatio,
    paperGrayRatio,
    sharpJumpsRatio,
    inkNextToPaperRatio,
    signReversalsRatio,
    flatPixelRatio,
    centerFoodRatio,
    borderInkRatio,
    saturation,
  } = features;

  // ============================================================================
  // STAGE 1: STRICT NON-FOOD / DOCUMENT / TABLE / SCREENSHOT / CHART REJECTION
  // ============================================================================

  // 1A. Detect printed tables, reference charts, InBody sheets, text documents, spreadsheets
  // Printed tables/text have high ink-next-to-paper transitions and rapid high-frequency sign reversals
  const isDocumentOrTable =
    inkNextToPaperRatio >= 0.042 ||
    (signReversalsRatio >= 0.052 && sharpJumpsRatio >= 0.11) ||
    (paperGrayRatio >= 0.36 && sharpJumpsRatio >= 0.095) ||
    (borderInkRatio >= 0.06 && inkNextToPaperRatio >= 0.03);

  if (isDocumentOrTable) {
    return {
      isFood: false,
      nonFoodReason:
        'Hệ thống phát hiện ảnh tải lên là bảng số liệu, biểu đồ hoặc tài liệu văn bản (không phải thức ăn/đồ uống). Vui lòng chụp hoặc tải lên hình ảnh món ăn thực tế để AI tính Calo!',
      analysisSource: 'vision-canvas',
      foodDescription: '',
      estimatedCalories: 0,
      macros: { protein: 0, carbs: 0, fat: 0 },
      items: [],
      nutritionScore: 0,
      advice: '',
      healthTags: [],
    };
  }

  // 1B. Detect digital screenshots / UI screens / synthetic graphics
  if (flatPixelRatio >= 0.55 || coolNonFoodRatio >= 0.24) {
    return {
      isFood: false,
      nonFoodReason:
        'Hình ảnh có dấu hiệu là ảnh chụp màn hình hoặc đồ vật không phải thực phẩm. Vui lòng chụp trực tiếp đĩa/tô món ăn của bạn.',
      analysisSource: 'vision-canvas',
      foodDescription: '',
      estimatedCalories: 0,
      macros: { protein: 0, carbs: 0, fat: 0 },
      items: [],
      nutritionScore: 0,
      advice: '',
      healthTags: [],
    };
  }

  // 1C. Detect monochrome, blank, or non-food scenes with insufficient organic food colors
  const coloredFoodEvidence =
    greenRatio +
    brownProteinRatio +
    orangeRedRatio +
    goldenFriedRatio +
    warmBrothRatio +
    creamyLightRatio;

  if (coloredFoodEvidence < 0.12 || saturation < 0.09 || centerFoodRatio < 0.14) {
    return {
      isFood: false,
      nonFoodReason:
        'Không nhận diện được món ăn hoặc thực phẩm rõ ràng trong ảnh này. Vui lòng chụp cận cảnh, đủ sáng vào đĩa/tô thức ăn của bạn.',
      analysisSource: 'vision-canvas',
      foodDescription: '',
      estimatedCalories: 0,
      macros: { protein: 0, carbs: 0, fat: 0 },
      items: [],
      nutritionScore: 0,
      advice: '',
      healthTags: [],
    };
  }

  // ============================================================================
  // STAGE 2: COMPONENT-LEVEL FOOD SEGMENTATION & PER-ITEM MACRO CALCULATION
  // ============================================================================
  const items: MealItem[] = [];
  const tags: string[] = [];
  const adviceNotes: string[] = [];
  let score = 8.5;

  // Estimate total plate weight (~320g to 520g) based on visual coverage
  const totalEstimatedGrams = Math.round(280 + Math.min(0.65, coloredFoodEvidence + whiteStarchRatio * 0.5) * 380);

  // Normalize component weights so we can allocate realistic gram portions to each detected dish item
  const rawProteinWeight = brownProteinRatio * 1.35 + orangeRedRatio * 1.15 + goldenFriedRatio * 0.75;
  const rawStarchWeight = whiteStarchRatio * 1.25 + creamyLightRatio * 1.1 + goldenFriedRatio * 0.35;
  const rawVeggieWeight = greenRatio * 1.45 + orangeRedRatio * 0.35;
  const rawBrothOrSauceWeight = warmBrothRatio * 1.2 + goldenFriedRatio * 0.4;

  const weightSum = Math.max(
    0.01,
    rawProteinWeight + rawStarchWeight + rawVeggieWeight + rawBrothOrSauceWeight
  );

  // 1. Protein Component(s)
  if (rawProteinWeight / weightSum >= 0.12) {
    const proteinGrams = Math.max(
      60,
      Math.min(220, Math.round((rawProteinWeight / weightSum) * totalEstimatedGrams / 5) * 5)
    );

    if (orangeRedRatio > brownProteinRatio && orangeRedRatio >= 0.08) {
      // Salmon / Shrimp / Beef / Tomato-braised protein
      const prot = Math.round(proteinGrams * 0.22);
      const fat = Math.round(proteinGrams * 0.1);
      const carbs = Math.round(proteinGrams * 0.02);
      const cal = prot * 4 + carbs * 4 + fat * 9;
      items.push({
        name: 'Cá hồi / Tôm / Thịt bò chế biến',
        portion: `~${proteinGrams}g`,
        calories: cal,
        protein: prot,
        carbs,
        fat,
      });
      tags.push('Giàu Đạm & Omega');
    } else if (goldenFriedRatio > brownProteinRatio && goldenFriedRatio >= 0.1) {
      // Pan-fried / Egg / Crispy protein
      const prot = Math.round(proteinGrams * 0.18);
      const fat = Math.round(proteinGrams * 0.14);
      const carbs = Math.round(proteinGrams * 0.05);
      const cal = prot * 4 + carbs * 4 + fat * 9;
      items.push({
        name: 'Đạm chiên / Trứng ốp / Thịt áp chảo vàng',
        portion: `~${proteinGrams}g`,
        calories: cal,
        protein: prot,
        carbs,
        fat,
      });
      tags.push('Món áp chảo/chiên');
    } else {
      // Grilled / Lean meat / Chicken breast / Pork / Beef
      const prot = Math.round(proteinGrams * 0.25);
      const fat = Math.round(proteinGrams * 0.07);
      const carbs = Math.round(proteinGrams * 0.02);
      const cal = prot * 4 + carbs * 4 + fat * 9;
      items.push({
        name: 'Thịt nạc / Ức gà / Bò chế biến',
        portion: `~${proteinGrams}g`,
        calories: cal,
        protein: prot,
        carbs,
        fat,
      });
      tags.push('Giàu Protein');
    }
  }

  // 2. Starch / Carbohydrate Component
  if (rawStarchWeight / weightSum >= 0.14) {
    const starchGrams = Math.max(
      70,
      Math.min(240, Math.round((rawStarchWeight / weightSum) * totalEstimatedGrams / 5) * 5)
    );

    if (warmBrothRatio >= 0.14) {
      // Noodles / Pho / Bun
      const carbs = Math.round(starchGrams * 0.25);
      const prot = Math.round(starchGrams * 0.03);
      const fat = Math.round(starchGrams * 0.01);
      const cal = prot * 4 + carbs * 4 + fat * 9;
      items.push({
        name: 'Sợi bún / Bánh phở / Mì',
        portion: `~${starchGrams}g (1 vắt vừa)`,
        calories: cal,
        protein: prot,
        carbs,
        fat,
      });
      tags.push('Món nước');
    } else if (creamyLightRatio > whiteStarchRatio) {
      // Oats / Whole grain / Sweet potato / Bread
      const carbs = Math.round(starchGrams * 0.27);
      const prot = Math.round(starchGrams * 0.05);
      const fat = Math.round(starchGrams * 0.03);
      const cal = prot * 4 + carbs * 4 + fat * 9;
      items.push({
        name: 'Tinh bột phức (Ngũ cốc / Khoai / Bánh mì)',
        portion: `~${starchGrams}g`,
        calories: cal,
        protein: prot,
        carbs,
        fat,
      });
      tags.push('Tinh bột hấp thu chậm');
    } else {
      // Steamed rice / Sticky rice
      const carbs = Math.round(starchGrams * 0.28);
      const prot = Math.round(starchGrams * 0.026);
      const fat = Math.round(starchGrams * 0.005);
      const cal = prot * 4 + carbs * 4 + fat * 9;
      items.push({
        name: 'Cơm / Tinh bột chính',
        portion: `~${starchGrams}g (~1 chén)`,
        calories: cal,
        protein: prot,
        carbs,
        fat,
      });
    }
  }

  // 3. Vegetable / Fiber Component
  if (greenRatio >= 0.05 || rawVeggieWeight / weightSum >= 0.1) {
    const veggieGrams = Math.max(
      50,
      Math.min(200, Math.round(((greenRatio + orangeRedRatio * 0.25) / weightSum) * totalEstimatedGrams / 5) * 5)
    );
    const carbs = Math.round(veggieGrams * 0.05);
    const prot = Math.round(veggieGrams * 0.02);
    const fat = Math.round(veggieGrams * 0.01);
    const cal = prot * 4 + carbs * 4 + fat * 9;
    items.push({
      name: 'Rau xanh & Củ quả tươi',
      portion: `~${veggieGrams}g`,
      calories: cal,
      protein: prot,
      carbs,
      fat,
    });
    if (greenRatio >= 0.18) {
      tags.push('Giàu chất xơ');
    }
  }

  // 4. Broth / Sauce / Cooking Oil Component
  if (warmBrothRatio >= 0.14) {
    const brothMl = Math.round(180 + warmBrothRatio * 250);
    const prot = 4;
    const carbs = 5;
    const fat = Math.round(5 + goldenFriedRatio * 12);
    const cal = prot * 4 + carbs * 4 + fat * 9;
    items.push({
      name: 'Nước dùng / Nước súp hầm',
      portion: `~${brothMl}ml`,
      calories: cal,
      protein: prot,
      carbs,
      fat,
    });
  } else if (goldenFriedRatio >= 0.12 || brownProteinRatio >= 0.14) {
    const fatGrams = Math.max(4, Math.round(4 + goldenFriedRatio * 22));
    const carbsGrams = 3;
    const cal = carbsGrams * 4 + fatGrams * 9;
    items.push({
      name: 'Dầu chế biến & Nước sốt gia vị',
      portion: `~${fatGrams + 6}g`,
      calories: cal,
      protein: 0,
      carbs: carbsGrams,
      fat: fatGrams,
    });
  }

  // Ensure at least 1 item if valid food photo
  if (items.length === 0) {
    items.push({
      name: 'Khẩu phần món ăn hỗn hợp trong ảnh',
      portion: `~${totalEstimatedGrams}g`,
      calories: 380,
      protein: 24,
      carbs: 42,
      fat: 12,
    });
  }

  // Calculate exact totals from individual items
  const totalCalories = items.reduce((sum, item) => sum + item.calories, 0);
  const totalProtein = items.reduce((sum, item) => sum + item.protein, 0);
  const totalCarbs = items.reduce((sum, item) => sum + item.carbs, 0);
  const totalFat = items.reduce((sum, item) => sum + item.fat, 0);

  const summaryNames = items
    .filter((i) => !i.name.includes('Dầu chế biến'))
    .map((i) => `${i.name} (${i.portion}: ${i.calories} Kcal)`)
    .join(' + ');

  // Build specific nutritional advice
  if (greenRatio < 0.07) {
    adviceNotes.push(
      'Khẩu phần rau xanh trong ảnh đang khá ít. Bạn nên bổ sung thêm 100-150g rau luộc hoặc salad để tăng chất xơ và kiểm soát đường huyết.'
    );
    score = Math.max(6.8, Number((score - 0.6).toFixed(1)));
  } else if (greenRatio >= 0.18) {
    adviceNotes.push(
      'Lượng rau xanh trong khẩu phần rất tốt, cung cấp nhiều chất xơ hỗ trợ tiêu hóa và giảm tích mỡ.'
    );
    score = Math.min(9.6, Number((score + 0.5).toFixed(1)));
  }

  if (totalFat >= 20 || goldenFriedRatio >= 0.18) {
    adviceNotes.push(
      `Lượng chất béo ước tính khoảng ${totalFat}g. Để tối ưu mục tiêu "${goal}", hãy hạn chế nước sốt béo/đồ chiên và ưu tiên chế biến hấp/luộc.`
    );
    score = Math.max(6.8, Number((score - 0.5).toFixed(1)));
  }

  adviceNotes.push(
    `Tổng năng lượng: ${totalCalories} Kcal (Protein: ${totalProtein}g, Tinh bột: ${totalCarbs}g, Chất béo: ${totalFat}g). Nên ăn phần rau và đạm trước khi ăn tinh bột.`
  );

  return {
    isFood: true,
    analysisSource: 'vision-canvas',
    foodDescription: summaryNames || `Bữa ăn (${mealType}) gồm ${items.length} thành phần`,
    estimatedCalories: totalCalories,
    macros: {
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
    },
    items,
    nutritionScore: score,
    advice: adviceNotes.join(' '),
    healthTags: tags.length > 0 ? tags.slice(0, 3) : ['Phân tích thị giác'],
  };
}
