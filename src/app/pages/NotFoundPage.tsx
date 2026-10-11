import { Link } from 'react-router';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { t } from '../../i18n/es-AR.ts';

export function NotFoundPage() {
  return (
    <>
      <PageTitle>{t('notFoundHeading')}</PageTitle>
      <p>{t('notFoundBody')}</p>
      <p>
        <Link to="/">{t('backHome')}</Link>
      </p>
    </>
  );
}
