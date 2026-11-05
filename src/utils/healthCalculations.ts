/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  StudentProfile,
  HealthMetricRecord,
  HealthScoreBreakdown,
  AnomalyAlert,
  AIAdviceRecord,
} from '../types/health';
import {
  getIdealWeightRange,
  getVisceralFatEvaluation,
  getBoneMassEvaluation,
  BODY_TYPE_DEFINITIONS,
  WATER_STANDARDS,
} from '../data/medicalStandards';

/**
 * 1. Calculate Daily Recommended Water (Từ bảng tiêu chuẩn trong ảnh 59bf1002.jpg)
 */
export function calculateWaterTarget(weightKg: number, workoutDurationMins: number = 45): number {
  // Check exact lookup from table first
  const mapped = WATER_STANDARDS.weightToLitersMap.find((m) => Math.abs(m.weightKg - weightKg) <= 2.5);
  let baseLiters = mapped ? mapped.liters : weightKg * 0.033;
  const activityOffset = (workoutDurationMins / 45) * 0.5;
  return Number((baseLiters + activityOffset).toFixed(2));
}

/**
 * 2. Calculate Daily Calorie Target
 */
export function calculateCalorieTarget(
  bmr: number,
  healthGoal: string,
  activityFactor: number = 1.375
): number {
  let goalOffset = 0;
  const lowerGoal = healthGoal.toLowerCase();
  if (lowerGoal.includes('giảm') || lowerGoal.includes('mỡ') || lowerGoal.includes('siết') || lowerGoal.includes('weight loss')) {
    goalOffset = -300;
  } else if (lowerGoal.includes('tăng') || lowerGoal.includes('cơ') || lowerGoal.includes('bulk') || lowerGoal.includes('muscle')) {
    goalOffset = 300;
  }
  const target = Math.round(bmr * activityFactor + goalOffset);
  return Math.max(1200, target);
}

/**
 * 3. Algorithmic Health Score (Thang điểm 100)
 */
export function calculateHealthScore(
  profile: StudentProfile,
  latestMetric: HealthMetricRecord
): HealthScoreBreakdown {
  // S1: Visceral Fat Score (theo bảng chuẩn: 1-4: 100, 5: 85, 6-8: 70, 9-12: 45, >=13: 20)
  let sVisceral = 100;
  if (latestMetric.visceralFat <= 4) {
    sVisceral = 100;
  } else if (latestMetric.visceralFat === 5) {
    sVisceral = 85;
  } else if (latestMetric.visceralFat <= 8) {
    sVisceral = 70 - (latestMetric.visceralFat - 5) * 5;
  } else if (latestMetric.visceralFat <= 12) {
    sVisceral = 50 - (latestMetric.visceralFat - 8) * 6;
  } else {
    sVisceral = Math.max(10, 30 - (latestMetric.visceralFat - 12) * 2);
  }

  // S2: Muscle Mass Score relative to ideal range
  const idealWeight = getIdealWeightRange(profile.height, profile.gender);
  const midWeight = (idealWeight.minKg + idealWeight.maxKg) / 2;
  const idealMuscleRatio = profile.gender === 'Nữ' ? 0.35 : 0.44;
  const currentRatio = latestMetric.muscleMass / latestMetric.weight;
  const muscleRatioDiff = (currentRatio - idealMuscleRatio) / idealMuscleRatio;
  let sMuscle = 80;
  if (muscleRatioDiff >= 0) {
    sMuscle = Math.min(100, 85 + muscleRatioDiff * 50);
  } else {
    sMuscle = Math.max(30, 85 + muscleRatioDiff * 80);
  }

  // S3: Biological Age vs Real Age
  const ageDelta = latestMetric.biologicalAge - profile.age;
  let sAge = 85;
  if (ageDelta < -2) sAge = 100;
  else if (ageDelta <= 0) sAge = 90;
  else if (ageDelta <= 2) sAge = 70;
  else sAge = Math.max(20, 50 - (ageDelta - 2) * 8);

  // S4: Subcutaneous Fat Score
  let sSubcut = 80;
  const fat = latestMetric.subcutaneousFat;
  if (profile.gender === 'Nữ') {
    if (fat >= 18 && fat <= 24) sSubcut = 100;
    else if (fat < 18) sSubcut = Math.max(60, 100 - (18 - fat) * 4);
    else sSubcut = Math.max(25, 100 - (fat - 24) * 3.5);
  } else {
    if (fat >= 10 && fat <= 16) sSubcut = 100;
    else if (fat < 10) sSubcut = Math.max(60, 100 - (10 - fat) * 5);
    else sSubcut = Math.max(25, 100 - (fat - 16) * 3.8);
  }

  // S5: Water & Bone
  const boneStandard = getBoneMassEvaluation(latestMetric.weight, profile.gender);
  const boneDiff = Math.abs(latestMetric.boneCalcium - boneStandard.targetBoneKg);
  const sBone = Math.max(50, 100 - boneDiff * 25);

  let sWater = 80;
  const minWater = profile.gender === 'Nữ' ? WATER_STANDARDS.femaleOptimalMin : WATER_STANDARDS.maleOptimalMin;
  const maxWater = profile.gender === 'Nữ' ? WATER_STANDARDS.femaleOptimalMax : WATER_STANDARDS.maleOptimalMax;
  if (latestMetric.bodyWater >= minWater && latestMetric.bodyWater <= maxWater) {
    sWater = 100;
  } else if (latestMetric.bodyWater < minWater) {
    sWater = Math.max(30, 100 - (minWater - latestMetric.bodyWater) * 5);
  } else {
    sWater = 90;
  }
  const sWaterBone = sWater * 0.6 + sBone * 0.4;

  const totalScore = Math.round(
    0.25 * sVisceral +
    0.25 * sMuscle +
    0.20 * sAge +
    0.15 * sSubcut +
    0.15 * sWaterBone
  );

  let tier: HealthScoreBreakdown['tier'] = 'Trung bình';
  if (totalScore >= 85) tier = 'Xuất sắc';
  else if (totalScore >= 70) tier = 'Tốt';
  else if (totalScore >= 55) tier = 'Trung bình';
  else tier = 'Cần cải thiện';

  return {
    totalScore,
    tier,
    scores: {
      visceralFatScore: Math.round(sVisceral),
      muscleMassScore: Math.round(sMuscle),
      biologicalAgeScore: Math.round(sAge),
      subcutaneousFatScore: Math.round(sSubcut),
      waterAndBoneScore: Math.round(sWaterBone),
    },
  };
}

