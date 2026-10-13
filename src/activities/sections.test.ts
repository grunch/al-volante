import { describe, expect, it } from 'vitest';
import { choiceActivity, unit } from '../content/testing/fixtures.ts';
import { activitiesBySection, sectionKey } from './sections.ts';

describe('activitiesBySection', () => {
  const units = [
    unit({ id: 'manual.ch3.a', section: 'ch3' }),
    unit({ id: 'manual.ch1.a', section: 'ch1' }),
    unit({ id: 'siniestros.s1.a', source: 'siniestros', section: 's1', category: 'guide' }),
  ];

  it('groups activities by the section of their first unit, keeping catalog order inside each one', () => {
    // Arrange: the second activity also practises a ch1 unit, but lives in ch3 with its first unit.
    const activities = [
      choiceActivity({ id: 'act.one', unitIds: ['manual.ch3.a'] }),
      choiceActivity({ id: 'act.two', unitIds: ['manual.ch3.a', 'manual.ch1.a'] }),
      choiceActivity({ id: 'act.three', unitIds: ['siniestros.s1.a'] }),
      choiceActivity({ id: 'act.four', unitIds: ['manual.ch1.a'] }),
    ];

    // Act
    const groups = activitiesBySection(activities, units);

    // Assert
    expect([...groups].map(([key, list]) => [key, list.map((activity) => activity.id)])).toEqual([
      ['manual-ch3', ['act.one', 'act.two']],
      ['siniestros-s1', ['act.three']],
      ['manual-ch1', ['act.four']],
    ]);
  });

  it('leaves out activities whose first unit is not in the content', () => {
    const groups = activitiesBySection([choiceActivity({ unitIds: ['manual.ch9.ghost', 'manual.ch3.a'] })], units);

    expect(groups.size).toBe(0);
  });

  it('builds the section key used in file names and URLs', () => {
    expect(sectionKey('manual', 'annex4')).toBe('manual-annex4');
  });
});
