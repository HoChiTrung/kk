/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { StudentProfile, MealLog, MealItem, WorkoutLog } from '../../types/health';
import { useHealth } from '../../context/HealthContext';
import {
  calculateHealthScore,
  calculateWaterTarget,
  calculateCalorieTarget,
} from '../../utils/healthCalculations';
import { compressImage } from '../../utils/imageUtils';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
  logoutGoogle,
} from '../../services/googleDriveAuth';
import {
  GOOGLE_DRIVE_PARENT_URL,
  DrivePhotoItem,
  findOrCreateStudentFolder,
  uploadMealPhotoToDrive,
  listStudentDrivePhotos,
} from '../../services/googleDriveService';
import { MetricsCharts } from '../common/MetricsCharts';
import { BeforeAfterViewer } from '../common/BeforeAfterViewer';
import {
  Droplet,
  Flame,
  Award,
  Sparkles,
  Utensils,
  Dumbbell,
  CheckCircle2,
  Calendar,
  Plus,
  Camera,
  ShieldCheck,
  TrendingDown,
  Printer,
  Bell,
  Clock,
  Heart,
  ChevronRight,
  ExternalLink,
  Folder,
  UploadCloud,
  Upload,
  Loader2,
  Check,
  FileCheck2,
  Trash2,
} from 'lucide-react';

interface StudentPortalProps {
  student: StudentProfile;
}

const GOOGLE_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1DJCFlItKnPr4-YGShTwmJEgiFQ8Yayqc?usp=sharing';

