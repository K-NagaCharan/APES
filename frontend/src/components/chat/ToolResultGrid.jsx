import React from 'react';
import ToolResultCard from './ToolResultCard';

/**
 * ToolResultGrid Component
 * Displays a list of photo results in a responsive grid.
 * Handles empty results gracefully and applies layout constraints for large monitors.
 *
 * @param {object} props
 * @param {Array} props.photos - Array of photo card objects: { id, thumbnailUrl, person, date }
 */
const ToolResultGrid = ({ photos }) => {
  // Empty state handling
  if (!photos || photos.length === 0) {
    return (
      <div className="w-full py-6 px-4 bg-[#faf9f6] border border-[#e8e4dc] rounded-2xl flex flex-col items-center justify-center text-center shadow-xs">
        <svg
          className="w-10 h-10 text-[#6b6760] mb-2 opacity-60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <p className="text-sm font-sans font-medium text-[#0f0e0c]">
          No matching photos found.
        </p>
        <p className="text-xs text-[#6b6760] mt-1 max-w-[280px]">
          Try refining your search terms or asking for different people.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl flex flex-col space-y-2">
      {/* Dynamic responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
        {photos.map((photo) => (
          <ToolResultCard key={photo.id || Math.random().toString()} photo={photo} />
        ))}
      </div>
    </div>
  );
};

export default ToolResultGrid;