/**
 * 4. Automated Anomaly Detection based on standard reference charts
 */
export function detectAnomalies(
  profile: StudentProfile,
  latestMetric: HealthMetricRecord,
  history: HealthMetricRecord[]
): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];

  // 1. Visceral Fat Warning (06-08 Cảnh báo, 09-12 Thừa mỡ, 13-30 Báo động)
  if (latestMetric.visceralFat >= 13) {
    alerts.push({
      type: 'VISCERAL_FAT_HIGH',
      severity: 'high',
      title: 'MỨC BÁO ĐỘNG ĐỎ: Mỡ Nội Tạng Cực Kỳ Nguy Hiểm',
      message: `Chỉ số mỡ nội tạng đạt cấp ${latestMetric.visceralFat} (ngưỡng an toàn 1-4). Nguy cơ cao dẫn tới tai biến, đột quỵ, xơ vữa mạch vành và gan nhiễm mỡ nặng. Bắt buộc có can thiệp y tế & thể thao khẩn cấp!`,
      metricValue: latestMetric.visceralFat,
      threshold: 13,
    });
  } else if (latestMetric.visceralFat >= 9) {
    alerts.push({
      type: 'VISCERAL_FAT_HIGH',
      severity: 'high',
      title: 'CẢNH BÁO: Lượng Mỡ Nội Tạng Thừa Trên Mức Cho Phép',
      message: `Chỉ số mỡ nội tạng đạt cấp ${latestMetric.visceralFat} (ngưỡng cho phép 1-4, cảnh báo 6-8). Gia tăng nguy cơ tiểu đường type 2, mỡ máu cao và đau mòn sụn khớp. Cần ăn kiêng kỷ luật và tập cardio đốt mỡ.`,
      metricValue: latestMetric.visceralFat,
      threshold: 9,
    });
  } else if (latestMetric.visceralFat >= 6) {
    alerts.push({
      type: 'VISCERAL_FAT_HIGH',
      severity: 'warning',
      title: 'LƯU Ý: Mỡ Nội Tạng Đang Ở Mức Cảnh Báo',
      message: `Chỉ số mỡ nội tạng là cấp ${latestMetric.visceralFat}. Cần tập luyện để đưa về vùng an toàn (cấp 1 - 4).`,
      metricValue: latestMetric.visceralFat,
      threshold: 6,
    });
  }

  // 2. Early Biological Aging
  const ageDelta = latestMetric.biologicalAge - profile.age;
  if (ageDelta >= 3) {
    alerts.push({
      type: 'EARLY_AGING',
      severity: 'high',
      title: 'CẢNH BÁO LÃO HÓA SỚM: Trao Đổi Chất Chậm',
      message: `Tuổi sinh học (${latestMetric.biologicalAge} tuổi) cao hơn tuổi thực (${profile.age} tuổi) tới ${ageDelta} tuổi. Mức độ chuyển hóa nội sinh kém, tích tụ gốc tự do hoặc thiếu ngủ kéo dài.`,
      metricValue: latestMetric.biologicalAge,
      threshold: profile.age + 3,
    });
  }

  // 3. Plateau Detection (UC-NOTIF-03)
  if (history.length >= 3) {
    const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
    const m1 = sorted[0];
    const m2 = sorted[1];
    const m3 = sorted[2];

    const fatChange1 = Math.abs(m1.subcutaneousFat - m2.subcutaneousFat) / (m2.subcutaneousFat || 1);
    const fatChange2 = Math.abs(m2.subcutaneousFat - m3.subcutaneousFat) / (m3.subcutaneousFat || 1);
    const muscleChange1 = Math.abs(m1.muscleMass - m2.muscleMass) / (m2.muscleMass || 1);
    const muscleChange2 = Math.abs(m2.muscleMass - m3.muscleMass) / (m3.muscleMass || 1);

    if (fatChange1 < 0.01 && fatChange2 < 0.01 && muscleChange1 < 0.01 && muscleChange2 < 0.01) {
      alerts.push({
        type: 'PLATEAU',
        severity: 'warning',
        title: 'CẢNH BÁO TIẾN TRÌNH BỊ CHỮNG (PLATEAU)',
        message: '3 lần đo liên tiếp các chỉ số mỡ và cơ biến động dưới 1%. Cơ thể đang trong trạng thái thích nghi ngưỡng. HLV cần đổi bài tập hoặc điều chỉnh chu kỳ nạp dinh dưỡng.',
      });
    }
  }

  return alerts;
}

