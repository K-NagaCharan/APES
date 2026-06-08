import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import UploadDropzone from '../components/UploadDropzone';

const Upload = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dimensions, setDimensions] = useState({ width: null, height: null });
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | success | error
  const [uploadProgress, setUploadProgress] = useState(0);

  // Revoke object URL to prevent memory leaks when file preview changes or unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (file) => {
    // Revoke previous URL if set
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }

    setSelectedFile(file);
    setUploadStatus('idle');
    setUploadProgress(0);

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Extract image dimensions
    const img = new Image();
    img.onload = () => {
      setDimensions({ width: img.width, height: img.height });
    };
    img.src = objectUrl;
  };

  const handleClear = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
    setDimensions({ width: null, height: null });
    setUploadStatus('idle');
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await api.post('/photos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentage);
          }
        },
      });

      setUploadStatus('success');
      toast.success('Photo uploaded successfully!');
    } catch (err) {
      setUploadStatus('error');
      const errMsg = err.response?.data?.message || err.message || 'Upload failed';
      toast.error(errMsg);
    }
  };

  return (
    <div className="flex-grow max-w-4xl w-full mx-auto p-6 md:p-12 space-y-8 select-none flex flex-col justify-center">
      {/* Header */}
      <section className="space-y-1">
        <span className="font-mono text-xs uppercase tracking-widest text-[#c8501a] font-bold">
          Ingestion System
        </span>
        <h1 className="text-3xl font-serif text-[#0f0e0c]">
          Upload Photos
        </h1>
        <p className="text-sm text-[#6b6760] leading-relaxed">
          Add new images to your repository. APES will automatically validate format configurations.
        </p>
      </section>

      {/* Main Container */}
      <div className="bg-white border border-[#e8e4dc] rounded-2xl p-6 md:p-10 shadow-sm space-y-8">
        {uploadStatus === 'success' ? (
          /* Success Screen */
          <div className="flex flex-col items-center justify-center text-center space-y-6 py-8 animate-in fade-in duration-200">
            <div className="p-4 bg-[#e8f5f1] rounded-full text-[#0f6e56] border border-[#0f6e56]/20">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-serif text-[#0f0e0c]">Upload Completed</h3>
              <p className="text-xs font-mono uppercase tracking-widest text-[#6b6760] font-bold">
                File successfully ingested into repository
              </p>
            </div>

            <div className="flex items-center space-x-4 pt-2">
              <button
                onClick={handleClear}
                className="px-5 py-2.5 border border-[#e8e4dc] hover:bg-[#f2f0eb] text-xs font-mono uppercase tracking-widest rounded-lg transition active:scale-95 cursor-pointer bg-white text-[#3a3834]"
              >
                Upload another
              </button>
              <button
                onClick={() => navigate('/gallery')}
                className="px-5 py-2.5 bg-[#0f0e0c] hover:bg-[#c8501a] text-white text-xs font-mono uppercase tracking-widest rounded-lg transition active:scale-95 cursor-pointer font-semibold"
              >
                Open Gallery
              </button>
            </div>
          </div>
        ) : (
          /* Dropzone or Preview Section */
          <div className="space-y-6">
            {!selectedFile ? (
              <UploadDropzone onFileSelect={handleFileSelect} disabled={uploadStatus === 'uploading'} />
            ) : (
              /* Preview Panel */
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 border border-[#e8e4dc] rounded-xl p-4 bg-[#faf9f6]">
                  {/* Left Column: Image Preview */}
                  <div className="md:col-span-4 aspect-square bg-[#f2f0eb] border border-[#e8e4dc] rounded-lg overflow-hidden flex items-center justify-center">
                    <img
                      src={previewUrl}
                      alt="Selected preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Right Column: Metadata details */}
                  <div className="md:col-span-8 flex flex-col justify-between py-2 gap-4">
                    <div className="space-y-4">
                      <h4 className="font-mono text-[10px] uppercase tracking-widest text-[#9c9890] font-bold">
                        File Configuration
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="block text-[10px] text-[#6b6760] font-mono uppercase">Name</span>
                          <span className="text-sm font-semibold text-[#0f0e0c] block truncate max-w-xs">{selectedFile.name}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#6b6760] font-mono uppercase">Dimensions</span>
                          <span className="text-sm font-semibold text-[#0f0e0c] block font-mono">
                            {dimensions.width && dimensions.height ? `${dimensions.width} × ${dimensions.height} px` : 'Extracting...'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar while uploading */}
                    {uploadStatus === 'uploading' && (
                      <div className="space-y-2 pt-4">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-[#6b6760]">Uploading asset...</span>
                          <span className="text-[#c8501a] font-bold">{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-[#e8e4dc] h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#c8501a] h-full rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {uploadStatus !== 'uploading' && (
                      <div className="flex items-center space-x-3 pt-4 border-t border-[#e8e4dc]/50">
                        <button
                          onClick={handleClear}
                          className="px-4 py-2 border border-[#e8e4dc] hover:bg-[#f2f0eb] text-xs font-mono uppercase tracking-widest rounded-lg transition active:scale-95 cursor-pointer bg-white text-[#3a3834]"
                        >
                          Clear
                        </button>
                        <button
                          onClick={handleUpload}
                          disabled={uploadStatus === 'uploading'}
                          className="px-5 py-2 bg-[#0f0e0c] hover:bg-[#c8501a] text-white text-xs font-mono uppercase tracking-widest rounded-lg transition active:scale-95 cursor-pointer font-semibold flex items-center justify-center space-x-2"
                        >
                          <span>Ingest Photo</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;
