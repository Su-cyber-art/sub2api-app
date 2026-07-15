const { proxy } = require('valtio');

export type AdminComplianceMetadata = {
  version?: string;
  document_path_zh?: string;
  document_path_en?: string;
  document_url_zh?: string;
  document_url_en?: string;
};

export const adminComplianceState = proxy({
  required: false,
  serverKey: '',
  metadata: undefined as AdminComplianceMetadata | undefined,
});

export function requireAdminCompliance(serverKey: string, metadata?: Record<string, unknown>) {
  adminComplianceState.required = true;
  adminComplianceState.serverKey = serverKey;
  adminComplianceState.metadata = metadata as AdminComplianceMetadata | undefined;
}

export function clearAdminCompliance() {
  adminComplianceState.required = false;
  adminComplianceState.serverKey = '';
  adminComplianceState.metadata = undefined;
}
