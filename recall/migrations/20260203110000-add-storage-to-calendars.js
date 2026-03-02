/**
 * Add storage/archiving columns to calendars (S3-compatible provider settings).
 */
function hasCol(t, name) {
  return Object.keys(t).some((k) => k.toLowerCase() === name.toLowerCase());
}

export async function up({ context: { queryInterface } }) {
  const sequelize = queryInterface.sequelize;
  const { Sequelize } = sequelize;
  const table = await queryInterface.describeTable("calendars");

  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_calendars_storage_provider') THEN
        CREATE TYPE enum_calendars_storage_provider AS ENUM ('aws_s3', 'wasabi', 'backblaze', 'minio', 'custom');
      END IF;
    END$$;
  `);

  if (!hasCol(table, "storage_provider")) {
    await queryInterface.addColumn("calendars", "storage_provider", {
      type: "enum_calendars_storage_provider",
      allowNull: true,
    });
  }
  if (!hasCol(table, "storage_endpoint")) {
    await queryInterface.addColumn("calendars", "storage_endpoint", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
  if (!hasCol(table, "storage_bucket")) {
    await queryInterface.addColumn("calendars", "storage_bucket", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
  if (!hasCol(table, "storage_access_key")) {
    await queryInterface.addColumn("calendars", "storage_access_key", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
  if (!hasCol(table, "storage_secret_key")) {
    await queryInterface.addColumn("calendars", "storage_secret_key", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
  if (!hasCol(table, "storage_region")) {
    await queryInterface.addColumn("calendars", "storage_region", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
  if (!hasCol(table, "auto_archive_recordings")) {
    await queryInterface.addColumn("calendars", "auto_archive_recordings", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  }
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.removeColumn("calendars", "storage_provider");
  await queryInterface.removeColumn("calendars", "storage_endpoint");
  await queryInterface.removeColumn("calendars", "storage_bucket");
  await queryInterface.removeColumn("calendars", "storage_access_key");
  await queryInterface.removeColumn("calendars", "storage_secret_key");
  await queryInterface.removeColumn("calendars", "storage_region");
  await queryInterface.removeColumn("calendars", "auto_archive_recordings");
  await queryInterface.sequelize.query(
    "DROP TYPE IF EXISTS enum_calendars_storage_provider;"
  );
}
