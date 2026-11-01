/** @typedef {'get_settings'|'get_staff_role'|'get_active_dev'|'pool'|'list_templates'|'get_template'|'template_usage'|'create_template'|'update_template'|'remove_template'|'find_component'|'move_template'|'create_delivery'|'claim_deliveries'|'mark_delivery_sent'|'mark_delivery_failed'|'create_folder'|'list_folders'|'rename_folder'|'remove_folder'|'list_role_groups'|'create_role_group'|'update_role_group'|'remove_role_group'|'list_custom_actions'|'create_custom_action'|'remove_custom_action'|'get_custom_button_config'|'save_custom_button_config'|'get_custom_select_config'|'save_custom_select_config'|'get_member_event'|'list_member_events'|'save_member_event'} DatabaseOperation */
/** @typedef {'connect'|'query'|'validate_settings'|'idle'} DatabaseStage */
/** @typedef {{operation: DatabaseOperation, stage: DatabaseStage, errorCode: string, reason: string}} DatabaseDiagnostic */

// Only fixed, recognized codes and descriptions cross the logging boundary.
// Driver messages, SQL, connection options and server detail can contain secrets.
const reasons = new Map([
  ['ENOTFOUND', 'dns_lookup_failed'],
  ['EAI_AGAIN', 'dns_lookup_failed'],
  ['ECONNREFUSED', 'connection_refused'],
  ['ECONNRESET', 'connection_lost'],
  ['EPIPE', 'connection_lost'],
  ['ENETUNREACH', 'network_unreachable'],
  ['EHOSTUNREACH', 'network_unreachable'],
  ['ETIMEDOUT', 'connection_timeout'],
  ['DEPTH_ZERO_SELF_SIGNED_CERT', 'tls_untrusted_certificate'],
  ['SELF_SIGNED_CERT_IN_CHAIN', 'tls_untrusted_certificate'],
  ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'tls_untrusted_certificate'],
  ['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'tls_untrusted_certificate'],
  ['CERT_HAS_EXPIRED', 'tls_certificate_expired'],
  ['CERT_NOT_YET_VALID', 'tls_certificate_not_yet_valid'],
  ['ERR_TLS_CERT_ALTNAME_INVALID', 'tls_hostname_mismatch'],
  ['ERR_OSSL_PEM_NO_START_LINE', 'tls_invalid_ca'],
  ['ERR_OSSL_PEM_BAD_BASE64_DECODE', 'tls_invalid_ca'],
  ['ERR_OSSL_ASN1_TOO_LONG', 'tls_invalid_ca'],
  ['28P01', 'authentication_failed'],
  ['28000', 'authorization_failed'],
  ['3D000', 'database_not_found'],
  ['3F000', 'schema_not_found'],
  ['42P01', 'table_not_found'],
  ['42703', 'column_not_found'],
  ['42501', 'insufficient_privilege'],
  ['53300', 'too_many_connections'],
  ['57014', 'query_canceled_or_timed_out'],
  ['57P01', 'database_shutting_down'],
  ['57P03', 'database_unavailable'],
  ['08001', 'connection_failed'],
  ['08006', 'connection_lost'],
  ['XX000', 'database_internal_error'],
]);

export class DatabaseSettingsError extends Error {
  /** @param {'SETTINGS_MISSING'|'SETTINGS_INVALID'|'ENVIRONMENT_MISMATCH'} code */
  constructor(code) {
    super('Invalid database settings or environment');
    this.name = 'DatabaseSettingsError';
    this.code = code;
  }
}

/** @param {unknown} error @param {DatabaseOperation} operation @param {DatabaseStage} stage @returns {DatabaseDiagnostic} */
export function databaseDiagnostic(error, operation, stage) {
  if (error instanceof DatabaseSettingsError) {
    return { operation, stage: 'validate_settings', errorCode: error.code, reason: {
      SETTINGS_MISSING: 'settings_missing',
      SETTINGS_INVALID: 'settings_invalid',
      ENVIRONMENT_MISMATCH: 'environment_mismatch',
    }[error.code] };
  }
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    const reason = reasons.get(error.code);
    if (reason) return { operation, stage, errorCode: error.code, reason };
  }
  // pg's own connection timeouts do not carry a code. Match only its fixed messages.
  if (stage === 'connect' && error instanceof Error && [
    'timeout exceeded when trying to connect',
    'Connection terminated due to connection timeout',
  ].includes(error.message)) {
    return { operation, stage, errorCode: 'CONNECTION_TIMEOUT', reason: 'connection_timeout' };
  }
  return { operation, stage, errorCode: 'UNKNOWN', reason: 'unclassified_database_error' };
}
