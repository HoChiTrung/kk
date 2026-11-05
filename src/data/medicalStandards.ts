/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Standard Medical & Fitness Reference Tables extracted from the official center charts
 * (Bảng đánh giá sức khỏe, Mỡ nội tạng gây bệnh, Chiều cao cân nặng lý tưởng, Phân loại thể hình 1-9)
 */

export interface IdealWeightByHeight {
  heightCm: number;
  femaleMinKg: number;
  femaleMaxKg: number;
  maleMinKg: number;
  maleMaxKg: number;
}

// BẢNG CHIỀU CAO CÂN NẶNG LÝ TƯỞNG (Từ ảnh 7a5809ed.jpg & 59bf1002.jpg)
export const IDEAL_WEIGHT_TABLE: IdealWeightByHeight[] = [
  { heightCm: 140, femaleMinKg: 39, femaleMaxKg: 42, maleMinKg: 42, maleMaxKg: 45 },
  { heightCm: 141, femaleMinKg: 40, femaleMaxKg: 43, maleMinKg: 43, maleMaxKg: 46 },
  { heightCm: 142, femaleMinKg: 40, femaleMaxKg: 43, maleMinKg: 43, maleMaxKg: 46 },
  { heightCm: 143, femaleMinKg: 41, femaleMaxKg: 44, maleMinKg: 44, maleMaxKg: 47 },
  { heightCm: 144, femaleMinKg: 42, femaleMaxKg: 45, maleMinKg: 45, maleMaxKg: 48 },
  { heightCm: 145, femaleMinKg: 42, femaleMaxKg: 46, maleMinKg: 45, maleMaxKg: 48 },
  { heightCm: 146, femaleMinKg: 43, femaleMaxKg: 46, maleMinKg: 46, maleMaxKg: 49 },
  { heightCm: 147, femaleMinKg: 43, femaleMaxKg: 47, maleMinKg: 46, maleMaxKg: 50 },
  { heightCm: 148, femaleMinKg: 44, femaleMaxKg: 48, maleMinKg: 47, maleMaxKg: 50 },
  { heightCm: 149, femaleMinKg: 44, femaleMaxKg: 48, maleMinKg: 47, maleMaxKg: 51 },
  { heightCm: 150, femaleMinKg: 45, femaleMaxKg: 49, maleMinKg: 48, maleMaxKg: 52 },
  { heightCm: 151, femaleMinKg: 46, femaleMaxKg: 50, maleMinKg: 48, maleMaxKg: 52 },
  { heightCm: 152, femaleMinKg: 46, femaleMaxKg: 50, maleMinKg: 50, maleMaxKg: 53 },
  { heightCm: 153, femaleMinKg: 47, femaleMaxKg: 51, maleMinKg: 50, maleMaxKg: 54 },
  { heightCm: 154, femaleMinKg: 47, femaleMaxKg: 51, maleMinKg: 51, maleMaxKg: 55 },
  { heightCm: 155, femaleMinKg: 48, femaleMaxKg: 52, maleMinKg: 52, maleMaxKg: 55 },
  { heightCm: 156, femaleMinKg: 48, femaleMaxKg: 52, maleMinKg: 53, maleMaxKg: 56 },
  { heightCm: 157, femaleMinKg: 49, femaleMaxKg: 53, maleMinKg: 54, maleMaxKg: 57 },
  { heightCm: 158, femaleMinKg: 50, femaleMaxKg: 54, maleMinKg: 54, maleMaxKg: 58 },
  { heightCm: 159, femaleMinKg: 51, femaleMaxKg: 54, maleMinKg: 55, maleMaxKg: 59 },
  { heightCm: 160, femaleMinKg: 51, femaleMaxKg: 55, maleMinKg: 56, maleMaxKg: 60 },
  { heightCm: 161, femaleMinKg: 52, femaleMaxKg: 56, maleMinKg: 56, maleMaxKg: 60 },
  { heightCm: 162, femaleMinKg: 52, femaleMaxKg: 56, maleMinKg: 57, maleMaxKg: 61 },
  { heightCm: 163, femaleMinKg: 53, femaleMaxKg: 57, maleMinKg: 58, maleMaxKg: 62 },
  { heightCm: 164, femaleMinKg: 54, femaleMaxKg: 58, maleMinKg: 58, maleMaxKg: 62 },
  { heightCm: 165, femaleMinKg: 54, femaleMaxKg: 59, maleMinKg: 59, maleMaxKg: 63 },
  { heightCm: 166, femaleMinKg: 55, femaleMaxKg: 59, maleMinKg: 59, maleMaxKg: 63 },
  { heightCm: 167, femaleMinKg: 56, femaleMaxKg: 60, maleMinKg: 60, maleMaxKg: 64 },
  { heightCm: 168, femaleMinKg: 56, femaleMaxKg: 61, maleMinKg: 61, maleMaxKg: 65 },
  { heightCm: 169, femaleMinKg: 57, femaleMaxKg: 61, maleMinKg: 61, maleMaxKg: 66 },
  { heightCm: 170, femaleMinKg: 58, femaleMaxKg: 62, maleMinKg: 62, maleMaxKg: 66 },
  { heightCm: 171, femaleMinKg: 58, femaleMaxKg: 63, maleMinKg: 63, maleMaxKg: 67 },
  { heightCm: 172, femaleMinKg: 59, femaleMaxKg: 64, maleMinKg: 64, maleMaxKg: 68 },
  { heightCm: 173, femaleMinKg: 60, femaleMaxKg: 64, maleMinKg: 64, maleMaxKg: 69 },
  { heightCm: 174, femaleMinKg: 61, femaleMaxKg: 65, maleMinKg: 65, maleMaxKg: 70 },
  { heightCm: 175, femaleMinKg: 61, femaleMaxKg: 66, maleMinKg: 66, maleMaxKg: 70 },
  { heightCm: 176, femaleMinKg: 62, femaleMaxKg: 67, maleMinKg: 67, maleMaxKg: 71 },
  { heightCm: 177, femaleMinKg: 63, femaleMaxKg: 67, maleMinKg: 67, maleMaxKg: 72 },
  { heightCm: 178, femaleMinKg: 63, femaleMaxKg: 68, maleMinKg: 68, maleMaxKg: 73 },
  { heightCm: 179, femaleMinKg: 64, femaleMaxKg: 69, maleMinKg: 69, maleMaxKg: 74 },
  { heightCm: 180, femaleMinKg: 65, femaleMaxKg: 70, maleMinKg: 70, maleMaxKg: 75 },
  { heightCm: 181, femaleMinKg: 66, femaleMaxKg: 70, maleMinKg: 70, maleMaxKg: 75 },
  { heightCm: 182, femaleMinKg: 66, femaleMaxKg: 71, maleMinKg: 71, maleMaxKg: 76 },
  { heightCm: 183, femaleMinKg: 67, femaleMaxKg: 72, maleMinKg: 72, maleMaxKg: 77 },
  { heightCm: 184, femaleMinKg: 68, femaleMaxKg: 73, maleMinKg: 73, maleMaxKg: 78 },
  { heightCm: 185, femaleMinKg: 68, femaleMaxKg: 74, maleMinKg: 74, maleMaxKg: 79 },
  { heightCm: 186, femaleMinKg: 69, femaleMaxKg: 74, maleMinKg: 74, maleMaxKg: 80 },
  { heightCm: 187, femaleMinKg: 70, femaleMaxKg: 75, maleMinKg: 75, maleMaxKg: 80 },
  { heightCm: 188, femaleMinKg: 71, femaleMaxKg: 76, maleMinKg: 76, maleMaxKg: 81 },
  { heightCm: 189, femaleMinKg: 71, femaleMaxKg: 77, maleMinKg: 77, maleMaxKg: 82 },
  { heightCm: 190, femaleMinKg: 72, femaleMaxKg: 78, maleMinKg: 78, maleMaxKg: 83 },
  { heightCm: 191, femaleMinKg: 73, femaleMaxKg: 78, maleMinKg: 78, maleMaxKg: 84 },
];

