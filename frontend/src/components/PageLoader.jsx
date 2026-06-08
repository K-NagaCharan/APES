import React from 'react';

const PageLoader = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-pulse">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="border border-[#e8e4dc] bg-white rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
          {/* Skeleton Thumbnail */}
          <div className="aspect-square bg-[#f2f0eb] w-full"></div>
          
          {/* Skeleton details */}
          <div className="p-4 space-y-4 flex-grow flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-[#e8e4dc] rounded"></div>
                <div className="h-3 w-16 bg-[#e8e4dc] rounded"></div>
              </div>
              <div className="flex justify-between pt-1">
                <div className="h-4 w-24 bg-[#e8e4dc] rounded"></div>
                <div className="h-4 w-20 bg-[#e8e4dc] rounded"></div>
              </div>
            </div>
            
            <div className="pt-3 border-t border-[#f2f0eb] flex justify-between items-center">
              <div className="h-3 w-20 bg-[#e8e4dc] rounded"></div>
              <div className="h-4 w-6 bg-[#e8e4dc] rounded-full"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PageLoader;
