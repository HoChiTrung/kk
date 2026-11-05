/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useHealth } from '../../context/HealthContext';
import {
  IDEAL_WEIGHT_TABLE,
  VISCERAL_FAT_STANDARDS,
  BONE_MASS_STANDARDS,
  BODY_TYPE_DEFINITIONS,
  WATER_STANDARDS,
} from '../../data/medicalStandards';
import {
  X,
  BookOpen,
  Activity,
  Droplet,
  HeartPulse,
  Scale,
  Layers,
  AlertTriangle,
  Info,
} from 'lucide-react';

export const ReferenceStandardsModal: React.FC = () => {
  const { openStandardsModal, setOpenStandardsModal } = useHealth();
  const [activeTab, setActiveTab] = useState<'visceral' | 'weight' | 'bodyType' | 'water' | 'bone'>('visceral');

  if (!openStandardsModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full my-6 overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">
                Bảng Chuẩn Đối Soát Y Tế & Thể Thao
              </h3>
              <p className="text-[11px] text-slate-400">
                Tài liệu tiêu chuẩn cân đo sinh học được chuẩn hóa theo thực tế phòng khám & trung tâm
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpenStandardsModal(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 overflow-x-auto text-xs font-bold bg-slate-50 shrink-0">
          {[
            { key: 'visceral', label: '1. Mỡ Nội Tạng & Nguy Cơ Bệnh Lý', icon: HeartPulse },
            { key: 'weight', label: '2. Chiều Cao & Cân Nặng Lý Tưởng', icon: Scale },
            { key: 'bodyType', label: '3. Phân Loại Thể Hình (1 - 9)', icon: Layers },
            { key: 'water', label: '4. Lượng Nước Khuyến Nghị', icon: Droplet },
            { key: 'bone', label: '5. Khối Lượng Xương Chuẩn', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-3 px-4 flex items-center space-x-1.5 border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-emerald-600 text-emerald-900 bg-white font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-700">
          {/* TAB 1: VISCERAL FAT & HEALTH RISKS */}
          {activeTab === 'visceral' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-amber-950 text-sm">
                    Tác hại và Nguy cơ Bệnh lý từ Mỡ Nội Tạng (SRS Y Khoa)
                  </h4>
                  <p className="mt-1 text-slate-700 leading-relaxed">
                    Mỡ nội tạng bao phủ quanh tim, gan, thận, dạ dày là thủ phạm hàng đầu gây kháng insulin, xơ vữa động mạch vành và các biến chứng chuyển hóa nghiêm trọng.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {VISCERAL_FAT_STANDARDS.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-900 text-sm">
                          Cấp {s.minLevel} {s.maxLevel !== s.minLevel ? `- ${s.maxLevel}` : ''}:
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          s.badgeColor === 'emerald'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.badgeColor === 'teal'
                            ? 'bg-teal-100 text-teal-800'
                            : s.badgeColor === 'amber'
                            ? 'bg-amber-100 text-amber-800'
                            : s.badgeColor === 'rose'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-red-100 text-red-900 font-black'
                        }`}>
                          {s.label}
                        </span>
                      </div>
                    </div>

                    <p className="mt-2 text-slate-800 font-medium leading-relaxed">{s.assessment}</p>
                    <div className="mt-2 text-[11px] text-slate-600 font-semibold">
                      <strong>Hành động bắt buộc:</strong> {s.actionRequired}
                    </div>

                    {s.associatedRisks.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-rose-800 space-y-1">
                        <span className="font-bold text-[11px] block">Nguy cơ bệnh lý đe dọa:</span>
                        {s.associatedRisks.map((risk, rIdx) => (
                          <div key={rIdx} className="flex items-start space-x-1.5 text-[11px]">
                            <span className="text-rose-500 font-bold">•</span>
                            <span>{risk}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: IDEAL WEIGHT BY HEIGHT */}
          {activeTab === 'weight' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-950 font-medium">
                Bảng chiều cao cân nặng lý tưởng chuẩn xác cho người trưởng thành (Nam & Nữ từ 140cm đến 191cm).
              </div>

              <div className="overflow-x-auto max-h-[60vh] border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-900 text-white z-10">
                    <tr>
                      <th className="p-2.5 font-bold">Chiều Cao (cm)</th>
                      <th className="p-2.5 font-bold">Nữ Giới Lý Tưởng (kg)</th>
                      <th className="p-2.5 font-bold">Nam Giới Lý Tưởng (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {IDEAL_WEIGHT_TABLE.map((row) => (
                      <tr key={row.heightCm} className="hover:bg-slate-50">
                        <td className="p-2.5 font-extrabold text-slate-900">{row.heightCm} cm</td>
                        <td className="p-2.5 text-pink-700 font-bold">
                          {row.femaleMinKg} - {row.femaleMaxKg} kg
                        </td>
                        <td className="p-2.5 text-indigo-700 font-bold">
                          {row.maleMinKg} - {row.maleMaxKg} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: BODY TYPE 1 - 9 */}
          {activeTab === 'bodyType' && (
            <div className="space-y-3">
              <p className="text-slate-600">
                Phân loại thể hình 9 cấp độ dựa trên ma trận tương quan giữa <strong>Tỷ lệ Mỡ</strong> và <strong>Khối lượng Cơ</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.values(BODY_TYPE_DEFINITIONS).map((def) => (
                  <div key={def.index} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-extrabold text-slate-900 text-sm">
                          Cấp {def.index}: {def.name}
                        </span>
                        <div className="flex space-x-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white border border-slate-200 font-semibold">
                            Mỡ: {def.fatLevel}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white border border-slate-200 font-semibold text-emerald-700">
                            Cơ: {def.muscleLevel}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed">{def.description}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-emerald-900 font-semibold">
                      💡 Khuyến nghị: {def.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: WATER STANDARDS */}
          {activeTab === 'water' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-200">
                  <div className="text-[11px] text-cyan-800 font-bold">Nữ Giới Chuẩn</div>
                  <div className="text-lg font-black text-cyan-900 mt-0.5">50 - 55%</div>
                </div>
                <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-200">
                  <div className="text-[11px] text-cyan-800 font-bold">Nam Giới Chuẩn</div>
                  <div className="text-lg font-black text-cyan-900 mt-0.5">55 - 65%</div>
                </div>
                <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-200">
                  <div className="text-[11px] text-cyan-800 font-bold">Vận Động Viên</div>
                  <div className="text-lg font-black text-cyan-900 mt-0.5">&gt; 65%</div>
                </div>
              </div>

              <h4 className="font-bold text-slate-800 mt-4 mb-2">Bảng quy đổi cân nặng sang lượng nước khuyến nghị hàng ngày:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {WATER_STANDARDS.weightToLitersMap.map((w) => (
                  <div key={w.weightKg} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-slate-700">{w.weightKg} kg</span>
                    <span className="font-extrabold text-cyan-700">{w.liters} Lít</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: BONE MASS */}
          {activeTab === 'bone' && (
            <div className="space-y-4">
              <p className="text-slate-600">
                Khối lượng khoáng xương chuẩn hóa theo thể trọng và giới tính:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-indigo-950 mb-3 text-sm">Nam Giới</h4>
                  <div className="space-y-2">
                    {BONE_MASS_STANDARDS.filter(b => b.gender === 'Nam').map((b, i) => (
                      <div key={i} className="flex justify-between p-2 bg-white rounded-lg border border-slate-200">
                        <span className="font-semibold text-slate-700">{b.weightCategory}</span>
                        <span className="font-bold text-indigo-700">{b.targetBoneKg} kg</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-pink-950 mb-3 text-sm">Nữ Giới</h4>
                  <div className="space-y-2">
                    {BONE_MASS_STANDARDS.filter(b => b.gender === 'Nữ').map((b, i) => (
                      <div key={i} className="flex justify-between p-2 bg-white rounded-lg border border-slate-200">
                        <span className="font-semibold text-slate-700">{b.weightCategory}</span>
                        <span className="font-bold text-pink-700">{b.targetBoneKg} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