export const StudentPortal: React.FC<StudentPortalProps> = ({ student }) => {
  const {
    getStudentMetrics,
    getStudentAdvices,
    getStudentMeals,
    getStudentWorkouts,
    getStudentPhotos,
    badges,
    addMealLog,
    analyzeMealPhoto,
    addWorkoutLog,
    updateStudentDriveFolder,
    setOpenReportModal,
    setOpenStandardsModal,
  } = useHealth();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'nutrition' | 'workout' | 'metrics' | 'physique'
  >('overview');

  const studentMetrics = getStudentMetrics(student.id);
  const studentAdvices = getStudentAdvices(student.id);
  const studentMeals = getStudentMeals(student.id);
  const studentWorkouts = getStudentWorkouts(student.id);
  const studentPhotos = getStudentPhotos(student.id);

  const latestMetric = studentMetrics[studentMetrics.length - 1];
  const latestAdvice = studentAdvices[0] || studentAdvices.find((a) => a.status === 'auto_generated') || studentAdvices.find((a) => a.status === 'trainer_approved');

  // Calculations
  const healthScore = latestMetric ? calculateHealthScore(student, latestMetric) : null;
  const waterTarget = latestMetric ? calculateWaterTarget(latestMetric.weight, 45) : 2.5;
  const calorieTarget = latestMetric
    ? calculateCalorieTarget(latestMetric.bmr, student.healthGoal)
    : 1800;

  // Local Water Tracker State (liters logged today)
  const [loggedWaterMl, setLoggedWaterMl] = useState<number>(1800);
  const targetWaterMl = Math.round(waterTarget * 1000);
  const waterPercent = Math.min(100, Math.round((loggedWaterMl / targetWaterMl) * 100));

  const addWater = (ml: number) => {
    const updated = loggedWaterMl + ml;
    setLoggedWaterMl(updated);
    if (updated >= targetWaterMl && loggedWaterMl < targetWaterMl) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
      });
    }
  };

  // Camera & Gallery file input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Add Meal Form State with AI Vision Scanner
  const [showMealModal, setShowMealModal] = useState(false);
  const [mealType, setMealType] = useState<MealLog['mealType']>('Bữa trưa');
  const [mealImage, setMealImage] = useState('');
  const [foodDesc, setFoodDesc] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealItems, setMealItems] = useState<MealItem[]>([]);
  const [isFoodDetected, setIsFoodDetected] = useState<boolean | null>(null);
  const [nutritionAdvice, setNutritionAdvice] = useState('');
  const [nutritionScore, setNutritionScore] = useState<number | null>(null);
  const [healthTags, setHealthTags] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeSuccess, setAnalyzeSuccess] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  const recalculateTotalsFromItems = (updatedItems: MealItem[]) => {
    setMealItems(updatedItems);
    if (updatedItems.length > 0) {
      const totalCal = updatedItems.reduce((s, i) => s + (Number(i.calories) || 0), 0);
      const totalProt = updatedItems.reduce((s, i) => s + (Number(i.protein) || 0), 0);
      const totalCarb = updatedItems.reduce((s, i) => s + (Number(i.carbs) || 0), 0);
      const totalFatVal = updatedItems.reduce((s, i) => s + (Number(i.fat) || 0), 0);
      setCalories(String(Math.round(totalCal)));
      setProtein(String(Math.round(totalProt)));
      setCarbs(String(Math.round(totalCarb)));
      setFat(String(Math.round(totalFatVal)));
    }
  };

  // Handle Photo File Upload (Camera / File picker) with client-side compression
  const handlePhotoSelect = async (file: File) => {
    if (!file) return;

    try {
      setIsAnalyzing(true);
      setAnalyzeError('');
      setAnalyzeSuccess(false);
      setIsFoodDetected(null);

      // IMMEDIATELY reset old numbers so the user never sees obsolete values
      setFoodDesc('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setMealItems([]);
      setNutritionAdvice('');
      setNutritionScore(null);
      setHealthTags([]);

      // Compress client-side to ensure fast & reliable upload (<200KB)
      const { base64, mimeType } = await compressImage(file, 1200, 1200, 0.78);
      setMealImage(base64);

      // Trigger AI Vision analysis automatically
      await triggerAIAnalysis(base64, mimeType, '', file.name);
    } catch (err: any) {
      console.error('Lỗi khi nén và xử lý ảnh:', err);
      setAnalyzeError('Không thể nén tệp ảnh. Vui lòng thử lại với ảnh khác.');
      setIsAnalyzing(false);
    }
  };

  const triggerAIAnalysis = async (imgData: string, mimeType = 'image/jpeg', hint = '', fileTitle = '') => {
    setIsAnalyzing(true);
    setAnalyzeError('');
    setAnalyzeSuccess(false);
    setIsFoodDetected(null);

    try {
      const analysis = await analyzeMealPhoto({
        imageBase64: imgData,
        mimeType,
        studentGoal: student.healthGoal,
        mealType,
        studentName: student.fullName,
        dishHint: hint,
        fileName: fileTitle,
      });

      if (analysis && analysis.isFood === false) {
        setIsFoodDetected(false);
        setAnalyzeSuccess(false);
        setFoodDesc('');
        setCalories('');
        setProtein('');
        setCarbs('');
        setFat('');
        setMealItems([]);
        setNutritionAdvice('');
        setNutritionScore(null);
        setHealthTags([]);
        setAnalyzeError(
          analysis.nonFoodReason ||
            'Hình ảnh tải lên không phải là món ăn hoặc thực phẩm. Vui lòng chụp hoặc tải lên ảnh đĩa/tô thức ăn thực tế!'
        );
        return;
      }

      if (analysis && analysis.foodDescription) {
        setIsFoodDetected(true);
        setFoodDesc(analysis.foodDescription);
        setCalories(analysis.estimatedCalories ? String(analysis.estimatedCalories) : '');
        setProtein(analysis.macros?.protein !== undefined ? String(analysis.macros.protein) : '');
        setCarbs(analysis.macros?.carbs !== undefined ? String(analysis.macros.carbs) : '');
        setFat(analysis.macros?.fat !== undefined ? String(analysis.macros.fat) : '');
        setMealItems(Array.isArray(analysis.items) ? analysis.items : []);
        setNutritionAdvice(analysis.advice || '');
        setNutritionScore(analysis.nutritionScore || 9);
        setHealthTags(analysis.healthTags || ['AI Vision']);
        setAnalyzeSuccess(true);
      } else {
        setIsFoodDetected(false);
        setAnalyzeError('Không nhận diện được món ăn trong ảnh này. Vui lòng chụp rõ đĩa thức ăn hơn.');
      }
    } catch (err: any) {
      console.warn('AI meal analysis error:', err);
      setAnalyzeError(err.message || 'Không thể phân tích bữa ăn.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Google Drive Direct Link State (Load links from student's folder inside 1DJCFlItKnPr4-YGShTwmJEgiFQ8Yayqc without DB bloat)
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isLoadingDrivePhotos, setIsLoadingDrivePhotos] = useState(false);
  const [studentDriveFolderUrl, setStudentDriveFolderUrl] = useState<string>(
    student.driveFolderUrl || GOOGLE_DRIVE_PARENT_URL
  );
  const [studentDriveFolderId, setStudentDriveFolderId] = useState<string | null>(null);
  const [drivePhotos, setDrivePhotos] = useState<DrivePhotoItem[]>([]);
  const [driveNotification, setDriveNotification] = useState<string | null>(null);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);

  // Initialize Firebase Auth listener for Google Drive
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        if (token) setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Automatically load photo links from this student's Google Drive folder when opening student profile
  const loadPhotosFromStudentDriveFolder = async (tokenToUse?: string | null) => {
    const activeToken = tokenToUse || googleToken || (await getAccessToken());
    if (!activeToken) return;

    setIsLoadingDrivePhotos(true);
    try {
      const { folder, photos } = await listStudentDrivePhotos(
        activeToken,
        student.fullName,
        student.id
      );
      setStudentDriveFolderId(folder.folderId);
      setStudentDriveFolderUrl(folder.folderUrl);
      setDrivePhotos(photos);
      if (folder.folderUrl && folder.folderUrl !== student.driveFolderUrl) {
        updateStudentDriveFolder(student.id, folder.folderUrl);
      }
    } catch (err: any) {
      console.warn('Không thể tải danh sách ảnh từ thư mục Drive của học viên:', err);
    } finally {
      setIsLoadingDrivePhotos(false);
    }
  };

  useEffect(() => {
    setStudentDriveFolderUrl(student.driveFolderUrl || GOOGLE_DRIVE_PARENT_URL);
    setStudentDriveFolderId(null);
    setDrivePhotos([]);
    if (googleToken) {
      loadPhotosFromStudentDriveFolder(googleToken);
    }
  }, [student.id, googleToken]);

  const handleConnectGoogleDrive = async () => {
    setIsConnectingDrive(true);
    setDriveNotification(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        await loadPhotosFromStudentDriveFolder(res.accessToken);
        setDriveNotification(
          `Đã kết nối thư mục ảnh bữa ăn của ${student.fullName} trên Google Drive!`
        );
      }
    } catch (err: any) {
      console.error('Lỗi đăng nhập Google Drive:', err);
      setDriveNotification('Lỗi kết nối Google Drive: ' + (err.message || 'Vui lòng thử lại'));
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleMealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!mealImage && !foodDesc.trim()) {
      setAnalyzeError('Vui lòng chụp ảnh thức ăn hoặc tải ảnh bữa ăn lên để AI phân tích.');
      return;
    }

    let finalDriveFolderUrl = studentDriveFolderUrl || student.driveFolderUrl || GOOGLE_DRIVE_PARENT_URL;
    let finalDriveFileUrl = finalDriveFolderUrl;
    let lightweightImageLink =
      mealImage && !mealImage.startsWith('data:')
        ? mealImage
        : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

    // If Google Drive token is active, upload photo to the student's Drive folder
    const activeToken = googleToken || (await getAccessToken());
    if (mealImage && activeToken) {
      try {
        setIsUploadingToDrive(true);
        let targetFolderId = studentDriveFolderId;
        if (!targetFolderId) {
          const folder = await findOrCreateStudentFolder(activeToken, student.fullName, student.id);
          targetFolderId = folder.folderId;
          finalDriveFolderUrl = folder.folderUrl;
          setStudentDriveFolderId(folder.folderId);
          setStudentDriveFolderUrl(folder.folderUrl);
          updateStudentDriveFolder(student.id, folder.folderUrl);
        }

        const safeStudentName = student.fullName.replace(/\s+/g, '_');
        const fileName = `bua_an_${safeStudentName}_${mealType}_${Date.now()}.jpg`;
        const driveResult = await uploadMealPhotoToDrive(
          activeToken,
          targetFolderId,
          mealImage,
          'image/jpeg',
          fileName
        );
        lightweightImageLink = driveResult.directImageUrl;
        finalDriveFileUrl = driveResult.webViewLink;
        setDrivePhotos((prev) => [
          {
            id: driveResult.fileId,
            name: driveResult.fileName,
            directImageUrl: driveResult.directImageUrl,
            webViewLink: driveResult.webViewLink,
            createdTime: new Date().toISOString(),
          },
          ...prev,
        ]);
        setDriveNotification(
          `Đã lưu bữa ăn và tải ảnh lên thư mục Google Drive của ${student.fullName}!`
        );
      } catch (uploadErr: any) {
        console.warn('Không thể tải ảnh lên Google Drive:', uploadErr);
      } finally {
        setIsUploadingToDrive(false);
      }
    }

    if (isFoodDetected === false) {
      setAnalyzeError('Ảnh tải lên không phải là thức ăn. Vui lòng đổi sang ảnh chụp món ăn thực tế!');
      return;
    }

    await addMealLog({
      studentId: student.id,
      date: new Date().toISOString().split('T')[0],
      mealType,
      imageUrl: lightweightImageLink,
      foodDescription: foodDesc || 'Bữa ăn được AI phân tích từ ảnh chụp',
      estimatedCalories: parseInt(calories, 10) || 0,
      macros: {
        protein: parseInt(protein, 10) || 0,
        carbs: parseInt(carbs, 10) || 0,
        fat: parseInt(fat, 10) || 0,
      },
      items: mealItems,
      driveFolderUrl: finalDriveFolderUrl,
      driveFileUrl: finalDriveFileUrl,
      aiAnalyzed: true,
      nutritionAdvice:
        nutritionAdvice ||
        'Ăn chậm nhai kỹ, ưu tiên ăn rau xanh và đạm trước tinh bột để tối ưu chuyển hóa.',
    });
    setShowMealModal(false);
    setMealImage('');
    setFoodDesc('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setMealItems([]);
    setIsFoodDetected(null);
    setNutritionAdvice('');
    setAnalyzeSuccess(false);

    confetti({
      particleCount: 60,
      spread: 50,
      origin: { y: 0.8 },
    });
  };

  return (
    <div className="space-y-6">
      {/* Student Welcome Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center space-x-4">
            <img
              src={
                student.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
              }
              alt={student.fullName}
              className="w-16 h-16 rounded-2xl object-cover ring-4 ring-emerald-500/30 shadow-md"
            />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Cổng Thông Tin Học Viên (Student Portal)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white">
                  Read-Only Mode
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight mt-0.5">
                Xin chào, {student.fullName}!
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                Mục tiêu hiện tại: <span className="text-white font-semibold">{student.healthGoal}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setOpenReportModal(true)}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all backdrop-blur-xs flex items-center space-x-1.5 border border-white/20"
            >
              <Printer className="w-4 h-4" />
              <span>Xem Báo Cáo Sức Khỏe PDF</span>
            </button>
          </div>
        </div>

        {/* Gamification Badges Carousel */}
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center space-x-3 overflow-x-auto text-xs">
          <span className="text-slate-400 font-semibold shrink-0 flex items-center text-[11px]">
            <Award className="w-4 h-4 mr-1 text-amber-400" />
            Huy hiệu đạt được:
          </span>
          {badges.map((b) => (
            <div
              key={b.id}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-xl flex items-center space-x-1.5 shrink-0 border border-white/10 transition-colors cursor-default"
              title={b.description}
            >
              <span className="text-base">{b.icon}</span>
              <span className="font-bold text-white text-[11px]">{b.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Sub-tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-1 text-xs font-semibold">
        {[
          { key: 'overview', label: 'Tổng Quan & Mục Tiêu Hôm Nay', icon: Sparkles },
          { key: 'nutrition', label: 'Nhật Ký Dinh Dưỡng Daily', icon: Utensils, count: studentMeals.length },
          { key: 'workout', label: 'Nhật Ký Tập Luyện', icon: Dumbbell, count: studentWorkouts.length },
          { key: 'metrics', label: '10 Chỉ Số & Biểu Đồ Cá Nhân', icon: Calendar, count: studentMetrics.length },
          { key: 'physique', label: 'Ảnh Vóc Dáng (Before/After)', icon: Camera, count: studentPhotos.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center space-x-2 py-3 px-4 border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-emerald-600 text-emerald-800 font-bold bg-emerald-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar (Health Score, Water Tracker, Calorie Target) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Health Score Gauge */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Điểm Sức Khỏe Tổng Thể
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {healthScore ? healthScore.tier : 'Chưa có dữ liệu'}
                </span>
              </div>

              <div className="my-4 text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-3xl shadow-lg shadow-emerald-500/20">
                  {healthScore ? healthScore.totalScore : '--'}
                </div>
                <div className="text-xs text-slate-500 mt-2 font-medium">
                  Tính toán theo chuẩn trọng số 10 chỉ số sinh học
                </div>
              </div>

              <div className="text-[11px] text-slate-500 text-center border-t border-slate-100 pt-2">
                Hạng vóc dáng: <strong className="text-slate-800">{latestMetric?.bodyType || 'Đang cập nhật'}</strong>
              </div>
            </div>

            {/* Smart Water Tracker (SRS 2.4.B & UC-NOTIF-02) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-700 flex items-center">
                  <Droplet className="w-3.5 h-3.5 mr-1 text-cyan-500" />
                  Mục Tiêu Nước Trong Ngày
                </span>
                <span className="text-xs font-bold text-cyan-800 font-mono">
                  {loggedWaterMl} / {targetWaterMl} ml
                </span>
              </div>

              <div className="my-3">
                <div className="flex justify-between items-baseline mb-1 text-xs">
                  <span className="font-bold text-slate-800 text-lg">{waterPercent}%</span>
                  <span className="text-slate-500 text-[11px]">
                    Còn thiếu {Math.max(0, targetWaterMl - loggedWaterMl)} ml
                  </span>
                </div>
                <div className="w-full bg-cyan-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${waterPercent}%` }}
                  ></div>
                </div>

                {/* Reminder Alert Message (UC-NOTIF-02) */}
                <div className="mt-2.5 p-2 rounded-xl bg-cyan-50 border border-cyan-200 text-[11px] text-cyan-900 flex items-center space-x-1.5">
                  <Bell className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                  <span>
                    Nhắc nhở: Uống đều đặn mỗi 2 tiếng để hỗ trợ đào thải mỡ và phục hồi cơ.
                  </span>
                </div>
              </div>

              {/* Quick Log Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => addWater(250)}
                  className="py-1.5 px-3 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1 border border-cyan-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+250 ml (1 Cốc)</span>
                </button>
                <button
                  onClick={() => addWater(500)}
                  className="py-1.5 px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+500 ml (1 Bình)</span>
                </button>
              </div>
            </div>

            {/* Calorie & Nutrition Baseline (SRS 2.4.B) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-orange-700 flex items-center">
                  <Flame className="w-3.5 h-3.5 mr-1 text-orange-500" />
                  Mức Calo Nạp Hàng Ngày
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">
                  SRS 2.4.B Formula
                </span>
              </div>

              <div className="my-3 text-center">
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {calorieTarget} <span className="text-sm font-semibold text-slate-500">Kcal</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Mức năng lượng tối thiểu khuyến nghị
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-medium">Protein</div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {Math.round((latestMetric?.weight || 70) * 1.8)}g
                    </div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-medium">Carb</div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {Math.round((calorieTarget * 0.45) / 4)}g
                    </div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-medium">Fat</div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {Math.round((calorieTarget * 0.25) / 9)}g
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 text-center border-t border-slate-100 pt-2">
                BMR: {latestMetric?.bmr || 1600} Kcal • Điều chỉnh theo mục tiêu
              </div>
            </div>
          </div>

          {/* Instant AI Advice & Medical Analysis (No approval required) */}
          {latestAdvice ? (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-3xl p-6 border-2 border-emerald-300 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-200">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Lời Khuyên & Phân Tích Sức Khỏe AI Tự Động
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setOpenStandardsModal(true)}
                    className="text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100/60 px-3 py-1 rounded-full border border-emerald-300 transition-colors cursor-pointer"
                  >
                    Xem 4 Bảng Chuẩn Y Tế
                  </button>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                    Kỳ đo ngày {latestAdvice.date}
                  </span>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-800 space-y-3 leading-relaxed">
                <div className="p-3.5 bg-white rounded-2xl border border-emerald-200 shadow-2xs">
                  <div className="font-bold text-emerald-950 mb-1 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Đánh giá thể trạng & Nguy cơ bệnh lý:
                  </div>
                  <p className="font-semibold text-slate-800">
                    "{latestAdvice.trainerEditedContent || latestAdvice.aiDraftContent.summary}"
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-emerald-100">
                    <div className="font-bold text-slate-900 mb-1">Thực đơn dinh dưỡng khuyến nghị:</div>
                    <p className="text-slate-600">{latestAdvice.aiDraftContent.nutritionAdvice}</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-emerald-100">
                    <div className="font-bold text-slate-900 mb-1">Kế hoạch tập luyện theo mục tiêu:</div>
                    <p className="text-slate-600">{latestAdvice.aiDraftContent.workoutAdvice}</p>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-100/50 rounded-xl text-[11px] text-emerald-950 font-medium">
                  💧 <strong>Lối sống & Uống nước:</strong> {latestAdvice.aiDraftContent.lifestyleTip}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 text-center text-xs text-slate-500">
              Chưa có dữ liệu lời khuyên. Khi HLV cập nhật lần cân đo mới, AI sẽ phân tích tức thì!
            </div>
          )}

          {/* Quick Metrics History Preview */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                10 Chỉ Số Lần Cân Đo Gần Nhất ({latestMetric?.date || 'Chưa có'})
              </h3>
              <button
                onClick={() => setActiveTab('metrics')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center"
              >
                <span>Xem tất cả lịch sử</span>
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>

            {latestMetric ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs text-center">
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-400">1. Cân nặng</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">{latestMetric.weight} kg</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-400">2. Mỡ dưới da</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">{latestMetric.subcutaneousFat} %</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-400">3. Canxi xương</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">{latestMetric.boneCalcium}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-400">4. Lượng nước</div>
                  <div className="font-extrabold text-cyan-700 mt-0.5">{latestMetric.bodyWater} %</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-400">5. Cơ bắp</div>
                  <div className="font-extrabold text-emerald-700 mt-0.5">{latestMetric.muscleMass} kg</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-400">6. Thể hình</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">{latestMetric.bodyType}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-400">7. BMR</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">{latestMetric.bmr} Kcal</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-400">8. Tuổi sinh học</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">{latestMetric.biologicalAge} tuổi</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-400">9. Mỡ nội tạng</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">Cấp {latestMetric.visceralFat}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-400">10. Vòng eo</div>
                  <div className="font-extrabold text-amber-700 mt-0.5">{latestMetric.waist} cm</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">Chưa có dữ liệu cân đo</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Nutrition Log */}
      {activeTab === 'nutrition' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <Utensils className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Nhật Ký Dinh Dưỡng Hàng Ngày (AI Phân Tích Bữa Ăn)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Chụp ảnh thức ăn hoặc đẩy ảnh lên — AI sẽ phân tích món ăn, tính tổng Calo và đưa ra gợi ý cải thiện bữa ăn.
              </p>
            </div>
            <button
              onClick={() => {
                setMealImage('');
                setFoodDesc('');
                setCalories('');
                setProtein('');
                setCarbs('');
                setFat('');
                setMealItems([]);
                setIsFoodDetected(null);
                setNutritionAdvice('');
                setNutritionScore(null);
                setHealthTags([]);
                setAnalyzeSuccess(false);
                setAnalyzeError('');
                if (cameraInputRef.current) cameraInputRef.current.value = '';
                if (galleryInputRef.current) galleryInputRef.current.value = '';
                setShowMealModal(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Chụp / Đẩy Ảnh Bữa Ăn Lên</span>
            </button>
          </div>

          {/* Google Drive Folder Direct Link & Photos Section */}
          <div className="space-y-3">
            <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-emerald-300 shadow-2xs flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex flex-wrap items-center gap-2">
                    <span>Thư Mục Ảnh Bữa Ăn Trên Google Drive:</span>
                    <span className="font-mono font-bold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                      FitTrack_{student.fullName.replace(/\s+/g, '_')}_{student.id}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Ảnh bữa ăn và dữ liệu đồng bộ trực tiếp với Google Drive của HLV.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!googleToken ? (
                  <button
                    type="button"
                    onClick={handleConnectGoogleDrive}
                    disabled={isConnectingDrive}
                    className="inline-flex items-center space-x-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl border border-slate-300 shadow-xs transition-all text-xs cursor-pointer"
                  >
                    <Folder className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isConnectingDrive ? 'Đang kết nối...' : 'Kết Nối Google Drive'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => loadPhotosFromStudentDriveFolder(googleToken)}
                    disabled={isLoadingDrivePhotos}
                    className="px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-800 font-bold rounded-xl border border-emerald-300 shadow-2xs transition-all text-xs cursor-pointer flex items-center space-x-1.5"
                  >
                    <Folder className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isLoadingDrivePhotos ? 'Đang lấy link ảnh...' : 'Làm Mới Ảnh Từ Drive'}</span>
                  </button>
                )}

                <a
                  href={studentDriveFolderUrl || GOOGLE_DRIVE_PARENT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở Folder Drive Học Viên</span>
                </a>
              </div>
            </div>

            {driveNotification && (
              <div className="px-3.5 py-2 bg-emerald-100/80 border border-emerald-300 text-emerald-950 font-semibold rounded-xl text-[11px] flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{driveNotification}</span>
              </div>
            )}

            {/* Direct Photos Loaded From Student's Google Drive Folder */}
            {drivePhotos.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ảnh bữa ăn lấy trực tiếp từ Folder Drive của {student.fullName} ({drivePhotos.length} ảnh)</span>
                  </span>
                  <a
                    href={studentDriveFolderUrl || GOOGLE_DRIVE_PARENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center space-x-1"
                  >
                    <span>Xem toàn bộ trên Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
                  {drivePhotos.map((p) => (
                    <a
                      key={p.id}
                      href={p.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white shadow-2xs"
                      title={p.name}
                    >
                      <img
                        src={p.directImageUrl}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {studentMeals.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              <Utensils className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              Bạn chưa tải lên bữa ăn nào hôm nay. Bấm "Chụp / Đẩy Ảnh Bữa Ăn Lên" để AI tính tổng Calo và gợi ý cải thiện bữa ăn!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {studentMeals.map((m) => (
                <div key={m.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex flex-col justify-between space-y-3">
                  <div className="flex gap-3.5">
                    <div className="relative shrink-0">
                      <img
                        src={m.imageUrl}
                        alt={m.foodDescription}
                        className="w-24 h-24 rounded-xl object-cover ring-1 ring-slate-200"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600/90 text-white backdrop-blur-xs flex items-center space-x-0.5 shadow-xs">
                        <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                        AI
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                          {m.mealType}
                        </span>
                        <span className="text-slate-400 text-[10px]">{m.date} • {m.loggedAt}</span>
                      </div>
                      <p className="mt-1 text-slate-800 leading-relaxed font-semibold text-xs line-clamp-2">
                        {m.foodDescription}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
                        <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                          🔥 Tổng Calo: {m.estimatedCalories} Kcal
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          Protein: {m.macros.protein}g
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                          Chất béo: {m.macros.fat}g
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          Tinh bột: {m.macros.carbs}g
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Per-Item Breakdown in Saved Meal Log */}
                  {m.items && m.items.length > 0 && (
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 space-y-1.5">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                        Chi tiết từng món trong bữa ăn:
                      </div>
                      <div className="divide-y divide-slate-100">
                        {m.items.map((item, idx) => (
                          <div key={idx} className="py-1 flex items-center justify-between text-[11px]">
                            <div className="font-semibold text-slate-800">
                              • {item.name}{' '}
                              <span className="text-slate-400 font-normal">({item.portion})</span>
                            </div>
                            <div className="flex items-center space-x-2 text-[10px] font-bold shrink-0">
                              <span className="text-orange-700">{item.calories} Kcal</span>
                              <span className="text-blue-700">P: {item.protein}g</span>
                              <span className="text-rose-700">F: {item.fat}g</span>
                              <span className="text-amber-700">C: {item.carbs}g</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Nutrition Assessment Note */}
                  {m.nutritionAdvice && (
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-950 font-medium flex items-start space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Gợi ý & Lưu ý từ AI: </span>
                        <span>{m.nutritionAdvice}</span>
                      </div>
                    </div>
                  )}

                  {/* Drive Link & Coach Reaction */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <a
                        href={m.driveFolderUrl || GOOGLE_DRIVE_FOLDER_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                      >
                        <Folder className="w-3.5 h-3.5" />
                        <span>Google Drive</span>
                      </a>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400 text-[10px]">Phản hồi HLV:</span>
                      {m.trainerReaction ? (
                        <span className="text-base">{m.trainerReaction}</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Đang chờ xem</span>
                      )}
                      {m.trainerComment && (
                        <span className="text-[11px] text-emerald-800 font-bold max-w-[140px] truncate" title={m.trainerComment}>
                          "{m.trainerComment}"
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Workout Log */}
      {activeTab === 'workout' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Giáo Án & Nhật Ký Tập Luyện (SRS 3.1)
              </h3>
              <p className="text-xs text-slate-500">
                Tick chọn các bài tập hoàn thành trong ngày theo chương trình HLV đã giao
              </p>
            </div>
          </div>

          {studentWorkouts.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Chưa có nhật ký buổi tập nào được giao hoặc hoàn thành
            </div>
          ) : (
            <div className="space-y-4">
              {studentWorkouts.map((w) => (
                <div key={w.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{w.planTitle}</h4>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Thời gian tập: {w.durationMinutes} phút • Ngày: {w.date}
                      </div>
                    </div>
                    {w.trainerReaction && (
                      <div className="flex items-center space-x-1 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-slate-400 text-[10px]">HLV:</span>
                        <span className="text-base">{w.trainerReaction}</span>
                      </div>
                    )}
                  </div>

                  {/* Exercise Checklist */}
                  <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {w.exercises.map((ex) => (
                      <div
                        key={ex.id}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                          ex.completed
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-bold">{ex.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {ex.sets} • {ex.reps}
                          </div>
                        </div>
                        {ex.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400">Chưa tập</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {w.trainerComment && (
                    <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-indigo-950 font-semibold text-xs">
                      💬 Nhận xét của Huấn Luyện Viên: "{w.trainerComment}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Metrics History & Chart */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <MetricsCharts metrics={studentMetrics} />

          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs">
            <h3 className="font-bold text-slate-900 text-sm mb-3">
              Lịch Sử 10 Chỉ Số Cân Đo (Read-Only)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-3 font-bold">Ngày</th>
                    <th className="py-2.5 px-3 font-bold">Cân Nặng</th>
                    <th className="py-2.5 px-3 font-bold">Mỡ Dưới Da</th>
                    <th className="py-2.5 px-3 font-bold">Lượng Nước</th>
                    <th className="py-2.5 px-3 font-bold">Cơ Bắp</th>
                    <th className="py-2.5 px-3 font-bold">Thể Hình</th>
                    <th className="py-2.5 px-3 font-bold">BMR</th>
                    <th className="py-2.5 px-3 font-bold">Tuổi Sinh Học</th>
                    <th className="py-2.5 px-3 font-bold">Mỡ Nội Tạng</th>
                    <th className="py-2.5 px-3 font-bold">Vòng Eo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentMetrics.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-bold">{m.date}</td>
                      <td className="py-3 px-3 font-extrabold text-indigo-700">{m.weight} kg</td>
                      <td className="py-3 px-3">{m.subcutaneousFat}%</td>
                      <td className="py-3 px-3 text-cyan-700 font-semibold">{m.bodyWater}%</td>
                      <td className="py-3 px-3 text-emerald-700 font-bold">{m.muscleMass} kg</td>
                      <td className="py-3 px-3">{m.bodyType}</td>
                      <td className="py-3 px-3">{m.bmr}</td>
                      <td className="py-3 px-3">{m.biologicalAge}</td>
                      <td className="py-3 px-3 font-bold text-rose-700">Cấp {m.visceralFat}</td>
                      <td className="py-3 px-3 font-semibold text-amber-700">{m.waist} cm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Physique Before/After */}
      {activeTab === 'physique' && (
        <BeforeAfterViewer photos={studentPhotos} studentId={student.id} />
      )}

      {/* Upload Meal Modal with Direct AI Meal Photo Analysis */}
      {showMealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    AI Phân Tích Bữa Ăn Qua Ảnh Chụp
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Chụp ảnh thức ăn hoặc đẩy ảnh lên để AI tính tổng Calo và gợi ý cải thiện bữa ăn
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMealModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleMealSubmit} className="space-y-4 text-xs">
              {/* Meal Type Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Thời điểm bữa ăn</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['Bữa sáng', 'Bữa trưa', 'Bữa tối', 'Bữa phụ'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setMealType(t);
                        if (mealImage) triggerAIAnalysis(mealImage, 'image/jpeg', '', '');
                      }}
                      className={`py-2 px-2 text-center rounded-xl font-bold transition-all text-xs cursor-pointer ${
                        mealType === t
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photo Input & Dual Camera / Gallery Action */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Ảnh chụp thức ăn của bạn</span>
                  <span className="text-[11px] text-emerald-700 font-semibold">AI tự động phân tích ngay khi chọn ảnh</span>
                </label>

                {/* Hidden File pickers for Camera & Gallery */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoSelect(file);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoSelect(file);
                    e.target.value = '';
                  }}
                />

                {/* Prominent Action Buttons: Camera vs Upload */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold flex items-center justify-center space-x-2 cursor-pointer shadow-xs active:scale-98 transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Chụp Ảnh Thức Ăn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center space-x-2 cursor-pointer shadow-xs active:scale-98 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Đẩy Ảnh Từ Máy Lên</span>
                  </button>
                </div>

                {/* Photo Preview & Scanning Animation Overlay */}
                <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 aspect-video bg-slate-50 flex items-center justify-center">
                  {mealImage ? (
                    <>
                      <img
                        src={mealImage}
                        alt="Meal Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setMealImage('');
                          setFoodDesc('');
                          setCalories('');
                          setProtein('');
                          setCarbs('');
                          setFat('');
                          setMealItems([]);
                          setIsFoodDetected(null);
                          setNutritionAdvice('');
                          setNutritionScore(null);
                          setHealthTags([]);
                          setAnalyzeSuccess(false);
                          setAnalyzeError('');
                          if (cameraInputRef.current) cameraInputRef.current.value = '';
                          if (galleryInputRef.current) galleryInputRef.current.value = '';
                        }}
                        className="absolute top-2 right-2 bg-rose-600/90 hover:bg-rose-700 text-white backdrop-blur-xs px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center space-x-1 shadow-md cursor-pointer z-20"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Đổi ảnh khác</span>
                      </button>
                    </>
                  ) : (
                    <div
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-6 text-center text-slate-400 cursor-pointer hover:bg-slate-100/70 transition-colors w-full h-full"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center mb-2">
                        <Camera className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-700 text-xs">
                        Bấm để chụp ảnh hoặc đẩy ảnh thức ăn lên
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                        AI sẽ tự động phân tích bữa ăn, đưa ra tổng lượng Calo của món ăn và gợi ý cải thiện bữa ăn / lưu ý dinh dưỡng.
                      </p>
                    </div>
                  )}

                  {/* Scanning Animation Overlay */}
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-10 animate-in fade-in">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center mb-3 animate-pulse">
                        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                      </div>
                      <div className="font-extrabold text-white text-sm">
                        AI Đang Phân Tích Bữa Ăn Của Bạn...
                      </div>
                      <div className="text-[11px] text-emerald-300 mt-1 max-w-xs">
                        Đang tính tổng lượng Calo và tổng hợp gợi ý cải thiện bữa ăn...
                      </div>
                    </div>
                  )}

                  {!isAnalyzing && analyzeSuccess && isFoodDetected === true && mealImage && (
                    <div className="absolute top-2 left-2 bg-emerald-600/95 text-white backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1 shadow-md">
                      <Check className="w-3 h-3" />
                      <span>AI đã nhận diện món ăn</span>
                    </div>
                  )}

                  {!isAnalyzing && isFoodDetected === false && mealImage && (
                    <div className="absolute top-2 left-2 bg-rose-600/95 text-white backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1 shadow-md">
                      <span>⚠️ Không phải ảnh thức ăn</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Non-Food Rejection Warning Banner */}
              {!isAnalyzing && (isFoodDetected === false || analyzeError) && (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 space-y-1.5 shadow-xs">
                  <div className="font-extrabold text-xs text-rose-700 flex items-center space-x-1.5">
                    <span>⚠️ Phát Hiện Hình Ảnh Không Phải Là Món Ăn</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-rose-900">
                    {analyzeError ||
                      'Hình ảnh bạn vừa tải lên là bảng số liệu, tài liệu văn bản hoặc không chứa thức ăn. Hệ thống không tạo dữ liệu Calo giả cho ảnh không phải thực phẩm.'}
                  </p>
                  <p className="text-[11px] text-rose-700 font-bold">
                    👉 Hãy bấm "Đổi ảnh khác" hoặc "Chụp Ảnh Thức Ăn" để chụp trực tiếp đĩa/tô món ăn của bạn.
                  </p>
                </div>
              )}

              {/* AI Analysis Result Panel: Shown ONLY when a valid food image is detected */}
              {!isAnalyzing && isFoodDetected === true && (foodDesc || calories) && (
                <div className="space-y-3 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-slate-50 p-4 border-2 border-emerald-200 shadow-xs">
                  {/* 1. Prominent Total Calories & Total Macros (Protein, Fat, Carbs) */}
                  <div className="bg-white p-3.5 rounded-2xl border border-orange-200 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                          <Flame className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-orange-700">
                            Tổng Năng Lượng Bữa Ăn
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Tổng hợp từ {mealItems.length || 1} món/thành phần trong ảnh
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex items-baseline space-x-1">
                        <input
                          type="number"
                          required
                          value={calories}
                          onChange={(e) => setCalories(e.target.value)}
                          className="w-20 font-black text-2xl text-orange-600 text-right bg-transparent border-b border-dashed border-orange-300 focus:outline-hidden"
                        />
                        <span className="font-extrabold text-xs text-orange-700">Kcal</span>
                      </div>
                    </div>

                    {/* Total Protein, Fat, Carbs Inputs */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                      <div className="p-2 rounded-xl bg-blue-50/80 border border-blue-200">
                        <div className="text-[10px] font-bold text-blue-700 uppercase">Tổng Protein (Đạm)</div>
                        <div className="flex items-baseline justify-center space-x-0.5 mt-0.5">
                          <input
                            type="number"
                            value={protein}
                            onChange={(e) => setProtein(e.target.value)}
                            className="w-12 text-center font-black text-sm text-blue-900 bg-transparent border-b border-dashed border-blue-300 focus:outline-hidden"
                          />
                          <span className="text-[11px] font-bold text-blue-700">g</span>
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-rose-50/80 border border-rose-200">
                        <div className="text-[10px] font-bold text-rose-700 uppercase">Tổng Chất Béo (Fat)</div>
                        <div className="flex items-baseline justify-center space-x-0.5 mt-0.5">
                          <input
                            type="number"
                            value={fat}
                            onChange={(e) => setFat(e.target.value)}
                            className="w-12 text-center font-black text-sm text-rose-900 bg-transparent border-b border-dashed border-rose-300 focus:outline-hidden"
                          />
                          <span className="text-[11px] font-bold text-rose-700">g</span>
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200">
                        <div className="text-[10px] font-bold text-amber-700 uppercase">Tổng Tinh Bột (Carb)</div>
                        <div className="flex items-baseline justify-center space-x-0.5 mt-0.5">
                          <input
                            type="number"
                            value={carbs}
                            onChange={(e) => setCarbs(e.target.value)}
                            className="w-12 text-center font-black text-sm text-amber-900 bg-transparent border-b border-dashed border-amber-300 focus:outline-hidden"
                          />
                          <span className="text-[11px] font-bold text-amber-700">g</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Per-Dish / Per-Item Calorie, Protein & Fat Breakdown */}
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 text-xs flex items-center">
                        <Utensils className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                        Chi Tiết Calo, Protein & Chất Béo Từng Món Trong Ảnh:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [
                            ...mealItems,
                            { name: 'Món thêm', portion: '100g', calories: 100, protein: 8, carbs: 10, fat: 3 },
                          ];
                          recalculateTotalsFromItems(next);
                        }}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 cursor-pointer"
                      >
                        + Thêm món
                      </button>
                    </div>

                    <div className="space-y-2">
                      {mealItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => {
                                const copy = [...mealItems];
                                copy[idx] = { ...copy[idx], name: e.target.value };
                                setMealItems(copy);
                              }}
                              className="flex-1 font-bold text-slate-900 text-xs bg-white px-2 py-1 rounded border border-slate-200"
                              placeholder="Tên món ăn"
                            />
                            <input
                              type="text"
                              value={item.portion}
                              onChange={(e) => {
                                const copy = [...mealItems];
                                copy[idx] = { ...copy[idx], portion: e.target.value };
                                setMealItems(copy);
                              }}
                              className="w-24 text-[11px] font-semibold text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 text-center"
                              placeholder="Định lượng"
                            />
                            {mealItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = mealItems.filter((_, i) => i !== idx);
                                  recalculateTotalsFromItems(next);
                                }}
                                className="text-slate-400 hover:text-rose-600 px-1 font-bold cursor-pointer"
                                title="Xóa món này"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                            <div className="bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 flex items-center justify-between">
                              <span className="font-bold text-orange-800">Calo:</span>
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  value={item.calories}
                                  onChange={(e) => {
                                    const copy = [...mealItems];
                                    copy[idx] = { ...copy[idx], calories: Number(e.target.value) || 0 };
                                    recalculateTotalsFromItems(copy);
                                  }}
                                  className="w-11 text-right font-extrabold text-orange-700 bg-transparent focus:outline-hidden"
                                />
                                <span className="ml-0.5 text-orange-700 font-bold">Kcal</span>
                              </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 flex items-center justify-between">
                              <span className="font-bold text-blue-800">Đạm:</span>
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  value={item.protein}
                                  onChange={(e) => {
                                    const copy = [...mealItems];
                                    copy[idx] = { ...copy[idx], protein: Number(e.target.value) || 0 };
                                    recalculateTotalsFromItems(copy);
                                  }}
                                  className="w-8 text-right font-extrabold text-blue-700 bg-transparent focus:outline-hidden"
                                />
                                <span className="ml-0.5 text-blue-700 font-bold">g</span>
                              </div>
                            </div>

                            <div className="bg-rose-50 border border-rose-200 rounded-lg px-2 py-1 flex items-center justify-between">
                              <span className="font-bold text-rose-800">Béo:</span>
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  value={item.fat}
                                  onChange={(e) => {
                                    const copy = [...mealItems];
                                    copy[idx] = { ...copy[idx], fat: Number(e.target.value) || 0 };
                                    recalculateTotalsFromItems(copy);
                                  }}
                                  className="w-8 text-right font-extrabold text-rose-700 bg-transparent focus:outline-hidden"
                                />
                                <span className="ml-0.5 text-rose-700 font-bold">g</span>
                              </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 flex items-center justify-between">
                              <span className="font-bold text-amber-800">Carb:</span>
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  value={item.carbs}
                                  onChange={(e) => {
                                    const copy = [...mealItems];
                                    copy[idx] = { ...copy[idx], carbs: Number(e.target.value) || 0 };
                                    recalculateTotalsFromItems(copy);
                                  }}
                                  className="w-8 text-right font-extrabold text-amber-700 bg-transparent focus:outline-hidden"
                                />
                                <span className="ml-0.5 text-amber-700 font-bold">g</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. Summary Description */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/90">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800 text-[11px]">
                        Tóm tắt bữa ăn nhận diện từ ảnh:
                      </span>
                      {nutritionScore && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Điểm: {nutritionScore}/10
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      required
                      value={foodDesc}
                      onChange={(e) => setFoodDesc(e.target.value)}
                      className="w-full text-xs text-slate-800 font-semibold bg-slate-50/70 p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 4. AI Meal Improvement Suggestions & Notes */}
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-300 shadow-2xs">
                    <div className="font-extrabold text-emerald-900 text-xs flex items-center space-x-1.5 mb-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Gợi Ý Cải Thiện Bữa Ăn & Lưu Ý Từ AI:</span>
                    </div>
                    <textarea
                      rows={3}
                      value={nutritionAdvice}
                      onChange={(e) => setNutritionAdvice(e.target.value)}
                      className="w-full text-xs text-emerald-950 font-medium leading-relaxed bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setShowMealModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={
                    isAnalyzing ||
                    isUploadingToDrive ||
                    !mealImage ||
                    isFoodDetected === false ||
                    !calories
                  }
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isUploadingToDrive ? 'Đang lưu...' : 'Lưu Bữa Ăn Vào Hệ Thống'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