/**
 * 5. Instant AI Advice Generator (KHÔNG CẦN DUYỆT - TỰ ĐỘNG PHÁT HÀNH THEO BIẾN ĐỘNG CHỈ SỐ)
 * Dựa trên đối soát các bảng chuẩn: Chiều cao/cân nặng lý tưởng, Mỡ nội tạng & bệnh lý, Khối lượng xương, Phân loại thể hình 1-9
 */
export function generateInstantAIAdvice(
  profile: StudentProfile,
  latest: HealthMetricRecord,
  previous?: HealthMetricRecord
): AIAdviceRecord['aiDraftContent'] {
  const waterTarget = calculateWaterTarget(latest.weight, 45);
  const calorieTarget = calculateCalorieTarget(latest.bmr, profile.healthGoal);
  const idealWeight = getIdealWeightRange(profile.height, profile.gender);
  const visceralEval = getVisceralFatEvaluation(latest.visceralFat);
  const boneStandard = getBoneMassEvaluation(latest.weight, profile.gender);

  // Analyze changes
  let changeSummary = '';
  if (previous) {
    const dWeight = Number((latest.weight - previous.weight).toFixed(1));
    const dMuscle = Number((latest.muscleMass - previous.muscleMass).toFixed(1));
    const dFat = Number((latest.subcutaneousFat - previous.subcutaneousFat).toFixed(1));
    const dVisceral = latest.visceralFat - previous.visceralFat;

    const parts: string[] = [];
    if (dWeight !== 0) parts.push(`Cân nặng ${dWeight > 0 ? `tăng +${dWeight}` : `giảm ${dWeight}`}kg`);
    if (dMuscle !== 0) parts.push(`Cơ bắp ${dMuscle > 0 ? `tăng +${dMuscle}` : `giảm ${dMuscle}`}kg`);
    if (dFat !== 0) parts.push(`Mỡ dưới da ${dFat > 0 ? `tăng +${dFat}` : `giảm ${dFat}`}%`);
    if (dVisceral !== 0) parts.push(`Mỡ nội tạng ${dVisceral > 0 ? `tăng +${dVisceral}` : `hạ ${dVisceral}`} cấp`);

    changeSummary = parts.length > 0
      ? `Biến động so với lần đo trước (${previous.date}): ${parts.join(', ')}.`
      : 'Các chỉ số thể trạng tương đối ổn định so với lần đo gần nhất.';
  } else {
    changeSummary = `Khởi điểm ghi nhận ngày ${latest.date}: Cân nặng ${latest.weight}kg, Thể hình phân loại "${latest.bodyType}".`;
  }

  // Weight vs Ideal Table Evaluation
  let weightAnalysis = '';
  if (latest.weight > idealWeight.maxKg) {
    const overKg = Number((latest.weight - idealWeight.maxKg).toFixed(1));
    weightAnalysis = `Hiện tại ${latest.weight}kg, vượt ${overKg}kg so với ngưỡng lý tưởng chuẩn bảng (${idealWeight.minKg} - ${idealWeight.maxKg}kg cho chiều cao ${profile.height}m).`;
  } else if (latest.weight < idealWeight.minKg) {
    const underKg = Number((idealWeight.minKg - latest.weight).toFixed(1));
    weightAnalysis = `Hiện tại ${latest.weight}kg, thấp hơn ${underKg}kg so với mức chuẩn bảng (${idealWeight.minKg} - ${idealWeight.maxKg}kg). Cần tăng cân tăng cơ nạp năng lượng sạch.`;
  } else {
    weightAnalysis = `Cân nặng ${latest.weight}kg đang nằm hoàn hảo trong dải lý tưởng chuẩn (${idealWeight.minKg} - ${idealWeight.maxKg}kg).`;
  }

  // Visceral Fat & Pathological Risk Evaluation from Center Chart
  let visceralAnalysis = `Mỡ nội tạng: Cấp ${latest.visceralFat} (${visceralEval.label}). ${visceralEval.assessment}`;
  if (visceralEval.associatedRisks.length > 0) {
    visceralAnalysis += ` Các nguy cơ bệnh lý cần phòng ngừa: ${visceralEval.associatedRisks.join('; ')}.`;
  }

  // Nutrition Advice
  let nutritionAdvice = `Mục tiêu dinh dưỡng: Nạp ${calorieTarget} Kcal/ngày. Ưu tiên đạm nạc (1.6 - 2.0g/kg thể trọng), rau xanh lá giàu xơ, tinh bột phức và bổ sung canxi (ngưỡng xương chuẩn: ${boneStandard.targetBoneKg}kg).`;
  if (latest.visceralFat >= 9) {
    nutritionAdvice += ' Cắt giảm triệt để đường tinh luyện, nước ngọt có ga, bia rượu và thức ăn xào rán để đảo ngược quá trình tích mỡ nội tạng quanh tim gan.';
  }

  // Workout Advice
  let workoutAdvice = `Phác đồ rèn luyện: 4-5 buổi/tuần. Kết hợp tập kháng lực lũy tiến (Hypertrophy) 3 buổi và 2 buổi Cardio ngắt quãng (HIIT) 20-30 phút để đốt mỡ sâu.`;
  if (latest.muscleMass < (profile.gender === 'Nam' ? 32 : 21)) {
    workoutAdvice += ' Tập trung nhóm bài đa khớp (Squat, Deadlift, Bench Press, Lats Pull) để kích hoạt tối đa các sợi cơ lớn.';
  }

  // Lifestyle Tip
  const lifestyleTip = `Duy trì uống tối thiểu ${waterTarget}L nước lọc mỗi ngày theo bảng khuyến nghị thể trọng. Ngủ trước 23h00 để phục hồi tế bào và hạ mức tuổi sinh học (hiện tại: ${latest.biologicalAge} tuổi).`;

  const summary = `${changeSummary} ${weightAnalysis} ${visceralAnalysis}`;

  return {
    summary,
    nutritionAdvice,
    workoutAdvice,
    lifestyleTip,
    waterTargetLiters: waterTarget,
    calorieTargetKcal: calorieTarget,
  };
}

/**
 * 6. Gap Analysis
 */
export function calculateGapAnalysis(
  profile: StudentProfile,
  latestMetric?: HealthMetricRecord,
  firstMetric?: HealthMetricRecord
) {
  if (!latestMetric) return null;

  const targets = profile.targetMetrics;
  const targetWeight = targets.targetWeight;
  const targetVisceral = targets.targetVisceralFat;
  const targetMuscle = targets.targetMuscleMass;

  let weightProgressPercent = 0;
  if (targetWeight && firstMetric) {
    const totalGoalDelta = Math.abs(firstMetric.weight - targetWeight);
    const achievedDelta = Math.abs(firstMetric.weight - latestMetric.weight);
    weightProgressPercent = totalGoalDelta > 0 ? Math.min(100, Math.round((achievedDelta / totalGoalDelta) * 100)) : 100;
  }

  return {
    weightDelta: targetWeight ? Number((latestMetric.weight - targetWeight).toFixed(1)) : null,
    visceralDelta: targetVisceral !== undefined ? latestMetric.visceralFat - targetVisceral : null,
    muscleDelta: targetMuscle ? Number((latestMetric.muscleMass - targetMuscle).toFixed(1)) : null,
    weightProgressPercent,
  };
}