// BẢNG TIÊU CHUẨN MỠ NỘI TẠNG & NGUY CƠ BỆNH LÝ (Từ ảnh 69655dfe.jpg & 31b1482e.jpg)
export interface VisceralFatStandard {
  minLevel: number;
  maxLevel: number;
  label: string;
  badgeColor: string;
  assessment: string;
  actionRequired: string;
  associatedRisks: string[];
}

export const VISCERAL_FAT_STANDARDS: VisceralFatStandard[] = [
  {
    minLevel: 1,
    maxLevel: 4,
    label: 'Chỉ số Tốt',
    badgeColor: 'emerald',
    assessment: 'Chỉ số mỡ nội tạng rất lý tưởng, cơ thể được bảo vệ an toàn khỏi các bệnh chuyển hóa.',
    actionRequired: 'Duy trì lối sống năng động và chế độ ăn cân bằng dinh dưỡng hiện tại.',
    associatedRisks: [],
  },
  {
    minLevel: 5,
    maxLevel: 5,
    label: 'Trung bình',
    badgeColor: 'teal',
    assessment: 'Mức mỡ nội tạng đạt ngưỡng bình thường nhưng bắt đầu chạm giới hạn cận trên.',
    actionRequired: 'Kiểm soát lượng tinh bột nhanh và duy trì tập kháng lực 3 buổi/tuần.',
    associatedRisks: [],
  },
  {
    minLevel: 6,
    maxLevel: 8,
    label: 'Cảnh Báo',
    badgeColor: 'amber',
    assessment: 'Mỡ nội tạng bắt đầu tích tụ quanh tim, gan và các tạng phủ. Cơ thể phát tín hiệu cảnh báo.',
    actionRequired: 'Cần tích cực vận động và tập luyện cardio để đốt mỡ, đưa chỉ số về ngưỡng cho phép.',
    associatedRisks: [
      'Gia tăng áp lực lên thành mạch máu',
      'Tích mỡ bước đầu quanh bao gan',
    ],
  },
  {
    minLevel: 9,
    maxLevel: 12,
    label: 'Thừa Mỡ Trên Mức Cho Phép',
    badgeColor: 'rose',
    assessment: 'Lượng mỡ nội tạng thừa vượt mức an toàn, bao phủ các cơ quan nội tạng quan trọng.',
    actionRequired: 'Bắt buộc ăn uống kỷ luật, cắt giảm hoàn toàn bia rượu, đồ ngọt và tăng cường tập luyện thể thao hàng ngày.',
    associatedRisks: [
      'Bệnh Tim Mạch & Huyết Áp: Nguy cơ xơ vữa động mạch vành, tắc nghẽn mạch máu, mỡ máu cao',
      'Tiểu Đường Type 2: Đề kháng insulin, mỡ che lấp thụ thể tế bào khiến đường huyết tăng vọt',
      'Bệnh Gan: Gan nhiễm mỡ, suy giảm chức năng thải độc',
      'Bệnh Xương Khớp: Áp lực trọng lượng và mỡ nội tạng làm sụn khớp mòn, đau cột sống lưng và khớp gối',
    ],
  },
  {
    minLevel: 13,
    maxLevel: 30,
    label: 'BÁO ĐỘNG NGUY HIỂM!',
    badgeColor: 'red',
    assessment: 'MỨC ĐỘ BÁO ĐỘNG ĐỎ! Mỡ nội tạng cực cao, trực tiếp đe dọa sức khỏe tim mạch và tính mạng.',
    actionRequired: 'Cần nghiêm ngặt tuyệt đối trong chế độ ăn và rèn luyện. Nếu không hành động ngay, nguy cơ biến chứng rất cao!',
    associatedRisks: [
      'Đột Quỵ & Tai Biến Mạch Máu Não do huyết khối hoặc vỡ mạch máu não',
      'Nhồi Máu Cơ Tim do mảng xơ vữa có cục máu đông làm tắc nghẽn mạch vành',
      'Xơ gan do gan nhiễm mỡ giai đoạn tiến triển',
      'Hỏng thận, suy giảm thị lực, tổn thương thần kinh do biến chứng tiểu đường',
      'Nguy cơ Ung Thư & U Bướu do rối loạn chuyển hóa nội tiết tố mãn tính',
    ],
  },
];

