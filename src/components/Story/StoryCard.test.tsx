
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StoryCard from './StoryCard';
import { Story } from '@/types/Story';

// Polyfill ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock dependencies
vi.mock('@/lib/i18n', () => ({
    i18n: {
        t: (key: string) => key,
        getCurrentLocale: () => 'fr'
    }
}));

// Mock UI components to guarantee rendering
vi.mock('@/components/ui/card', () => ({
    Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
    CardHeader: ({ children }: any) => <div>{children}</div>,
    CardTitle: ({ children }: any) => <h1>{children}</h1>,
    CardContent: ({ children }: any) => <div>{children}</div>,
    CardFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children, className, style }: any) => <span className={`badge ${className}`} style={style}>{children}</span>
}));

// Mock SafeImage to avoid complex image loading logic in JSDOM
vi.mock('@/components/ui/SafeImage', () => ({
    default: ({ src, alt, className }: any) => <img src={src} alt={alt} className={className} data-testid="safe-image" />
}));

// Mock Utils if needed, but they seem pure. Let's check if they cause issues.
// getAgeGroupColor, formatDate, truncateText are from utils which are pure functions. 
// We generally don't need to mock them unless they depend on external state.

describe('StoryCard', () => {
    const mockStory: Story = {
        id: '123',
        title: 'The Great Adventure',
        content: 'Once upon a time there was a great adventure that spanned many lands...',
        age_group: '4-6',
        locale: 'fr',
        created_at: '2023-01-01T10:00:00Z',
        modified_at: '2023-01-02T10:00:00Z',
        week_number: 1,
        day_order: 1,
        version: 1,
        themes: [
            { id: 't1', name: 'Adventure', color: '#ff0000', description: 'Adventure theme description', created_at: '2023-01-01T10:00:00Z' },
            { id: 't2', name: 'Magic', color: '#0000ff', description: 'Magic theme description', created_at: '2023-01-01T10:00:00Z' }
        ],
        series_name: 'Epic Series',
        illustrations: [
            { id: 'img1', story_id: '123', image_path: 'uploads/img1.jpg', created_at: '...' }
        ]
    };

    it('renders story title and excerpt', () => {
        const { debug } = render(
            <MemoryRouter>
                <StoryCard story={mockStory} />
            </MemoryRouter>
        );

        // debug(); // Trace render
        if (screen.queryByText('The Great Adventure') === null) {
             throw new Error('StoryCard HTML: ' + document.body.innerHTML);
        }

        expect(screen.getByText('The Great Adventure')).toBeInTheDocument();
        // Expect truncated content (simple check for availability)
        expect(screen.getByText(/Once upon a time/)).toBeInTheDocument();
    });

    it('renders localized badges for age group', () => {
        render(
            <MemoryRouter>
                <StoryCard story={mockStory} />
            </MemoryRouter>
        );
        // Expect translation key for age group
        expect(screen.getByText('ages.4-6')).toBeInTheDocument();
    });

    it('renders theme badges with correct names', () => {
        render(
            <MemoryRouter>
                <StoryCard story={mockStory} />
            </MemoryRouter>
        );
        expect(screen.getByText('Adventure')).toBeInTheDocument();
        expect(screen.getByText('Magic')).toBeInTheDocument();
    });

    it('renders series badge if series_name is present', () => {
        render(
            <MemoryRouter>
                <StoryCard story={mockStory} />
            </MemoryRouter>
        );
        expect(screen.getByText('Epic Series')).toBeInTheDocument();
    });

    it('renders image if illustrations are present', () => {
        render(
            <MemoryRouter>
                <StoryCard story={mockStory} />
            </MemoryRouter>
        );
        const image = screen.getByTestId('safe-image');
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute('src', '/uploads/img1.jpg');
    });

    it('does not render image if illustrations are empty', () => {
        const storyNoImage = { ...mockStory, illustrations: [] };
        render(
            <MemoryRouter>
                <StoryCard story={storyNoImage} />
            </MemoryRouter>
        );
        expect(screen.queryByTestId('safe-image')).not.toBeInTheDocument();
    });

    it('contains a link to the story detail page', () => {
        render(
            <MemoryRouter>
                <StoryCard story={mockStory} />
            </MemoryRouter>
        );
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/stories/123');
    });

    it('uses fallback theme colors if provided', () => {
        // This tests the visual logic (getThemeBadgeStyle). 
        // Hard to test style computed values easily in JSDOM without getting into computedStyle.
        // We can check the style attribute if it's inline.
        // The component uses `style={{ backgroundColor: ... }}`
        
        render(
            <MemoryRouter>
                <StoryCard story={mockStory} themeColors={{ 't1': '#fabada' }} />
            </MemoryRouter>
        );
        
        const badge = screen.getByText('Adventure').closest('.badge') || screen.getByText('Adventure');
        // Look for the specific hex code in the style
        expect(badge).toHaveStyle({ backgroundColor: '#fabada' }); // #ff0000 was default in object, but themeColors prop should override?
        // Wait, logic is: `const color = themeColors[themeId] || fallback || "#ccc";`
        // In mockStory, theme objects have color.
        // `themeObj.color` is passed as fallback.
        // But `themeColors` prop has precedence!
        // So it should be #fabada.
    });
});
