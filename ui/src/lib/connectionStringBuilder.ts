import { z } from 'zod';
import type { ConnectionType } from './api/types';

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'password' | 'boolean' | 'select' | 'textarea';
  placeholder?: string;
  defaultValue?: string | number | boolean;
  required?: boolean;
  options?: { value: string; label: string }[];
  col?: number;
  helpText?: string;
}

const sqlServerFields: FieldDef[] = [
  { name: 'host', label: 'Host / Server', type: 'text', placeholder: 'localhost', required: true, col: 8 },
  { name: 'port', label: 'Port', type: 'number', placeholder: '1433', defaultValue: 1433, col: 4 },
  { name: 'database', label: 'Database', type: 'text', placeholder: 'mydb', required: true, col: 6 },
  { name: 'username', label: 'Username', type: 'text', required: true, col: 6 },
  { name: 'password', label: 'Password', type: 'password', required: true, col: 6 },
  { name: 'trustServerCertificate', label: 'Trust Server Certificate', type: 'boolean', defaultValue: true, col: 3 },
  { name: 'encrypt', label: 'Encrypt', type: 'boolean', defaultValue: false, col: 3 },
  { name: 'connectionTimeout', label: 'Connection Timeout (s)', type: 'number', placeholder: '30', col: 6 },
];

const postgreSqlFields: FieldDef[] = [
  { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true, col: 8 },
  { name: 'port', label: 'Port', type: 'number', placeholder: '5432', defaultValue: 5432, col: 4 },
  { name: 'database', label: 'Database', type: 'text', placeholder: 'mydb', required: true, col: 6 },
  { name: 'username', label: 'Username', type: 'text', required: true, col: 6 },
  { name: 'password', label: 'Password', type: 'password', required: true, col: 6 },
  { name: 'sslMode', label: 'SSL Mode', type: 'select', defaultValue: 'Prefer', options: [
    { value: 'Disable', label: 'Disable' },
    { value: 'Allow', label: 'Allow' },
    { value: 'Prefer', label: 'Prefer' },
    { value: 'Require', label: 'Require' },
  ], col: 3 },
  { name: 'connectionTimeout', label: 'Connection Timeout (s)', type: 'number', placeholder: '30', col: 3 },
];

const mySqlFields: FieldDef[] = [
  { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true, col: 8 },
  { name: 'port', label: 'Port', type: 'number', placeholder: '3306', defaultValue: 3306, col: 4 },
  { name: 'database', label: 'Database', type: 'text', placeholder: 'mydb', required: true, col: 6 },
  { name: 'username', label: 'Username', type: 'text', required: true, col: 6 },
  { name: 'password', label: 'Password', type: 'password', required: true, col: 6 },
  { name: 'sslMode', label: 'SSL Mode', type: 'select', defaultValue: 'Preferred', options: [
    { value: 'None', label: 'None' },
    { value: 'Preferred', label: 'Preferred' },
    { value: 'Required', label: 'Required' },
  ], col: 3 },
  { name: 'connectionTimeout', label: 'Connection Timeout (s)', type: 'number', placeholder: '30', col: 3 },
];

const sqLiteFields: FieldDef[] = [
  { name: 'dataSource', label: 'Data Source (File Path)', type: 'text', placeholder: '/path/to/database.db', required: true, col: 12 },
  { name: 'mode', label: 'Mode', type: 'select', defaultValue: 'ReadWriteCreate', options: [
    { value: 'ReadOnly', label: 'Read Only' },
    { value: 'ReadWrite', label: 'Read Write' },
    { value: 'ReadWriteCreate', label: 'Read Write Create' },
  ], col: 6 },
];

const oracleFields: FieldDef[] = [
  { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true, col: 8 },
  { name: 'port', label: 'Port', type: 'number', placeholder: '1521', defaultValue: 1521, col: 4 },
  { name: 'serviceName', label: 'Service Name', type: 'text', placeholder: 'ORCL', required: true, col: 12 },
  { name: 'username', label: 'Username', type: 'text', required: true, col: 6 },
  { name: 'password', label: 'Password', type: 'password', required: true, col: 6 },
];

