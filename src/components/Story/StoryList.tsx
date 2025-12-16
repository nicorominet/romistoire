import React, { useState, useEffect } from 'react';
import StoryGrid from './StoryGrid';
import { useStories } from '@/hooks/useStories';
import { i18n } from '@/lib/i18n';

const StoryList: React.FC = () => {
  const [filters, setFilters] = useState({
    theme: null,
    ageGroup: null,
    weekNumber: null,
    dayOfWeek: null,
  });

    const [page, setPage] = useState<number>(1);
    const limit = 12;

    const locale = i18n.getCurrentLocale();
    // Using TanStack Query hook
    const { data: response, isLoading: loading, error } = useStories({ 
        page, 
        limit, 
        // Logic from useFetchStories: if allLocales=true (which was passed), don't filter by locale.
        // So we don't pass locale here. 
        ...filters 
    });
    
    const stories = response?.data || [];

    const handleFilterChange = (filter: keyof typeof filters, value: string | number | null) => {
        setFilters(prevFilters => ({ ...prevFilters, [filter]: value }));
    };

    const handleNextPage = () => {
        setPage(prevPage => prevPage + 1);
    };

    const handlePrevPage = () => {
        setPage(prevPage => Math.max(prevPage - 1, 1));
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error instanceof Error ? error.message : 'An error occurred'}</div>;

    return (
        <div className="dark:bg-gray-900 dark:text-gray-100">
            <h1>{i18n.t('stories.title')}</h1>
            <StoryGrid locale={locale} stories={stories} {...filters} />
            <div className="pagination">
                <button onClick={handlePrevPage} disabled={page === 1}>
                    {i18n.t('pagination.previous')}
                </button>
                <span>{i18n.t('pagination.page', { page: page.toString() })}</span>
                <button onClick={handleNextPage} disabled={stories.length < limit}>
                    {i18n.t('pagination.next')}
                </button>
            </div>
        </div>
    );
};

export default StoryList;