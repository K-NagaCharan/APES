import React from 'react';

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, photo }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#0f0e0c]/50 backdrop-blur-xs transition-opacity"
      ></div>

      {/* Modal box */}
      <div className="relative bg-white border border-[#e8e4dc] rounded-2xl shadow-xl w-full max-w-md p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-10">
        <div className="space-y-4">
          {/* Danger Warning Banner */}
          <div className="flex items-center space-x-3 text-red-600">
            <div className="p-2 bg-red-50 rounded-full">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-serif font-bold text-[#0f0e0c]">
              Delete Photo
            </h3>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-[#3a3834] leading-relaxed">
              Are you sure you want to permanently delete this photo? This will remove the image from the cloud storage and delete all associated face models.
            </p>
            {photo && (
              <div className="flex items-center space-x-3 p-3 bg-[#f2f0eb] rounded-lg border border-[#e8e4dc]">
                <img
                  src={photo.url}
                  alt="Thumbnail preview"
                  className="w-12 h-12 object-cover rounded border border-[#e8e4dc] bg-white"
                />
                <div className="text-[10px] font-mono text-[#6b6760] space-y-0.5">
                  <p className="font-semibold text-[#0f0e0c]">Dimensions: {photo.width} × {photo.height} px</p>
                  <p>Faces Labeled: {photo.faceCount || 0}</p>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[#e8e4dc] hover:bg-[#f2f0eb] text-xs font-mono uppercase tracking-widest rounded-lg transition active:scale-95 cursor-pointer bg-white text-[#3a3834]"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(photo.id)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-mono uppercase tracking-widest rounded-lg transition active:scale-95 cursor-pointer font-semibold"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