const mongoDbFields: FieldDef[] = [
  { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true, col: 8 },
  { name: 'port', label: 'Port', type: 'number', placeholder: '27017', defaultValue: 27017, col: 4 },
  { name: 'database', label: 'Database', type: 'text', placeholder: 'mydb', required: true, col: 6 },
  { name: 'username', label: 'Username', type: 'text', col: 6 },
  { name: 'password', label: 'Password', type: 'password', col: 6 },
  { name: 'authSource', label: 'Auth Source', type: 'text', placeholder: 'admin', col: 6 },
  { name: 'ssl', label: 'SSL', type: 'boolean', defaultValue: false, col: 4 },
  { name: 'replicaSet', label: 'Replica Set', type: 'text', col: 8 },
];

const snowflakeFields: FieldDef[] = [
  { name: 'account', label: 'Account', type: 'text', placeholder: 'xy12345.us-east-1', required: true, col: 12 },
  { name: 'username', label: 'Username', type: 'text', required: true, col: 6 },
  { name: 'password', label: 'Password', type: 'password', required: true, col: 6 },
  { name: 'database', label: 'Database', type: 'text', required: true, col: 6 },
  { name: 'schema', label: 'Schema', type: 'text', placeholder: 'PUBLIC', col: 6 },
  { name: 'warehouse', label: 'Warehouse', type: 'text', required: true, col: 6 },
  { name: 'role', label: 'Role', type: 'text', col: 6 },
];

const bigQueryFields: FieldDef[] = [
  { name: 'projectId', label: 'Project ID', type: 'text', placeholder: 'my-gcp-project', required: true, col: 12 },
  { name: 'credentials', label: 'Service Account JSON', type: 'textarea', placeholder: 'Paste service account JSON...', required: true, col: 12 },
];

const clickHouseFields: FieldDef[] = [
  { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true, col: 8 },
  { name: 'port', label: 'Port', type: 'number', placeholder: '8123', defaultValue: 8123, col: 4 },
  { name: 'database', label: 'Database', type: 'text', placeholder: 'default', required: true, col: 12 },
  { name: 'username', label: 'Username', type: 'text', col: 6 },
  { name: 'password', label: 'Password', type: 'password', col: 6 },
];

const fieldsByType: Record<string, FieldDef[]> = {
  SqlServer: sqlServerFields,
  PostgreSQL: postgreSqlFields,
  MySQL: mySqlFields,
  SQLite: sqLiteFields,
  Oracle: oracleFields,
  MongoDB: mongoDbFields,
  Snowflake: snowflakeFields,
  BigQuery: bigQueryFields,
  ClickHouse: clickHouseFields,
  Custom: [],
};

export function getFieldsForType(type: ConnectionType): FieldDef[] {
  return fieldsByType[type] ?? [];
}

