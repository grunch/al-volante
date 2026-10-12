import { Link } from 'react-router';
import { SignGraphic } from '../../activities/ui/SignGraphic.tsx';
import type { Sign } from '../../content/schemas.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { SIGN_COPY } from '../../i18n/es-AR.ts';

/** `Reglamentarias / De prohibición` → `Reglamentarias`: the family that heads each part of the catalog. */
export const familyOf = (sign: Pick<Sign, 'group'>) => sign.group.split(' / ')[0] ?? sign.group;

/** Groups preserving catalog order (page order): family → group → signs. */
export function groupSigns(signs: readonly Sign[]): Array<{ family: string; groups: Array<[string, Sign[]]> }> {
  const families = new Map<string, Map<string, Sign[]>>();
  for (const sign of [...signs].sort((a, b) => a.page - b.page)) {
    const family = familyOf(sign);
    const groups = families.get(family) ?? new Map<string, Sign[]>();
    groups.set(sign.group, [...(groups.get(sign.group) ?? []), sign]);
    families.set(family, groups);
  }
  return [...families].map(([family, groups]) => ({ family, groups: [...groups] }));
}

/** The visual catalog of every sign in the manual: its crop, name, meaning, page and where to practise it. */
export function SignsPage() {
  return (
    <>
      <PageTitle>{SIGN_COPY.heading}</PageTitle>
      <p className="lead">{SIGN_COPY.intro}</p>
      <ContentGate>
        {(content) => {
          // An activity may practise several signs: each card links to the variant of its own sign.
          const practice = new Map<string, string>();
          for (const activity of content.activities)
            if (activity.type === 'sign-identification' && activity.status === 'reviewed')
              for (const variant of activity.variants)
                if (!practice.has(variant.signId))
                  practice.set(variant.signId, `/actividad/${activity.id}?variante=${encodeURIComponent(variant.id)}`);
          // Families have spaces ("Señalamiento luminoso"): aria-labelledby takes a list of ids, so ids use the index.
          return groupSigns(content.signs).map(({ family, groups }, index) => (
            <section key={family} aria-labelledby={`signs-family-${index}`} className="map-group">
              <h2 id={`signs-family-${index}`}>{family}</h2>
              {groups.map(([group, signs]) => (
                <div key={group}>
                  {group !== family && <h3>{group.split(' / ').slice(1).join(' / ') || group}</h3>}
                  <ul className="sign-grid">
                    {signs.map((sign) => (
                      <SignCard key={sign.id} sign={sign} practiceLink={practice.get(sign.id)} />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ));
        }}
      </ContentGate>
    </>
  );
}

function SignCard({ sign, practiceLink }: { sign: Sign; practiceLink: string | undefined }) {
  return (
    <li className="sign-card">
      <SignGraphic signId={sign.id} description={sign.visual} hasCrop={sign.box !== undefined} />
      <p className="sign-card__name">{sign.name}</p>
      {sign.meaning && <p>{sign.meaning}</p>}
      {sign.consultationReason && (
        <p>
          <span className="badge">{SIGN_COPY.consultation}</span> {sign.consultationReason}
        </p>
      )}
      <p className="card__meta">
        <Link to={`/biblioteca/manual/${sign.page}`}>
          {SIGN_COPY.page} {sign.page}
        </Link>
        {practiceLink && (
          <>
            {' · '}
            <Link to={practiceLink}>{SIGN_COPY.practise}</Link>
          </>
        )}
      </p>
    </li>
  );
}
