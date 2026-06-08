import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import PhotoCard from '../components/PhotoCard';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';

const Gallery = () => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  
  // Pagination details
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 30;

  // Deletion details
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [deletingIds, setDeletingIds] = useState([]);

  // Fetch photos function
  const fetchPhotos = useCallback(async (currentSkip, append = false) => {
    if (currentSkip === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const response = await api.get(`/photos?limit=${LIMIT}&skip=${currentSkip}`);
      if (response.data && response.data.success) {
        const fetchedPhotos = response.data.data.photos;
        
        if (append) {
          setPhotos((prev) => [...prev, ...fetchedPhotos]);
        } else {
          setPhotos(fetchedPhotos);
        }

        // Determine if there are more photos
        if (fetchedPhotos.length < LIMIT) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      }
    } catch (err) {
      setError('Unable to load photos. Please check your connection.');
      toast.error(err.response?.data?.message || 'Failed to fetch photos.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Fetch initial batch on mount
  useEffect(() => {
    fetchPhotos(0);
  }, [fetchPhotos]);

  // Load more trigger
  const handleLoadMore = () => {
    const nextSkip = skip + LIMIT;
    setSkip(nextSkip);
    fetchPhotos(nextSkip, true);
  };

  // Retry trigger
  const handleRetry = () => {
    setSkip(0);
    setHasMore(true);
    fetchPhotos(0);
  };

  // Deletion handlers
  const handleDeleteClick = (photo) => {
    setSelectedPhoto(photo);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (photoId) => {
    setDeleteModalOpen(false);
    
    // Add to deleting list to show loading spinners on the card itself
    setDeletingIds((prev) => [...prev, photoId]);

    try {
      await api.delete(`/photos/${photoId}`);
      toast.success('Photo deleted successfully!');
      
      // Filter out immediately from UI
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to delete photo';
      toast.error(errMsg);
    } finally {
      // Remove from deleting loading state
      setDeletingIds((prev) => prev.filter((id) => id !== photoId));
      setSelectedPhoto(null);
    }
  };

  return (
    <div className="flex-grow max-w-7xl w-full mx-auto p-6 md:p-12 space-y-8 select-none flex flex-col justify-start">
      {/* Header */}
      <section className="space-y-1">
        <span className="font-mono text-xs uppercase tracking-widest text-[#c8501a] font-bold">
          Asset Control
        </span>
        <h1 className="text-3xl font-serif text-[#0f0e0c]">
          Photo Gallery
        </h1>
        <p className="text-sm text-[#6b6760] leading-relaxed">
          Manage your uploaded images and map corresponding face structures.
        </p>
      </section>

      {/* Main Area */}
      {loading ? (
        /* Loader state */
        <PageLoader />
      ) : error ? (
        /* Network Error & Retry Interface */
        <div className="border border-red-200 bg-red-50/50 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 flex flex-col items-center">
          <div className="p-3 bg-red-100 rounded-full text-red-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-serif text-[#0f0e0c] font-bold">Connection Error</h3>
            <p className="text-sm text-[#6b6760] leading-relaxed">{error}</p>
          </div>
          <button
            onClick={handleRetry}
            className="px-6 py-2 bg-[#0f0e0c] hover:bg-[#c8501a] text-white text-xs font-mono uppercase tracking-widest rounded-lg font-semibold transition active:scale-95 cursor-pointer mt-2"
          >
            Retry Fetch
          </button>
        </div>
      ) : photos.length === 0 ? (
        /* Empty State */
        <EmptyState />
      ) : (
        /* Cards Grid list */
        <div className="space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {photos.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                onDeleteClick={handleDeleteClick}
                isDeleting={deletingIds.includes(photo.id)}
              />
            ))}
          </div>

          {/* Pagination trigger button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-8 py-3 border border-[#e8e4dc] hover:border-[#c8501a] hover:text-[#c8501a] text-xs font-mono uppercase tracking-widest rounded-lg transition active:scale-95 cursor-pointer bg-white text-[#3a3834] font-semibold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loadingMore ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#c8501a]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Fetching assets...</span>
                  </>
                ) : (
                  <span>Load More</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Deletion Modal overlay */}
      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        photo={selectedPhoto}
      />
    </div>
  );
};

export default Gallery;