export function getDefaultValues(type: ConnectionType): Record<string, string | number | boolean> {
  const fields = getFieldsForType(type);
  const defaults: Record<string, string | number | boolean> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) {
      defaults[f.name] = f.defaultValue;
    } else if (f.type === 'boolean') {
      defaults[f.name] = false;
    } else if (f.type === 'number') {
      defaults[f.name] = '';
    } else {
      defaults[f.name] = '';
    }
  }
  return defaults;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function val(fields: Record<string, any>, key: string): string {
  const v = fields[key];
  if (v === undefined || v === null || v === '') return '';
  return String(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function appendIf(parts: string[], key: string, value: any) {
  const s = val({ v: value }, 'v');
  if (s) parts.push(`${key}=${s}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildConnectionString(type: ConnectionType, fields: Record<string, any>): string {
  switch (type) {
    case 'SqlServer': {
      const parts: string[] = [];
      const port = val(fields, 'port');
      const host = val(fields, 'host');
      parts.push(`Server=${host}${port ? `,${port}` : ''}`);
      appendIf(parts, 'Database', fields.database);
      appendIf(parts, 'User Id', fields.username);
      appendIf(parts, 'Password', fields.password);
      if (fields.trustServerCertificate !== undefined) parts.push(`TrustServerCertificate=${fields.trustServerCertificate ? 'True' : 'False'}`);
      if (fields.encrypt !== undefined) parts.push(`Encrypt=${fields.encrypt ? 'True' : 'False'}`);
      appendIf(parts, 'Connection Timeout', fields.connectionTimeout);
      return parts.join(';') + ';';
    }
    case 'PostgreSQL': {
      const parts: string[] = [];
      appendIf(parts, 'Host', fields.host);
      appendIf(parts, 'Port', fields.port);
      appendIf(parts, 'Database', fields.database);
      appendIf(parts, 'Username', fields.username);
      appendIf(parts, 'Password', fields.password);
      appendIf(parts, 'SSL Mode', fields.sslMode);
      appendIf(parts, 'Timeout', fields.connectionTimeout);
      return parts.join(';') + ';';
    }
    case 'MySQL': {
      const parts: string[] = [];
      appendIf(parts, 'Server', fields.host);
      appendIf(parts, 'Port', fields.port);
      appendIf(parts, 'Database', fields.database);
      appendIf(parts, 'User', fields.username);
      appendIf(parts, 'Password', fields.password);
      appendIf(parts, 'SslMode', fields.sslMode);
      appendIf(parts, 'Connection Timeout', fields.connectionTimeout);
      return parts.join(';') + ';';
    }
    case 'SQLite': {
      const parts: string[] = [];
      appendIf(parts, 'Data Source', fields.dataSource);
      appendIf(parts, 'Mode', fields.mode);
      return parts.join(';') + ';';
    }
    case 'Oracle': {
      const host = val(fields, 'host');
      const port = val(fields, 'port') || '1521';
      const svc = val(fields, 'serviceName');
      const parts: string[] = [];
      parts.push(`Data Source=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${host})(PORT=${port}))(CONNECT_DATA=(SERVICE_NAME=${svc})))`);
      appendIf(parts, 'User Id', fields.username);
      appendIf(parts, 'Password', fields.password);
      return parts.join(';') + ';';
    }
    case 'MongoDB': {
      const user = val(fields, 'username');
      const pw = val(fields, 'password');
      const host = val(fields, 'host');
      const port = val(fields, 'port') || '27017';
      const db = val(fields, 'database');
      const auth = user && pw ? `${encodeURIComponent(user)}:${encodeURIComponent(pw)}@` : '';
      const params: string[] = [];
      if (val(fields, 'authSource')) params.push(`authSource=${val(fields, 'authSource')}`);
      if (fields.ssl) params.push('ssl=true');
      if (val(fields, 'replicaSet')) params.push(`replicaSet=${val(fields, 'replicaSet')}`);
      const qs = params.length ? `?${params.join('&')}` : '';
      return `mongodb://${auth}${host}:${port}/${db}${qs}`;
    }
    case 'Snowflake': {
      const parts: string[] = [];
      appendIf(parts, 'account', fields.account);
      appendIf(parts, 'user', fields.username);
      appendIf(parts, 'password', fields.password);
      appendIf(parts, 'db', fields.database);
      appendIf(parts, 'schema', fields.schema);
      appendIf(parts, 'warehouse', fields.warehouse);
      appendIf(parts, 'role', fields.role);
      return parts.join(';') + ';';
    }
    case 'BigQuery': {
      const parts: string[] = [];
      appendIf(parts, 'ProjectId', fields.projectId);
      const creds = val(fields, 'credentials');
      if (creds) parts.push(`Credentials=${creds}`);
      return parts.join(';') + ';';
    }
    case 'ClickHouse': {
      const parts: string[] = [];
      appendIf(parts, 'Host', fields.host);
      appendIf(parts, 'Port', fields.port);
      appendIf(parts, 'Database', fields.database);
      appendIf(parts, 'Username', fields.username);
      appendIf(parts, 'Password', fields.password);
      return parts.join(';') + ';';
    }
    default:
      return '';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildFieldsSchema(type: ConnectionType, isEditing: boolean): z.ZodObject<any> {
  const fields = getFieldsForType(type);
  const shape: Record<string, z.ZodType> = {};

  for (const f of fields) {
    if (f.type === 'boolean') {
      shape[f.name] = z.boolean().optional();
    } else if (f.type === 'number') {
      shape[f.name] = f.required && !isEditing
        ? z.union([z.string().min(1, `${f.label} is required`), z.number()])
        : z.union([z.string(), z.number()]).optional();
    } else if (f.required && !isEditing) {
      shape[f.name] = z.string().min(1, `${f.label} is required`);
    } else {
      shape[f.name] = z.string().optional();
    }
  }

  return z.object(shape as z.core.$ZodLooseShape);
}
