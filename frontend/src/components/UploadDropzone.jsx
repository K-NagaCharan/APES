import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';

const UploadDropzone = ({ onFileSelect, disabled }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB

  const validateAndSelectFiles = (filesList) => {
    if (!filesList || filesList.length === 0) return;

    const validFiles = [];
    const filesArray = Array.from(filesList);

    for (const file of filesArray) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Invalid type for "${file.name}". Only JPEG, PNG, and WEBP formats are supported.`);
        continue;
      }

      if (file.size > maxSizeBytes) {
        toast.error(`"${file.name}" exceeds the 10MB limit.`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onFileSelect(validFiles);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelectFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (disabled) return;

    if (e.target.files && e.target.files.length > 0) {
      validateAndSelectFiles(e.target.files);
    }
  };

  const onButtonClick = () => {
    if (disabled) return;
    fileInputRef.current.click();
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={onButtonClick}
      className={`relative w-full border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition cursor-pointer select-none ${
        disabled
          ? 'border-[#e8e4dc] bg-[#f2f0eb]/50 cursor-not-allowed opacity-60'
          : isDragActive
          ? 'border-[#c8501a] bg-[#fdf0ea]'
          : 'border-[#e8e4dc] bg-[#f2f0eb]/20 hover:border-[#c8501a] hover:bg-[#fdf0ea]/30'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleChange}
        disabled={disabled}
        multiple
        className="hidden"
      />

      <div className="flex flex-col items-center space-y-4 text-center">
        {/* Upload Icon */}
        <div className={`p-4 rounded-full transition ${isDragActive ? 'bg-[#c8501a]/10 text-[#c8501a]' : 'bg-[#e8e4dc]/50 text-[#6b6760]'}`}>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#0f0e0c]">
            {isDragActive ? 'Drop your photos here' : 'Drag & drop photos here, or click to browse'}
          </p>
          <p className="text-xs text-[#6b6760] font-mono">
            JPEG, PNG, or WEBP up to 10MB per file (Multiple files supported)
          </p>
        </div>
      </div>
    </div>
  );
};

export default UploadDropzone;
