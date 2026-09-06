import { baseApi } from './baseApi';

/**
 * GET/PUT /admin/config — association-wide settings, MANAGER-only.
 * The backend only accepts the fields listed in UpdateAssociationConfigBody
 * below (see backend/src/modules/admin/admin.schema.ts) — anything else is
 * rejected with a 400, not silently written.
 */
export interface AssociationConfig {
  id: string;
  association_id: string;
  association_name: string;
  onboarding_mode: 'INVITE_ONLY' | 'SELF_REGISTER_WITH_CODE' | 'OPEN';
  registration_unit_code: string | null;
  require_manager_approval: boolean;
  invite_expiry_hours: number;
  invite_max_resends: number;
  otp_length: number;
  otp_ttl_seconds: number;
  otp_max_attempts: number;
  otp_lockout_minutes: number;
  otp_resend_cooldown_sec: number;
  assistant_voice_language: string;
  session_idle_timeout_min: number;
  max_concurrent_sessions: number;
  /** Decimal(10,2) — comes back as a string, same as every other money field in this app. */
  expense_approval_threshold: string;
  financial_year_start_month: number;
  created_at: string;
  updated_at: string;
}

export type UpdateAssociationConfigBody = Partial<
  Pick<
    AssociationConfig,
    | 'onboarding_mode'
    | 'registration_unit_code'
    | 'require_manager_approval'
    | 'invite_expiry_hours'
    | 'invite_max_resends'
    | 'otp_length'
    | 'otp_ttl_seconds'
    | 'otp_max_attempts'
    | 'otp_lockout_minutes'
    | 'otp_resend_cooldown_sec'
    | 'assistant_voice_language'
    | 'session_idle_timeout_min'
    | 'max_concurrent_sessions'
    | 'financial_year_start_month'
  >
> & { expense_approval_threshold?: number };

export const associationConfigApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAssociationConfig: builder.query<{ data: AssociationConfig }, void>({
      query: () => '/admin/config',
      providesTags: ['AssociationConfig'],
    }),
    updateAssociationConfig: builder.mutation<{ data: AssociationConfig }, UpdateAssociationConfigBody>({
      query: (body) => ({ url: '/admin/config', method: 'PUT', body }),
      invalidatesTags: ['AssociationConfig'],
    }),
  }),
});

export const { useGetAssociationConfigQuery, useUpdateAssociationConfigMutation } = associationConfigApi;
