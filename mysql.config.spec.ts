import {
  DEFAULT_MYSQL_CONFIG,
  resolveMysqlConfig,
} from './mysql.config';

describe('resolveMysqlConfig', () => {
  it('returns defaults when env is empty', () => {
    expect(resolveMysqlConfig({})).toEqual(DEFAULT_MYSQL_CONFIG);
  });

  it('reads connection and pool settings from env', () => {
    expect(
      resolveMysqlConfig({
        MYSQL_HOST: 'db.example',
        MYSQL_PORT: '3307',
        MYSQL_USER: 'app',
        MYSQL_PASSWORD: 'secret',
        MYSQL_DATABASE: 'sales',
        MYSQL_CONNECTION_LIMIT: '5',
        MYSQL_WAIT_FOR_CONNECTIONS: 'false',
        MYSQL_QUEUE_LIMIT: '10',
        MYSQL_TIMEZONE: 'local',
      }),
    ).toEqual({
      host: 'db.example',
      port: 3307,
      user: 'app',
      password: 'secret',
      database: 'sales',
      connectionLimit: 5,
      waitForConnections: false,
      queueLimit: 10,
      timezone: 'local',
    });
  });

  it('merges programmatic overrides over env', () => {
    expect(
      resolveMysqlConfig(
        { MYSQL_HOST: 'from-env', MYSQL_CONNECTION_LIMIT: '99' },
        { host: 'override', connectionLimit: 2 },
      ),
    ).toEqual({
      ...DEFAULT_MYSQL_CONFIG,
      host: 'override',
      connectionLimit: 2,
    });
  });
});