// BẢNG TIÊU CHUẨN KHỐI LƯỢNG XƯƠNG (CANXI XƯƠNG - Từ ảnh 69655dfe.jpg)
export interface BoneMassStandard {
  gender: 'Nam' | 'Nữ';
  weightCategory: string;
  targetBoneKg: number;
}

export const BONE_MASS_STANDARDS: BoneMassStandard[] = [
  // Nam giới
  { gender: 'Nam', weightCategory: 'Dưới 65 kg', targetBoneKg: 2.65 },
  { gender: 'Nam', weightCategory: '65 ~ 95 kg', targetBoneKg: 3.29 },
  { gender: 'Nam', weightCategory: 'Trên 95 kg', targetBoneKg: 3.69 },
  // Nữ giới
  { gender: 'Nữ', weightCategory: 'Dưới 50 kg', targetBoneKg: 1.95 },
  { gender: 'Nữ', weightCategory: '50 ~ 70 kg', targetBoneKg: 2.40 },
  { gender: 'Nữ', weightCategory: 'Trên 70 kg', targetBoneKg: 2.95 },
];

// BẢNG PHÂN LOẠI THỂ HÌNH 1 ĐẾN 9 (Từ ảnh 69655dfe.jpg)
export interface BodyTypeDefinition {
  index: number;
  code: string;
  name: string;
  description: string;
  fatLevel: 'Thấp' | 'Trung bình' | 'Cao' | 'Dưới chuẩn';
  muscleLevel: 'Thấp' | 'Trung bình' | 'Khá cao' | 'Rất cao';
  recommendation: string;
}

