export interface ToMEntry {
  about_persona_id: string;
  i_think_they_believe: string;
  their_unstated_assumption: string;
  my_confidence_in_this_read: number;
}

export interface ToMState {
  evaluation_id: string;
  observer_persona_id: string;
  round_number: number;
  entries: ToMEntry[];
}

export const TOM_BELIEF_MAX_CHARS = 200;
export const TOM_ASSUMPTION_MAX_CHARS = 240;
