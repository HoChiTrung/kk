/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Gender = 'Nam' | 'Nữ' | 'Khác';

export type BodyTypeClassification =
  | 'Gầy'
  | 'Thiếu cân nhẹ'
  | 'Tiêu chuẩn'
  | 'Cơ bắp gọn'
  | 'Vận động viên'
  | 'Mỡ tiềm ẩn'
  | 'Thừa cân'
  | 'Béo phì';

export interface TargetMetrics {
  targetWeight?: number; // kg
  targetVisceralFat?: number; // Level 1-30
  targetMuscleMass?: number; // kg
  targetSubcutaneousFat?: number; // %
  targetWaist?: number; // cm
}

export interface StudentProfile {
  id: string;
  fullName: string; // Max 100 chars
  gender: Gender;
  age: number; // 1 - 120
  height: number; // Unit: mét, 0.50m - 2.50m
  phone: string; // Regex ^(03|5|7|8|9)+([0-9]{8})$
  address?: string; // Max 255 chars
  dateOfBirth: string; // YYYY-MM-DD
  healthGoal: string; // Max 500 chars (Baseline Target)
  targetMetrics: TargetMetrics;
  avatarUrl?: string;
  driveFolderUrl?: string;
  createdAt: string;
}

export interface HealthMetricRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  weight: number; // 1. Cân nặng (kg, 10.00 - 300.00)
  subcutaneousFat: number; // 2. Mỡ dưới da (%, 1.0 - 60.0)
  boneCalcium: number; // 3. Canxi xương (Chỉ số, 0.5 - 10.0)
  bodyWater: number; // 4. Lượng nước (%, 20.0 - 80.0)
  muscleMass: number; // 5. Trọng lượng cơ bắp (kg, 5.00 - 150.00)
  bodyType: BodyTypeClassification; // 6. Thể hình (Phân loại)
  bmr: number; // 7. Năng lượng khi nghỉ ngơi (Calories, 500 - 5000)
  biologicalAge: number; // 8. Tuổi sinh học (Tuổi, 1 - 120)
  visceralFat: number; // 9. Mỡ nội tạng (Chỉ số/Cấp, 1 - 30)
  waist: number; // 10. Vòng eo (cm, 30.0 - 200.0)
  notes?: string;
}

export interface AnomalyAlert {
  type: 'VISCERAL_FAT_HIGH' | 'EARLY_AGING' | 'PLATEAU' | 'RAPID_CHANGE';
  severity: 'high' | 'warning' | 'info';
  title: string;
  message: string;
  metricValue?: number;
  threshold?: number;
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: 'trainer' | 'student';
  studentId?: string;
  avatarUrl?: string;
}

export interface AIAdviceRecord {
  id: string;
  studentId: string;
  metricRecordId: string;
  date: string;
  status: 'auto_generated' | 'draft_pending' | 'trainer_approved' | 'rejected';
  aiDraftContent: {
    summary: string;
    nutritionAdvice: string;
    workoutAdvice: string;
    lifestyleTip: string;
    waterTargetLiters: number;
    calorieTargetKcal: number;
  };
  trainerEditedContent?: string;
  trainerNote?: string;
  approvedAt?: string;
}

export interface HealthScoreBreakdown {
  totalScore: number; // 0 - 100
  tier: 'Xuất sắc' | 'Tốt' | 'Trung bình' | 'Cần cải thiện';
  scores: {
    visceralFatScore: number; // W1: 25%
    muscleMassScore: number; // W2: 25%
    biologicalAgeScore: number; // W3: 20%
    subcutaneousFatScore: number; // W4: 15%
    waterAndBoneScore: number; // W5: 15%
  };
}

export interface MealItem {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealLog {
  id: string;
  studentId: string;
  date: string;
  mealType: 'Bữa sáng' | 'Bữa trưa' | 'Bữa tối' | 'Bữa phụ';
  imageUrl: string;
  foodDescription: string;
  estimatedCalories: number;
  macros: {
    protein: number; // grams
    carbs: number; // grams
    fat: number; // grams
  };
  items?: MealItem[];
  trainerReaction?: '🔥' | '💪' | '👏' | '❤️';
  trainerComment?: string;
  loggedAt: string;
  driveFolderUrl?: string;
  driveFileUrl?: string;
  aiAnalyzed?: boolean;
  nutritionAdvice?: string;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: string;
  reps: string;
  completed: boolean;
}

export interface WorkoutLog {
  id: string;
  studentId: string;
  date: string;
  planTitle: string;
  durationMinutes: number;
  exercises: WorkoutExercise[];
  trainerReaction?: '🔥' | '💪' | '👏' | '❤️';
  trainerComment?: string;
  loggedAt: string;
}

export interface PhysiquePhoto {
  id: string;
  studentId: string;
  date: string;
  imageUrl: string;
  photoType: 'before' | 'after' | 'progress';
  weight: number;
  notes?: string;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  category: 'score' | 'visceral' | 'streak' | 'muscle' | 'water';
}

export interface SmartNotification {
  id: string;
  useCaseId: 'UC-NOTIF-01' | 'UC-NOTIF-02' | 'UC-NOTIF-03';
  studentId: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  read: boolean;
}

export type UserRole = 'trainer' | 'student';
