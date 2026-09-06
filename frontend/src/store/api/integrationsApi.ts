import { baseApi } from './baseApi';

export const API_KEY_SCOPES = [
  { value: 'expenses:approve',          label: 'Approve expenses' },
  { value: 'dues:waive_penalty',        label: 'Waive a bill penalty' },
  { value: 'maintenance:update_ticket', label: 'Update a maintenance ticket\'s status' },
] as const;

export interface IntegrationApiKey {
  id:            string;
  name:          string;
  key_prefix:    string;
  scopes:        string[];
  is_active:     boolean;
  last_used_at:  string | null;
  created_at:    string;
  revoked_at:    string | null;
  creator:       { name: string } | null;
  revoker:       { name: string } | null;
}

export interface CreatedIntegrationApiKey {
  id:         string;
  name:       string;
  key_prefix: string;
  scopes:     string[];
  created_at: string;
  /** Shown exactly once — the caller must copy it now. Never returned again. */
  secret:     string;
}

export const integrationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listApiKeys: builder.query<{ data: IntegrationApiKey[] }, void>({
      query: () => '/integrations/api-keys',
      providesTags: ['IntegrationApiKey'],
    }),
    createApiKey: builder.mutation<{ data: CreatedIntegrationApiKey }, { name: string; scopes: string[] }>({
      query: (body) => ({ url: '/integrations/api-keys', method: 'POST', body }),
      invalidatesTags: ['IntegrationApiKey'],
    }),
    revokeApiKey: builder.mutation<{ data: { message: string } }, string>({
      query: (id) => ({ url: `/integrations/api-keys/${id}/revoke`, method: 'POST' }),
      invalidatesTags: ['IntegrationApiKey'],
    }),
  }),
});

export const { useListApiKeysQuery, useCreateApiKeyMutation, useRevokeApiKeyMutation } = integrationsApi;
