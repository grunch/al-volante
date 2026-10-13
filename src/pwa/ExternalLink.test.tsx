import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PWA_COPY } from '../i18n/es-AR.ts';
import { setConnection } from '../test/connection.ts';
import { ExternalLink } from './ExternalLink.tsx';

const PDF = 'https://example.org/manual.pdf#page=3';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExternalLink', () => {
  it('opens the official source in a new tab without giving it access to the app', () => {
    render(<ExternalLink href={PDF}>PDF oficial</ExternalLink>);

    const link = screen.getByRole('link', { name: 'PDF oficial' });
    expect(link).toHaveAttribute('href', PDF);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('says that it needs a connection while offline, and stops saying it once back online', () => {
    // Arrange
    render(<ExternalLink href={PDF}>PDF oficial</ExternalLink>);

    // Act
    setConnection(false);
    const offlineName = screen.getByRole('link').textContent;
    setConnection(true);

    // Assert
    expect(offlineName).toBe(`PDF oficial ${PWA_COPY.needsConnection}`);
    expect(screen.getByRole('link', { name: 'PDF oficial' })).toBeInTheDocument();
  });
});
