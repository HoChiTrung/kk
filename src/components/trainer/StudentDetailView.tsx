/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StudentProfile, HealthMetricRecord } from '../../types/health';
import { useHealth } from '../../context/HealthContext';
import {
  calculateHealthScore,
  detectAnomalies,
  calculateGapAnalysis,
} from '../../utils/healthCalculations';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
} from '../../services/googleDriveAuth';
import {
  GOOGLE_DRIVE_PARENT_URL,
  DrivePhotoItem,
  listStudentDrivePhotos,
} from '../../services/googleDriveService';
import { MetricsCharts } from '../common/MetricsCharts';
import { BeforeAfterViewer } from '../common/BeforeAfterViewer';
import { AIAdviceQueue } from './AIAdviceQueue';
import { AddMetricModal } from '../modals/AddMetricModal';
import { AddStudentModal } from '../modals/AddStudentModal';
import {
  Scale,
  Activity,
  AlertTriangle,
  Target,
  Sparkles,
  Award,
  Calendar,
  Phone,
  MapPin,
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Utensils,
  Dumbbell,
  CheckCircle2,
  ArrowRight,
  Printer,
  ChevronRight,
  Folder,
  ExternalLink,
} from 'lucide-react';

interface StudentDetailViewProps {
  student: StudentProfile;
}

