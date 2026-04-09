// flow ごとの nextStep を呼び出すディスパッチャ。
// state machine の唯一の入口。

import type { FlowKind, Slots } from '@/lib/slots/types';
import type { Step, NextStepFn } from './types';
import { householdNextStep } from './household';
import { businessSpotNextStep } from './business-spot';
import { businessRecurringNextStep } from './business-recurring';

const NEXT_STEP_BY_FLOW: Record<FlowKind, NextStepFn> = {
  household_spot: householdNextStep,
  business_spot: businessSpotNextStep,
  business_recurring: businessRecurringNextStep,
};

/**
 * 現在の slots から次に表示すべき step を返す。
 * 全項目埋まっていれば null。
 */
export function nextStep(flow: FlowKind, slots: Slots): Step | null {
  return NEXT_STEP_BY_FLOW[flow](slots);
}
