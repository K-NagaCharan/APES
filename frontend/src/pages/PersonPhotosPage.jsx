import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import PhotoCard from '../components/PhotoCard';
import PageLoader from '../components/PageLoader';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import PhotoDetailModal from '../components/PhotoDetailModal';

const PersonPhotosPage = () => {
  const { personId } = useParams();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState([]);
  const [personName, setPersonName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Deletion and Selection states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [deletingIds, setDeletingIds] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);

  // Photo Detail Modal
  const [modalPhotoId, setModalPhotoId] = useState(null);

  useEffect(() => {
    const fetchPersonPhotos = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/faces/people/${personId}/photos`);
        setPhotos(response.data.photos);
        setPersonName(response.data.personName);
      } catch (err) {
        setError('Failed to retrieve photos for this person.');
        toast.error(err.response?.data?.message || 'Error fetching photos.');
      } finally {
        setLoading(false);
      }
    };

    fetchPersonPhotos();
  }, [personId]);

  // Deletion handlers
  const handleDeleteClick = (photo) => {
    setSelectedPhoto(photo);
    setIsBulkDelete(false);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (photoId) => {
    setDeleteModalOpen(false);
    
    if (isBulkDelete) {
      if (selectedPhotoIds.length === 0) return;

      setDeletingIds((prev) => [...prev, ...selectedPhotoIds]);

      try {
        await api.post('/photos/bulk-delete', { ids: selectedPhotoIds });
        toast.success(`Successfully deleted ${selectedPhotoIds.length} photo(s)!`);
        
        setPhotos((prev) => prev.filter((p) => !selectedPhotoIds.includes(p.id)));
        setIsSelectionMode(false);
        setSelectedPhotoIds([]);
      } catch (err) {
        const errMsg = err.response?.data?.message || err.message || 'Failed to delete photos';
        toast.error(errMsg);
      } finally {
        setDeletingIds((prev) => prev.filter((id) => !selectedPhotoIds.includes(id)));
      }
    } else {
      if (!photoId) return;
      setDeletingIds((prev) => [...prev, photoId]);

      try {
        await api.delete(`/photos/${photoId}`);
        toast.success('Photo deleted successfully!');
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      } catch (err) {
        const errMsg = err.response?.data?.message || err.message || 'Failed to delete photo';
        toast.error(errMsg);
      } finally {
        setDeletingIds((prev) => prev.filter((id) => id !== photoId));
        setSelectedPhoto(null);
      }
    }
  };

  // Selection handlers
  const handleToggleSelectionMode = () => {
    setIsSelectionMode((prev) => !prev);
    setSelectedPhotoIds([]); // Reset selection on toggle
  };

  const handleSelectToggle = (photoId) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
  };

  const handleSelectAllToggle = () => {
    if (selectedPhotoIds.length === photos.length) {
      setSelectedPhotoIds([]);
    } else {
      setSelectedPhotoIds(photos.map((p) => p.id));
    }
  };

  const handleBulkDeleteClick = () => {
    if (selectedPhotoIds.length === 0) return;
    setIsBulkDelete(true);
    setDeleteModalOpen(true);
  };

  const handlePrevPhoto = () => {
    if (!modalPhotoId) return;
    const index = photos.findIndex((p) => p.id === modalPhotoId);
    if (index > 0) {
      setModalPhotoId(photos[index - 1].id);
    }
  };

  const handleNextPhoto = () => {
    if (!modalPhotoId) return;
    const index = photos.findIndex((p) => p.id === modalPhotoId);
    if (index < photos.length - 1) {
      setModalPhotoId(photos[index + 1].id);
    }
  };

  return (
    <div className="flex-grow max-w-7xl w-full mx-auto p-6 md:p-12 space-y-8 select-none flex flex-col justify-start">
      {/* Back navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 border-b border-[#e8e4dc] pb-6">
        <div className="space-y-4">
          <button
            onClick={() => navigate('/gallery')}
            className="flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-[#6b6760] hover:text-[#c8501a] transition cursor-pointer active:scale-98"
          >
            <span>← Back to Gallery</span>
          </button>
          <div className="space-y-1">
            <span className="font-mono text-xs uppercase tracking-widest text-[#c8501a] font-bold">
              Person Filter
            </span>
            <h1 className="text-3xl font-serif text-[#0f0e0c]">
              Photos of {personName || '...'}
            </h1>
            <p className="text-sm text-[#6b6760] leading-relaxed">
              All labeled photos matching the profile of {personName || 'this person'}.
            </p>
          </div>
        </div>

        {photos.length > 0 && (
          <div className="flex items-center space-x-3 self-start sm:self-end">
            {isSelectionMode ? (
              <>
                <span className="text-xs font-mono text-[#6b6760] mr-2">
                  Selected: {selectedPhotoIds.length} photo(s)
                </span>
                <button
                  onClick={handleSelectAllToggle}
                  className="px-4 py-2 border border-[#e8e4dc] hover:bg-[#f2f0eb] text-xs font-mono uppercase tracking-widest rounded-lg transition active:scale-95 cursor-pointer bg-white text-[#3a3834]"
                >
                  {selectedPhotoIds.length === photos.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handleBulkDeleteClick}
                  disabled={selectedPhotoIds.length === 0}
                  className="px-4 py-2 bg-[#c8501a] hover:bg-[#c8501a]/90 disabled:opacity-50 text-white text-xs font-mono uppercase tracking-widest rounded-lg transition active:scale-95 cursor-pointer font-bold"
                >
                  Delete ({selectedPhotoIds.length})
                </button>
                <button
                  onClick={handleToggleSelectionMode}
                  className="px-4 py-2 border border-[#e8e4dc] hover:bg-[#f2f0eb] text-xs font-mono uppercase tracking-widest rounded-lg transition active:scale-95 cursor-pointer bg-white text-[#3a3834]"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={handleToggleSelectionMode}
                className="px-4 py-2 border border-[#e8e4dc] hover:border-[#c8501a] hover:text-[#c8501a] text-xs font-mono uppercase tracking-widest rounded-lg transition active:scale-95 cursor-pointer bg-white text-[#3a3834]"
              >
                Select Photos
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <div className="text-center py-12 text-[#6b6760] font-sans">
          {error}
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-12 text-[#6b6760] font-sans">
          No labeled photos found for this person.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in duration-200">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              onDeleteClick={handleDeleteClick}
              isDeleting={deletingIds.includes(photo.id)}
              isSelectionMode={isSelectionMode}
              isSelected={selectedPhotoIds.includes(photo.id)}
              onSelectToggle={handleSelectToggle}
              onPhotoClick={(p) => setModalPhotoId(p.id)}
            />
          ))}
        </div>
      )}

      {/* Confirmation Deletion Modal overlay */}
      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedPhoto(null);
        }}
        onConfirm={handleConfirmDelete}
        photo={isBulkDelete ? null : selectedPhoto}
        count={isBulkDelete ? selectedPhotoIds.length : 0}
      />

      {modalPhotoId && (
        <PhotoDetailModal
          photoId={modalPhotoId}
          onClose={() => setModalPhotoId(null)}
          onPrev={photos.findIndex((p) => p.id === modalPhotoId) > 0 ? handlePrevPhoto : null}
          onNext={photos.findIndex((p) => p.id === modalPhotoId) < photos.length - 1 ? handleNextPhoto : null}
        />
      )}
    </div>
  );
};

export default PersonPhotosPage;