export const StudentDetailView: React.FC<StudentDetailViewProps> = ({ student }) => {
  const {
    getStudentMetrics,
    getStudentAdvices,
    getStudentMeals,
    getStudentWorkouts,
    getStudentPhotos,
    deleteMetricRecord,
    addMealFeedback,
    addWorkoutFeedback,
    updateStudentDriveFolder,
    setOpenReportModal,
  } = useHealth();

  const [activeTab, setActiveTab] = useState<
    'metrics' | 'charts' | 'ai-advice' | 'physique' | 'daily-logs'
  >('metrics');

  const [showAddMetricModal, setShowAddMetricModal] = useState(false);
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);

  // Data for this student
  const studentMetrics = getStudentMetrics(student.id);
  const studentAdvices = getStudentAdvices(student.id);
  const studentMeals = getStudentMeals(student.id);
  const studentWorkouts = getStudentWorkouts(student.id);
  const studentPhotos = getStudentPhotos(student.id);

  const latestMetric = studentMetrics[studentMetrics.length - 1];
  const firstMetric = studentMetrics[0];

  // Algorithmic Health Score & Anomaly Detection
  const healthScore = latestMetric ? calculateHealthScore(student, latestMetric) : null;
  const anomalies = latestMetric ? detectAnomalies(student, latestMetric, studentMetrics) : [];
  const gapAnalysis = calculateGapAnalysis(student, latestMetric, firstMetric);

  // Google Drive Direct Folder Link & Photos State for Trainer (Zero DB Bloat)
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [studentDriveFolderUrl, setStudentDriveFolderUrl] = useState<string>(
    student.driveFolderUrl || GOOGLE_DRIVE_PARENT_URL
  );
  const [drivePhotos, setDrivePhotos] = useState<DrivePhotoItem[]>([]);
  const [isSyncingFolder, setIsSyncingFolder] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

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

  const loadStudentDrivePhotos = async (tokenToUse?: string | null) => {
    const activeToken = tokenToUse || googleToken || (await getAccessToken());
    if (!activeToken) return;

    setIsSyncingFolder(true);
    try {
      const { folder, photos } = await listStudentDrivePhotos(
        activeToken,
        student.fullName,
        student.id
      );
      setStudentDriveFolderUrl(folder.folderUrl);
      setDrivePhotos(photos);
      if (folder.folderUrl && folder.folderUrl !== student.driveFolderUrl) {
        updateStudentDriveFolder(student.id, folder.folderUrl);
      }
    } catch (err: any) {
      console.warn('Không thể tải link ảnh từ thư mục Drive:', err);
    } finally {
      setIsSyncingFolder(false);
    }
  };

  useEffect(() => {
    setStudentDriveFolderUrl(student.driveFolderUrl || GOOGLE_DRIVE_PARENT_URL);
    setDrivePhotos([]);
    setSyncStatus(null);
    if (googleToken) {
      loadStudentDrivePhotos(googleToken);
    }
  }, [student.id, googleToken]);

  const handleCreateStudentFolder = async () => {
    let token = googleToken || (await getAccessToken());
    if (!token) {
      try {
        const res = await googleSignIn();
        if (res) {
          token = res.accessToken;
          setGoogleUser(res.user);
          setGoogleToken(res.accessToken);
        }
      } catch (err: any) {
        setSyncStatus('Lỗi kết nối Google: ' + (err.message || 'Thử lại'));
        return;
      }
    }

    if (!token) return;

    setIsSyncingFolder(true);
    setSyncStatus(null);
    try {
      const { folder, photos } = await listStudentDrivePhotos(token, student.fullName, student.id);
      setStudentDriveFolderUrl(folder.folderUrl);
      setDrivePhotos(photos);
      updateStudentDriveFolder(student.id, folder.folderUrl);
      setSyncStatus(
        `Đã lấy link từ thư mục "${folder.folderName}" trên Google Drive (${photos.length} ảnh bữa ăn)!`
      );
    } catch (err: any) {
      console.error('Lỗi tải thư mục:', err);
      setSyncStatus('Lỗi khi truy cập thư mục Drive: ' + (err.message || 'Thử lại'));
    } finally {
      setIsSyncingFolder(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Avatar & Core Bio */}
          <div className="flex items-start sm:items-center space-x-4">
            <img
              src={
                student.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
              }
              alt={student.fullName}
              className="w-20 h-20 rounded-2xl object-cover ring-4 ring-emerald-50 shadow-md"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {student.fullName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                  {student.gender} • {student.age} tuổi
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {student.height} m
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center">
                  <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {student.phone}
                </span>
                <span className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  Sinh ngày: {student.dateOfBirth}
                </span>
                {student.address && (
                  <span className="flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    {student.address}
                  </span>
                )}
              </div>

              {/* Baseline Target Pill */}
              <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <span className="font-bold text-slate-700 mr-1.5 flex-inline items-center">
                  <Target className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />
                  Mục tiêu sức khỏe:
                </span>
                <span className="text-slate-600 font-medium">{student.healthGoal}</span>
              </div>
            </div>
          </div>

          {/* Quick Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => setShowEditStudentModal(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Sửa Hồ Sơ</span>
            </button>

            <button
              onClick={() => setShowAddMetricModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nhập 10 Chỉ Số Mới</span>
            </button>

            <button
              onClick={() => setOpenReportModal(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1"
              title="Xuất Báo Cáo PDF Chuẩn SRS 3.5"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Xuất PDF</span>
            </button>
          </div>
        </div>

        {/* Anomaly Alerts Notification Box (SRS 2.4.A) */}
        {anomalies.length > 0 && (
          <div className="mt-5 space-y-2">
            {anomalies.map((a, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-2xl border text-xs flex items-start space-x-3 ${
                  a.severity === 'high'
                    ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                    : 'bg-amber-50/90 border-amber-200 text-amber-900'
                }`}
              >
                <AlertTriangle
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    a.severity === 'high' ? 'text-rose-600' : 'text-amber-600'
                  }`}
                />
                <div>
                  <div className="font-extrabold">{a.title}</div>
                  <p className="mt-0.5 leading-relaxed opacity-90">{a.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Health Score & Gap Analysis Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Algorithmic Health Score (Thang điểm 100 - SRS 3.3) */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
              Health Score (SRS 3.3)
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {healthScore ? healthScore.tier : 'Chưa có dữ liệu'}
            </span>
          </div>

          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-4xl font-extrabold tracking-tight text-white">
              {healthScore ? healthScore.totalScore : '--'}
            </span>
            <span className="text-xs text-slate-400 font-semibold">/ 100 điểm chuẩn hóa</span>
          </div>

          {/* Sub-scores Breakdown */}
          {healthScore && (
            <div className="mt-4 space-y-2 pt-3 border-t border-white/10 text-[11px]">
              <div className="flex justify-between text-slate-300">
                <span>W1 Mỡ nội tạng (25%):</span>
                <span className="font-bold text-white">{healthScore.scores.visceralFatScore}đ</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>W2 Khối cơ bắp (25%):</span>
                <span className="font-bold text-white">{healthScore.scores.muscleMassScore}đ</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>W3 Tuổi sinh học vs Thực (20%):</span>
                <span className="font-bold text-white">{healthScore.scores.biologicalAgeScore}đ</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>W4 Mỡ dưới da (15%):</span>
                <span className="font-bold text-white">{healthScore.scores.subcutaneousFatScore}đ</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>W5 Nước & Canxi xương (15%):</span>
                <span className="font-bold text-white">{healthScore.scores.waterAndBoneScore}đ</span>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Gap Analysis & Progress (SRS 2.3) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs md:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Đối Soát Mục Tiêu & Khoảng Bù Chênh Lệch (Gap Analysis)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Δ = Metric - Target</span>
          </div>

          {latestMetric ? (
            <div className="mt-3 space-y-3.5 text-xs">
              {/* Weight Gap with Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-slate-700">Tiến trình Cân nặng:</span>
                  <span className="font-bold text-emerald-700">
                    Hiện tại: {latestMetric.weight}kg → Mục tiêu:{' '}
                    {student.targetMetrics.targetWeight || '--'}kg (
                    {gapAnalysis?.weightProgressPercent || 0}% hoàn thành)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${gapAnalysis?.weightProgressPercent || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* 3 Indicators Gap Comparison Grid */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-500">Mỡ nội tạng</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">
                    Cấp {latestMetric.visceralFat}{' '}
                    <span className="text-[10px] text-slate-400 font-normal">
                      (Mục tiêu: {student.targetMetrics.targetVisceralFat || 5})
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 mt-0.5">
                    {gapAnalysis?.visceralDelta !== null
                      ? gapAnalysis?.visceralDelta! > 0
                        ? `Cần giảm thêm ${gapAnalysis?.visceralDelta} cấp`
                        : 'Đã đạt mục tiêu! 🎉'
                      : '--'}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-500">Khối cơ bắp</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">
                    {latestMetric.muscleMass} kg{' '}
                    <span className="text-[10px] text-slate-400 font-normal">
                      (Mục tiêu: {student.targetMetrics.targetMuscleMass || '--'}kg)
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-indigo-600 mt-0.5">
                    {student.targetMetrics.targetMuscleMass
                      ? `${(student.targetMetrics.targetMuscleMass - latestMetric.muscleMass).toFixed(1)}kg cần tăng`
                      : 'Đang theo dõi'}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-500">Vòng eo</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">
                    {latestMetric.waist} cm{' '}
                    <span className="text-[10px] text-slate-400 font-normal">
                      (Mục tiêu: {student.targetMetrics.targetWaist || '--'}cm)
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-amber-600 mt-0.5">
                    {student.targetMetrics.targetWaist
                      ? `${(latestMetric.waist - student.targetMetrics.targetWaist).toFixed(1)}cm cần siết`
                      : 'Đang theo dõi'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              Chưa có dữ liệu cân đo để tính toán khoảng bù
            </div>
          )}
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-1 text-xs font-semibold">
        {[
          { key: 'metrics', label: '10 Chỉ Số Sinh Học & Nhật Ký', icon: Scale, count: studentMetrics.length },
          { key: 'charts', label: 'Biểu Đồ Tiến Trình (Analytics)', icon: Activity },
          { key: 'ai-advice', label: 'Lời Khuyên AI (Tự Động Phân Tích)', icon: Sparkles, count: studentAdvices.length },
          { key: 'physique', label: 'Ảnh Vóc Dáng (Before / After)', icon: Target, count: studentPhotos.length },
          { key: 'daily-logs', label: 'Nhật Ký Ăn Uống & Tập Luyện', icon: Utensils, count: studentMeals.length + studentWorkouts.length },
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
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: 10 Health Metrics Table */}
      {activeTab === 'metrics' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Nhật Ký Đo Lường 10 Chỉ Số Sinh Học (Sổ KH)
              </h3>
              <p className="text-xs text-slate-500">
                Số hóa toàn diện dữ liệu cân đo định kỳ, phân loại thể hình và tuổi sinh học
              </p>
            </div>
            <button
              onClick={() => setShowAddMetricModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Nhật Ký Đo Mới</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-bold">Ngày Đo</th>
                  <th className="py-2.5 px-3 font-bold">1. Cân Nặng</th>
                  <th className="py-2.5 px-3 font-bold">2. Mỡ Dưới Da</th>
                  <th className="py-2.5 px-3 font-bold">3. Canxi Xương</th>
                  <th className="py-2.5 px-3 font-bold">4. Lượng Nước</th>
                  <th className="py-2.5 px-3 font-bold">5. Cơ Bắp</th>
                  <th className="py-2.5 px-3 font-bold">6. Thể Hình</th>
                  <th className="py-2.5 px-3 font-bold">7. BMR</th>
                  <th className="py-2.5 px-3 font-bold">8. Tuổi Sinh Học</th>
                  <th className="py-2.5 px-3 font-bold">9. Mỡ Nội Tạng</th>
                  <th className="py-2.5 px-3 font-bold">10. Vòng Eo</th>
                  <th className="py-2.5 px-3 font-bold text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentMetrics.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                      {m.date}
                    </td>
                    <td className="py-3 px-3 font-extrabold text-indigo-700">
                      {m.weight} <span className="text-[10px] text-slate-400 font-normal">kg</span>
                    </td>
                    <td className="py-3 px-3">{m.subcutaneousFat}%</td>
                    <td className="py-3 px-3">{m.boneCalcium}</td>
                    <td className="py-3 px-3 text-cyan-700 font-semibold">{m.bodyWater}%</td>
                    <td className="py-3 px-3 text-emerald-700 font-bold">{m.muscleMass} kg</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                        {m.bodyType}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono">{m.bmr} Kcal</td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-semibold ${
                          m.biologicalAge - student.age >= 3 ? 'text-amber-700 font-bold' : 'text-slate-700'
                        }`}
                      >
                        {m.biologicalAge} tuổi
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          m.visceralFat >= 10
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        Cấp {m.visceralFat}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-amber-800">{m.waist} cm</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => deleteMetricRecord(m.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Xóa lần đo này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Charts */}
      {activeTab === 'charts' && (
        <MetricsCharts metrics={studentMetrics} />
      )}

      {/* Tab 3: AI Advice Queue */}
      {activeTab === 'ai-advice' && (
        <AIAdviceQueue student={student} advices={studentAdvices} />
      )}

      {/* Tab 4: Physique Before/After */}
      {activeTab === 'physique' && (
        <BeforeAfterViewer photos={studentPhotos} studentId={student.id} />
      )}

      {/* Tab 5: Nutrition & Workout Logs */}
      {activeTab === 'daily-logs' && (
        <div className="space-y-6">
          {/* Meals Section */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <Utensils className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Nhật Ký Dinh Dưỡng Của Học Viên ({studentMeals.length})
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateStudentFolder}
                  disabled={isSyncingFolder}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer active:scale-98"
                >
                  <Folder className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {isSyncingFolder
                      ? 'Đang lấy link ảnh từ Drive...'
                      : 'Lấy Link Ảnh Từ Folder Drive Học Viên'}
                  </span>
                </button>

                <a
                  href={studentDriveFolderUrl || GOOGLE_DRIVE_PARENT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center space-x-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở Folder Drive Học Viên</span>
                </a>
              </div>
            </div>

            {syncStatus && (
              <div className="mb-4 px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-950 font-semibold rounded-xl text-xs flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{syncStatus}</span>
              </div>
            )}

            {/* Direct Photos Loaded From Student's Google Drive Folder */}
            {drivePhotos.length > 0 && (
              <div className="mb-5 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <Folder className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      Ảnh bữa ăn trong Folder Drive của {student.fullName} ({drivePhotos.length} ảnh - hiển thị trực tiếp qua link)
                    </span>
                  </span>
                  <a
                    href={studentDriveFolderUrl || GOOGLE_DRIVE_PARENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center space-x-1"
                  >
                    <span>Mở trong Google Drive</span>
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

            {studentMeals.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Học viên chưa đăng nhật ký bữa ăn nào.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studentMeals.map((m) => (
                  <div key={m.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs flex flex-col justify-between space-y-3">
                    <div className="flex gap-3.5">
                      <div className="relative shrink-0">
                        <img
                          src={m.imageUrl}
                          alt={m.foodDescription}
                          className="w-24 h-24 rounded-xl object-cover ring-1 ring-slate-200"
                        />
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white flex items-center space-x-0.5">
                          <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                          AI
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            {m.mealType}
                          </span>
                          <span className="text-slate-400 text-[10px]">{m.date} • {m.loggedAt}</span>
                        </div>
                        <p className="mt-1 text-slate-800 leading-relaxed font-semibold text-xs line-clamp-2">
                          {m.foodDescription}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
                          <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                            🔥 {m.estimatedCalories} Kcal
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                            🥩 Đạm {m.macros.protein}g
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            🍚 Carb {m.macros.carbs}g
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                            🥑 Béo {m.macros.fat}g
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* AI Assessment */}
                    {m.nutritionAdvice && (
                      <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-950 font-medium">
                        🤖 <strong>AI phân tích:</strong> {m.nutritionAdvice}
                      </div>
                    )}

                    {/* Coach Feedback Area */}
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        {(['🔥', '💪', '👏', '❤️'] as const).map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => addMealFeedback(m.id, emoji, m.trainerComment)}
                            className={`p-1 rounded-md text-sm hover:scale-125 transition-transform ${
                              m.trainerReaction === emoji ? 'bg-white shadow-xs ring-1 ring-emerald-500' : ''
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      {m.trainerComment && (
                        <span className="text-[11px] text-emerald-800 font-semibold italic truncate max-w-xs">
                          "{m.trainerComment}"
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Workouts Section */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <Dumbbell className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Nhật Ký Tập Luyện Theo Giáo Án ({studentWorkouts.length})
                </h3>
              </div>
            </div>

            {studentWorkouts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Học viên chưa ghi nhật ký buổi tập nào.</p>
            ) : (
              <div className="space-y-3">
                {studentWorkouts.map((w) => (
                  <div key={w.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{w.planTitle}</span>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Thời lượng: {w.durationMinutes} phút • Ngày: {w.date}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        {(['🔥', '💪', '👏', '❤️'] as const).map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => addWorkoutFeedback(w.id, emoji, w.trainerComment)}
                            className={`p-1 rounded-md text-sm hover:scale-125 transition-transform ${
                              w.trainerReaction === emoji ? 'bg-white shadow-xs ring-1 ring-indigo-500' : ''
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {w.exercises.map((ex) => (
                        <div key={ex.id} className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-800">{ex.name}</div>
                            <div className="text-[10px] text-slate-400">{ex.sets} • {ex.reps}</div>
                          </div>
                          {ex.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <span className="text-[10px] text-slate-400">Chưa tập</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {w.trainerComment && (
                      <div className="mt-2.5 p-2 bg-indigo-50/70 rounded-xl text-indigo-950 font-medium">
                        HLV Ghi chú: {w.trainerComment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddMetricModal && (
        <AddMetricModal
          student={student}
          latestMetric={latestMetric}
          onClose={() => setShowAddMetricModal(false)}
        />
      )}

      {showEditStudentModal && (
        <AddStudentModal
          initialStudent={student}
          onClose={() => setShowEditStudentModal(false)}
        />
      )}
    </div>
  );
};
