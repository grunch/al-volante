import type { Attempt, RuleCatalog } from './schemas.ts';

/**
 * Checks an attempt against the exam rules: every fault cites a known rule with that rule's points, a scored result
 * adds up its faults, and activity attempts carry no driving faults. Used before trusting attempts from a backup.
 */
export function attemptErrors(attempt: Attempt, rules: RuleCatalog): string[] {
  const errors: string[] = [];
  const byId = new Map(rules.rules.map((rule) => [rule.id, rule]));
  if (attempt.kind === 'activity' && attempt.faults.length > 0)
    errors.push(`${attempt.id}: activity attempts cannot have driving faults`);
  attempt.faults.forEach((fault, index) => {
    const rule = byId.get(fault.ruleId);
    if (!rule) errors.push(`${attempt.id}: fault ${index} cites unknown rule ${fault.ruleId}`);
    else if (fault.points !== rule.points)
      errors.push(`${attempt.id}: fault ${index} gives ${fault.points} points, but ${rule.id} is worth ${rule.points}`);
  });
  const total = attempt.faults.reduce((sum, fault) => sum + fault.points, 0);
  if (attempt.result.points !== null && attempt.result.points !== total)
    errors.push(`${attempt.id}: result points ${attempt.result.points} do not match the faults (${total})`);
  return errors;
}
