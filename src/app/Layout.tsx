import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { t } from '../i18n/es-AR.ts';

const NAV_ITEMS = [
  { to: '/', label: t('navHome'), end: true },
  { to: '/mapa', label: t('navMap'), end: false },
  { to: '/actividades', label: t('navActivities'), end: false },
  { to: '/bitacora', label: t('navLogbook'), end: false },
  { to: '/biblioteca', label: t('navLibrary'), end: false },
] as const;

/** Shared chrome: skip link, header navigation, main landmark and footer. */
export function Layout() {
  const location = useLocation();
  const firstRender = useRef(true);

  useEffect(() => {
    // On client-side navigation, move focus to the new page title so screen readers announce it.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('page-title')?.focus();
  }, [location.pathname]);

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        {t('skipToContent')}
      </a>
      <header className="app-header">
        <Link className="app-header__brand" to="/">
          {t('appTitle')}
        </Link>
        <nav aria-label={t('mainNavigation')}>
          <ul className="app-nav">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className="app-nav__link">
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>{t('footerSources')}</p>
      </footer>
    </>
  );
}