export const BODY_TYPE_DEFINITIONS: Record<number, BodyTypeDefinition> = {
  1: {
    index: 1,
    code: 'Béo ẩn',
    name: 'Béo ẩn (Skinny Fat)',
    description: 'Có vóc dáng bên ngoài bình thường nhưng lại có độ béo nội tạng cao ở mức cao và khối lượng cơ ở mức trung bình hoặc thấp.',
    fatLevel: 'Cao',
    muscleLevel: 'Thấp',
    recommendation: 'Tập trung kháng lực tăng cơ bắp, giảm ăn đường tinh luyện và tinh bột xấu để đốt mỡ nội tạng.',
  },
  2: {
    index: 2,
    code: 'Béo phì',
    name: 'Béo phì toàn thân',
    description: 'Béo bụng, độ béo nội tạng cao, khối lượng cơ ở mức trung bình.',
    fatLevel: 'Cao',
    muscleLevel: 'Trung bình',
    recommendation: 'Thâm hụt calo bền vững, kết hợp 3 buổi cardio ngắt quãng và 3 buổi tập kháng lực toàn thân.',
  },
  3: {
    index: 3,
    code: 'Béo chắc',
    name: 'Béo chắc (Khung to)',
    description: 'Béo bụng to, độ béo nội tạng và khối lượng cơ ở mức cao.',
    fatLevel: 'Cao',
    muscleLevel: 'Khá cao',
    recommendation: 'Giữ vững cơ bắp sẵn có, siết calo và tăng thời lượng cardio để hạ tỷ lệ mỡ xuống chuẩn.',
  },
  4: {
    index: 4,
    code: 'Dưới chuẩn',
    name: 'Dưới chuẩn (Thiếu cơ)',
    description: 'Độ béo trung bình nhưng khối lượng cơ lại ít hơn mức bình thường.',
    fatLevel: 'Trung bình',
    muscleLevel: 'Thấp',
    recommendation: 'Tăng cường bổ sung protein (1.8-2.0g/kg), tập các bài Compound nâng tạ để kích thích phát triển cơ bắp.',
  },
  5: {
    index: 5,
    code: 'Bình thường',
    name: 'Thể trạng Tiêu chuẩn',
    description: 'Độ béo và lượng cơ đều ở mức trung bình đạt chuẩn.',
    fatLevel: 'Trung bình',
    muscleLevel: 'Trung bình',
    recommendation: 'Thể trạng tốt, tiếp tục duy trì chế độ sinh hoạt và rèn luyện đều đặn.',
  },
  6: {
    index: 6,
    code: 'Cơ bắp',
    name: 'Cơ bắp phát triển',
    description: 'Độ béo ở mức trung bình, khối lượng cơ cao hơn mức bình thường.',
    fatLevel: 'Trung bình',
    muscleLevel: 'Khá cao',
    recommendation: 'Thể hình thể thao rất đẹp, giữ vững chế độ dinh dưỡng giàu đạm và tập tạ luân phiên.',
  },
  7: {
    index: 7,
    code: 'Mảnh khảnh',
    name: 'Mảnh khảnh (Gầy thiếu cơ)',
    description: 'Có độ béo và khối lượng cơ đều ở mức dưới trung bình.',
    fatLevel: 'Dưới chuẩn',
    muscleLevel: 'Thấp',
    recommendation: 'Cần nạp dư thừa calo sạch (+300-500 Kcal/ngày), ăn 4-5 bữa nhỏ và tập kháng lực để tăng cân an toàn.',
  },
  8: {
    index: 8,
    code: 'Mảnh khảnh Cơ bắp',
    name: 'Mảnh khảnh săn chắc',
    description: 'Độ béo dưới ngưỡng trung bình, khối lượng cơ ở mức khá cao (vận động viên lean).',
    fatLevel: 'Dưới chuẩn',
    muscleLevel: 'Khá cao',
    recommendation: 'Thể trạng săn chắc ít mỡ, tăng nhẹ calo để xây dựng thêm khối lượng cơ bắp nét hơn.',
  },
  9: {
    index: 9,
    code: 'Rất cơ bắp',
    name: 'Rất cơ bắp (Vận động viên)',
    description: 'Độ béo dưới ngưỡng trung bình trong khi khối lượng cơ ở mức khá cao hoặc rất cao.',
    fatLevel: 'Dưới chuẩn',
    muscleLevel: 'Rất cao',
    recommendation: 'Thể hình đỉnh cao của vận động viên chuyên nghiệp!',
  },
};

