/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PhysiquePhoto } from '../../types/health';
import { useHealth } from '../../context/HealthContext';
import {
  Columns,
  SlidersHorizontal,
  Upload,
  Calendar,
  Weight,
  Sparkles,
  Plus,
  X,
  Camera,
} from 'lucide-react';

interface BeforeAfterViewerProps {
  photos: PhysiquePhoto[];
  studentId: string;
}

export const BeforeAfterViewer: React.FC<BeforeAfterViewerProps> = ({ photos, studentId }) => {
  const { addPhysiquePhoto } = useHealth();
  const [viewMode, setViewMode] = useState<'slider' | 'side-by-side'>('slider');
  const [sliderPos, setSliderPos] = useState(50);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Default selection for before and after
  const beforePhoto = photos.find((p) => p.photoType === 'before') || photos[0];
  const afterPhoto =
    photos.find((p) => p.photoType === 'after') ||
    (photos.length > 1 ? photos[photos.length - 1] : photos[0]);

  const [selectedBeforeId, setSelectedBeforeId] = useState<string>(beforePhoto?.id || '');
  const [selectedAfterId, setSelectedAfterId] = useState<string>(afterPhoto?.id || '');

  const activeBefore = photos.find((p) => p.id === selectedBeforeId) || beforePhoto;
  const activeAfter = photos.find((p) => p.id === selectedAfterId) || afterPhoto;

  // Upload Form State
  const [imageUrl, setImageUrl] = useState('');
  const [photoType, setPhotoType] = useState<'before' | 'after' | 'progress'>('progress');
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().split('T')[0]);
  const [photoWeight, setPhotoWeight] = useState('');
  const [photoNotes, setPhotoNotes] = useState('');

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) return;

    await addPhysiquePhoto({
      studentId,
      date: photoDate,
      imageUrl,
      photoType,
      weight: parseFloat(photoWeight) || 0,
      notes: photoNotes,
    });

    setShowUploadModal(false);
    setImageUrl('');
    setPhotoWeight('');
    setPhotoNotes('');
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-slate-900 text-base">
              So Sánh Hình Thể Trước & Sau (Before & After)
            </h3>
            <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              SRS 3.2 Visual Compare Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Trực quan hóa biến động vóc dáng theo tỷ lệ chuẩn 3:4 & tương tác thanh trượt đè ảnh
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode('slider')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all ${
                viewMode === 'slider'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Thanh Trượt Slider</span>
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all ${
                viewMode === 'side-by-side'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Song Song</span>
            </button>
          </div>

          {/* Upload Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tải Ảnh Mới</span>
          </button>
        </div>
      </div>

      {/* Date Milestones Selector */}
      {photos.length >= 2 && (
        <div className="my-3 p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700">Mốc Bắt Đầu (Before):</span>
            <select
              value={selectedBeforeId}
              onChange={(e) => setSelectedBeforeId(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              {photos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.date} ({p.photoType.toUpperCase()} - {p.weight}kg)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700">Mốc Đối Soát (After):</span>
            <select
              value={selectedAfterId}
              onChange={(e) => setSelectedAfterId(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              {photos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.date} ({p.photoType.toUpperCase()} - {p.weight}kg)
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Main Visual Display */}
      {photos.length === 0 ? (
        <div className="py-20 text-center">
          <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">Chưa có ảnh vóc dáng nào được tải lên</p>
          <p className="text-xs text-slate-400 mt-1">Bấm "Tải Ảnh Mới" để lưu vết hình thể học viên</p>
        </div>
      ) : viewMode === 'slider' && activeBefore && activeAfter ? (
        <div className="mt-4">
          <div className="relative w-full max-w-xl mx-auto aspect-3/4 rounded-2xl overflow-hidden shadow-lg select-none bg-slate-900 border-2 border-slate-200">
            {/* After Image (Background) */}
            <img
              src={activeAfter.imageUrl}
              alt="After physique"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            {/* After Badge */}
            <div className="absolute top-4 right-4 z-10 px-3 py-1 bg-emerald-600/90 text-white rounded-full text-xs font-bold shadow-md backdrop-blur-xs flex items-center space-x-1">
              <span>HIỆN TẠI (AFTER)</span>
              <span>• {activeAfter.weight}kg</span>
            </div>

            {/* Before Image (Foreground with Clip Path) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPos}%` }}
            >
              <img
                src={activeBefore.imageUrl}
                alt="Before physique"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none max-w-none"
                style={{ width: '100%', height: '100%' }}
              />
              {/* Before Badge */}
              <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-slate-900/90 text-white rounded-full text-xs font-bold shadow-md backdrop-blur-xs flex items-center space-x-1">
                <span>BAN ĐẦU (BEFORE)</span>
                <span>• {activeBefore.weight}kg</span>
              </div>
            </div>

            {/* Scrubber Divider Line */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl cursor-ew-resize z-20 flex items-center justify-center"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="w-8 h-8 rounded-full bg-white shadow-xl border-2 border-emerald-600 flex items-center justify-center text-emerald-700 font-bold text-xs">
                ⇄
              </div>
            </div>

            {/* Interactive Slider Input Overlay */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full z-30"
              aria-label="Thanh trượt so sánh trước sau"
            />
          </div>

          <div className="text-center mt-3 text-xs text-slate-500 font-medium">
            Kéo tay nắm tròn ⇄ hoặc bấm vào ảnh để so sánh độ siết nét cơ và giảm mỡ
          </div>
        </div>
      ) : (
        /* Side by Side Mode */
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {activeBefore && (
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-900 text-white">
                  KHỞI ĐIỂM (BEFORE)
                </span>
                <span className="text-xs font-bold text-slate-700">{activeBefore.weight} kg</span>
              </div>
              <div className="aspect-3/4 rounded-xl overflow-hidden bg-slate-200">
                <img
                  src={activeBefore.imageUrl}
                  alt="Before physique"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                <span>Ngày đo: {activeBefore.date}</span>
              </div>
              {activeBefore.notes && (
                <p className="mt-1 text-[11px] text-slate-600 italic">{activeBefore.notes}</p>
              )}
            </div>
          )}

          {activeAfter && (
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-600 text-white">
                  HIỆN TẠI (AFTER)
                </span>
                <span className="text-xs font-bold text-emerald-700">{activeAfter.weight} kg</span>
              </div>
              <div className="aspect-3/4 rounded-xl overflow-hidden bg-slate-200">
                <img
                  src={activeAfter.imageUrl}
                  alt="After physique"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                <span>Ngày đo: {activeAfter.date}</span>
                {activeBefore && (
                  <span className="font-bold text-emerald-600">
                    Δ: {(activeAfter.weight - activeBefore.weight).toFixed(1)} kg
                  </span>
                )}
              </div>
              {activeAfter.notes && (
                <p className="mt-1 text-[11px] text-slate-600 italic">{activeAfter.notes}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm">Tải Lên Ảnh Vóc Dáng Mới</h4>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Đường dẫn ảnh (URL hoặc Base64) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Quy chuẩn SRS: Khung hình 3:4 hoặc 1:1, dung lượng tối đa 10MB
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Giai đoạn (Type)
                  </label>
                  <select
                    value={photoType}
                    onChange={(e: any) => setPhotoType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
                  >
                    <option value="before">Before (Ban đầu)</option>
                    <option value="progress">Progress (Tiến trình)</option>
                    <option value="after">After (Hiện tại)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cân nặng lúc chụp (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="75.3"
                    value={photoWeight}
                    onChange={(e) => setPhotoWeight(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ngày chụp</label>
                <input
                  type="date"
                  value={photoDate}
                  onChange={(e) => setPhotoDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú vóc dáng</label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Rãnh bụng lộ rõ, cơ vai đầy đặn hơn..."
                  value={photoNotes}
                  onChange={(e) => setPhotoNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors shadow-xs"
                >
                  Lưu Ảnh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
