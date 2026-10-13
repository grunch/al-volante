import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignGraphic, hasSignDrawing } from './SignGraphic.tsx';

describe('SignGraphic', () => {
  it('draws the signs it knows as vector images named by their description', () => {
    render(<SignGraphic signId="sign.regulatory.priority.stop" description="Octógono rojo con la palabra PARE" />);

    expect(hasSignDrawing('sign.regulatory.priority.stop')).toBe(true);
    expect(screen.getByRole('img', { name: 'Octógono rojo con la palabra PARE' }).tagName).toBe('svg');
  });

  it('shows the crop of the manual page for a sign without a drawing', () => {
    render(<SignGraphic signId="sign.preventive.curve" description="Rombo amarillo con una curva" hasCrop />);

    expect(hasSignDrawing('sign.preventive.curve')).toBe(false);
    expect(screen.getByRole('img', { name: 'Rombo amarillo con una curva' })).toHaveAttribute(
      'src',
      expect.stringMatching(/signs\/preventive\.curve\.png$/),
    );
  });

  it('falls back to the written description when there is neither drawing nor crop', () => {
    render(<SignGraphic signId="sign.preventive.curve" description="Rombo amarillo con una curva" />);

    expect(screen.getByRole('img', { name: 'Rombo amarillo con una curva' })).toHaveTextContent(
      'Rombo amarillo con una curva',
    );
  });
});