// BẢNG TIÊU CHUẨN LƯỢNG NƯỚC (Từ ảnh 59bf1002.jpg)
export const WATER_STANDARDS = {
  femaleOptimalMin: 50,
  femaleOptimalMax: 55,
  maleOptimalMin: 55,
  maleOptimalMax: 65,
  athleteOptimal: 65,
  // Bảng cân nặng -> Lượng nước khuyến nghị (Lít)
  weightToLitersMap: [
    { weightKg: 40, liters: 1.6 },
    { weightKg: 50, liters: 2.0 },
    { weightKg: 55, liters: 2.2 },
    { weightKg: 60, liters: 2.4 },
    { weightKg: 65, liters: 2.6 },
    { weightKg: 70, liters: 2.8 },
    { weightKg: 75, liters: 3.0 },
    { weightKg: 80, liters: 3.2 },
    { weightKg: 85, liters: 3.4 },
    { weightKg: 90, liters: 3.6 },
    { weightKg: 95, liters: 3.8 },
  ],
};

/**
 * Helper to get ideal weight range for a student
 */
export function getIdealWeightRange(heightMeters: number, gender: 'Nam' | 'Nữ' | 'Khác') {
  const heightCm = Math.round(heightMeters * 100);
  const clamped = Math.max(140, Math.min(191, heightCm));
  const row = IDEAL_WEIGHT_TABLE.find((r) => r.heightCm === clamped) || IDEAL_WEIGHT_TABLE[20]; // default 160cm
  if (gender === 'Nữ') {
    return { minKg: row.femaleMinKg, maxKg: row.femaleMaxKg };
  }
  return { minKg: row.maleMinKg, maxKg: row.maleMaxKg };
}

/**
 * Helper to get visceral fat status and medical warnings
 */
export function getVisceralFatEvaluation(level: number): VisceralFatStandard {
  const matched = VISCERAL_FAT_STANDARDS.find(
    (s) => level >= s.minLevel && level <= s.maxLevel
  );
  return matched || VISCERAL_FAT_STANDARDS[VISCERAL_FAT_STANDARDS.length - 1];
}

/**
 * Helper to get target bone calcium by weight & gender
 */
export function getBoneMassEvaluation(weightKg: number, gender: 'Nam' | 'Nữ' | 'Khác'): BoneMassStandard {
  const g = gender === 'Nữ' ? 'Nữ' : 'Nam';
  if (g === 'Nữ') {
    if (weightKg < 50) return BONE_MASS_STANDARDS[3];
    if (weightKg <= 70) return BONE_MASS_STANDARDS[4];
    return BONE_MASS_STANDARDS[5];
  } else {
    if (weightKg < 65) return BONE_MASS_STANDARDS[0];
    if (weightKg <= 95) return BONE_MASS_STANDARDS[1];
    return BONE_MASS_STANDARDS[2];
  }
}
