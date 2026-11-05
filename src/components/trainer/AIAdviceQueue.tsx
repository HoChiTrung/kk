/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AIAdviceRecord, StudentProfile } from '../../types/health';
import { useHealth } from '../../context/HealthContext';
import {
  Sparkles,
  Droplet,
  Flame,
  Dumbbell,
  Apple,
  ShieldCheck,
  BookOpen,
  Calendar,
  AlertTriangle,
  HeartPulse,
} from 'lucide-react';

interface AIAdviceQueueProps {
  student: StudentProfile;
  advices: AIAdviceRecord[];
}

export const AIAdviceQueue: React.FC<AIAdviceQueueProps> = ({ student, advices }) => {
  const { setOpenStandardsModal } = useHealth();

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 rounded-3xl p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Hệ Thống Trợ Lý AI Tự Động Phân Tích (Instant AI Engine)</span>
            </div>
            <h3 className="text-lg font-black mt-1">
              Lời Khuyên & Phân Tích Sức Khỏe Tự Động
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              AI tự động phân tích biến động các chỉ số sinh học giữa các lần cân đo, đối soát trực tiếp với <strong>4 Bảng Tiêu Chuẩn Y Tế Trung Tâm</strong> (Mỡ nội tạng, Chiều cao cân nặng lý tưởng, Lượng nước, Thể hình 1-9) để đưa ra lời khuyên lập tức cho học viên.
            </p>
          </div>

          <button
            onClick={() => setOpenStandardsModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Xem 4 Bảng Chuẩn Y Tế</span>
          </button>
        </div>
      </div>

      {/* List of Advices */}
      <div className="space-y-4">
        {advices.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 text-xs text-slate-500">
            Chưa có lần đo lường nào. Khi bạn nhập chỉ số mới, AI sẽ tự động phân tích và đưa ra lời khuyên ngay tức thì!
          </div>
        ) : (
          advices.map((a, idx) => (
            <div
              key={a.id}
              className={`bg-white rounded-3xl p-6 border shadow-xs text-xs space-y-4 ${
                idx === 0 ? 'border-emerald-300 ring-2 ring-emerald-500/10' : 'border-slate-200/90'
              }`}
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center">
                    <Sparkles className="w-3 h-3 mr-1 text-emerald-600" />
                    AI TỰ ĐỘNG PHÁT HÀNH
                  </span>
                  <span className="text-slate-600 font-semibold flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    Lần đo: {a.date}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Cập nhật lúc: {a.approvedAt || a.date}
                </span>
              </div>

              {/* Water & Calorie Target Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-cyan-50/80 border border-cyan-200 flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-cyan-100 text-cyan-700 shrink-0">
                    <Droplet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-cyan-800 font-semibold">Lượng Nước Khuyến Nghị (Water Target)</div>
                    <div className="text-base font-black text-cyan-950 mt-0.5">
                      {a.aiDraftContent.waterTargetLiters} Lít / ngày
                    </div>
                    <div className="text-[10px] text-cyan-600 mt-0.5">
                      Đối soát theo Bảng chuẩn thể trọng & hoạt động thể chất
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-orange-50/80 border border-orange-200 flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-orange-100 text-orange-700 shrink-0">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-orange-800 font-semibold">Mức Nạp Calo Khuyến Nghị (Calorie Target)</div>
                    <div className="text-base font-black text-orange-950 mt-0.5">
                      {a.aiDraftContent.calorieTargetKcal} Kcal / ngày
                    </div>
                    <div className="text-[10px] text-orange-600 mt-0.5">
                      Đã hiệu chỉnh theo mục tiêu sức khỏe: {student.healthGoal}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Comprehensive Summary & Disease Correlation */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                <div className="font-extrabold text-slate-900 flex items-center space-x-1.5 text-xs">
                  <HeartPulse className="w-4 h-4 text-emerald-600" />
                  <span>Phân Tích Thể Trạng & Bệnh Lý (Đối Soát 4 Bảng Chuẩn Y Tế):</span>
                </div>
                <p className="text-slate-700 leading-relaxed font-medium">
                  {a.aiDraftContent.summary}
                </p>
              </div>

              {/* Nutrition & Workout Directions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-1">
                  <div className="font-bold text-emerald-950 flex items-center space-x-1.5">
                    <Apple className="w-4 h-4 text-emerald-600" />
                    <span>Định Hướng Dinh Dưỡng:</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed font-medium">{a.aiDraftContent.nutritionAdvice}</p>
                </div>

                <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-1">
                  <div className="font-bold text-indigo-950 flex items-center space-x-1.5">
                    <Dumbbell className="w-4 h-4 text-indigo-600" />
                    <span>Phác Đồ Rèn Luyện & Vận Động:</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed font-medium">{a.aiDraftContent.workoutAdvice}</p>
                </div>
              </div>

              {/* Lifestyle & Biological Aging Tip */}
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-purple-950 font-medium">
                💡 <strong>Lối sống & Trẻ hóa:</strong> {a.aiDraftContent.lifestyleTip}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
